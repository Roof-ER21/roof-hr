import { GoogleGenAI } from '@google/genai';
import { LLMProvider, LLMOptions, LLMProviderStatus } from '../types';

export class GeminiProvider implements LLMProvider {
  name = 'Gemini';
  priority = 3;
  costPerToken = 0; // Free tier
  speedRating = 7;
  privacyLevel = 'cloud' as const;
  
  private ai: GoogleGenAI | null = null;
  private lastError: string | null = null;
  private rateLimitExceeded = false;
  
  // Rate limiting
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 60; // Free tier limit

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.ai) return false;
    
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
    if (!this.ai) {
      throw new Error('Gemini client not initialized');
    }

    if (!await this.isAvailable()) {
      throw new Error('Gemini rate limit exceeded, please wait');
    }

    this.requestCount++;

    try {
      const fullPrompt = options?.systemPrompt 
        ? `${options.systemPrompt}\n\n${prompt}`
        : prompt;

      const response = await this.ai.models.generateContent({
        model: options?.model || 'gemini-2.5-flash',
        contents: fullPrompt
      });

      return response.text || '';
      
    } catch (error: any) {
      this.lastError = error.message;
      
      if (error.message?.includes('429') || error.message?.includes('RATE_LIMIT')) {
        this.rateLimitExceeded = true;
        console.log('[Gemini] Rate limit exceeded');
      }
      
      throw error;
    }
  }

  async generateJSON(prompt: string, schema?: any): Promise<any> {
    const response = await this.generateText(prompt, {
      responseFormat: 'json',
      systemPrompt: 'Respond with valid JSON only.',
      temperature: 0.3
    });
    
    try {
      return JSON.parse(response);
    } catch {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse JSON response from Gemini');
    }
  }

  async analyzeImage(imageBase64: string, prompt: string): Promise<string> {
    if (!this.ai) {
      throw new Error('Gemini client not initialized');
    }

    if (!await this.isAvailable()) {
      throw new Error('Gemini rate limit exceeded');
    }

    this.requestCount++;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: 'image/jpeg'
            }
          }
        ]
      });

      return response.text || '';
      
    } catch (error: any) {
      this.lastError = error.message;
      throw error;
    }
  }

  getStatus(): LLMProviderStatus {
    const remaining = Math.max(0, this.MAX_REQUESTS_PER_MINUTE - this.requestCount);
    
    return {
      provider: this.name,
      available: this.ai !== null && !this.rateLimitExceeded,
      responseTime: 200,
      remainingQuota: remaining,
      lastError: this.lastError || undefined
    };
  }
}