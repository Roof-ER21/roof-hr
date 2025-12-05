import Groq from 'groq-sdk';
import { LLMProvider, LLMOptions, LLMProviderStatus } from '../types';

export class GroqProvider implements LLMProvider {
  name = 'Groq';
  priority = 2;
  costPerToken = 0; // Free tier
  speedRating = 10; // Extremely fast
  privacyLevel = 'cloud' as const;
  
  private client: Groq | null = null;
  private lastError: string | null = null;
  private rateLimitExceeded = false;
  
  // Rate limiting tracking
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 30; // Free tier limit

  constructor() {
    if (process.env.GROQ_API_KEY) {
      this.client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    
    // Reset counter if minute has passed
    const now = Date.now();
    if (now - this.windowStart > 60000) {
      this.requestCount = 0;
      this.windowStart = now;
      this.rateLimitExceeded = false;
    }
    
    return this.requestCount < this.MAX_REQUESTS_PER_MINUTE && !this.rateLimitExceeded;
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    if (!this.client) {
      throw new Error('Groq API key not configured');
    }

    if (!await this.isAvailable()) {
      throw new Error('Groq rate limit exceeded, please wait');
    }

    this.requestCount++;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        model: options?.model || 'llama-3.1-8b-instant',
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 1000,
        ...(options?.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {})
      });

      return completion.choices[0]?.message?.content || '';
      
    } catch (error: any) {
      this.lastError = error.message;
      
      if (error.status === 429) {
        this.rateLimitExceeded = true;
        console.log('[Groq] Rate limit exceeded');
      }
      
      throw error;
    }
  }

  async generateJSON(prompt: string, schema?: any): Promise<any> {
    const response = await this.generateText(
      `${prompt}\n\nRespond with valid JSON only.`,
      {
        systemPrompt: 'You are a helpful assistant that always responds with valid JSON. Never include markdown formatting or explanation, just the JSON object.',
        temperature: 0.3
      }
    );
    
    try {
      // Clean up response in case model added markdown
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      throw new Error('Failed to parse JSON response from Groq');
    }
  }

  getStatus(): LLMProviderStatus {
    const remaining = Math.max(0, this.MAX_REQUESTS_PER_MINUTE - this.requestCount);
    
    return {
      provider: this.name,
      available: this.client !== null && !this.rateLimitExceeded,
      responseTime: 50, // Groq is extremely fast
      remainingQuota: remaining,
      lastError: this.lastError || undefined
    };
  }
}