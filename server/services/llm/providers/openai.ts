import OpenAI from 'openai';
import { LLMProvider, LLMOptions, LLMProviderStatus } from '../types';

export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';
  priority = 1;
  costPerToken = 0.002;
  speedRating = 8;
  privacyLevel = 'cloud' as const;
  
  private client: OpenAI | null = null;
  private lastError: string | null = null;
  private quotaExceeded = false;
  private retryAfter: Date | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    
    // Check if we're in quota cooldown
    if (this.quotaExceeded && this.retryAfter) {
      if (new Date() < this.retryAfter) {
        return false;
      }
      // Reset quota flag after cooldown
      this.quotaExceeded = false;
      this.retryAfter = null;
    }
    
    return !this.quotaExceeded;
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: options?.model || 'gpt-4o-mini',  // Using gpt-4o-mini for cost optimization
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
        ...(options?.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {})
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      this.lastError = error.message;
      
      // Handle quota exceeded
      if (error.status === 429 || error.code === 'insufficient_quota') {
        this.quotaExceeded = true;
        this.retryAfter = new Date(Date.now() + 3600000); // Retry after 1 hour
        console.log('[OpenAI] Quota exceeded, will retry after:', this.retryAfter);
      }
      
      throw error;
    }
  }

  async generateJSON(prompt: string, schema?: any): Promise<any> {
    const response = await this.generateText(prompt, {
      responseFormat: 'json',
      systemPrompt: 'You are a helpful assistant that always responds with valid JSON.'
    });
    
    try {
      return JSON.parse(response);
    } catch {
      throw new Error('Failed to parse JSON response from OpenAI');
    }
  }

  async analyzeImage(imageBase64: string, prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',  // Using gpt-4o-mini for cost optimization
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      this.lastError = error.message;
      if (error.status === 429) {
        this.quotaExceeded = true;
        this.retryAfter = new Date(Date.now() + 3600000);
      }
      throw error;
    }
  }

  getStatus(): LLMProviderStatus {
    return {
      provider: this.name,
      available: !this.quotaExceeded,
      lastError: this.lastError || undefined,
      remainingQuota: this.quotaExceeded ? 0 : undefined
    };
  }
}