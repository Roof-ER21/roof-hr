import { LLMProvider, LLMOptions, LLMProviderStatus } from '../types';

interface OllamaResponse {
  response: string;
  model: string;
  done: boolean;
}

export class OllamaProvider implements LLMProvider {
  name = 'Ollama';
  priority = 4;
  costPerToken = 0; // Local, no cost
  speedRating = 6;
  privacyLevel = 'local' as const;
  
  private baseUrl: string;
  private defaultModel: string;
  private lastError: string | null = null;
  private isHealthy = false;
  private lastHealthCheck = 0;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    // llama3.1:8b is optimal for HR tasks - fast, private, and efficient
    this.defaultModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
  }

  async checkHealth(): Promise<boolean> {
    // Cache health check for 30 seconds
    const now = Date.now();
    if (now - this.lastHealthCheck < 30000) {
      return this.isHealthy;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      this.isHealthy = response.ok;
      this.lastHealthCheck = now;
      
      if (this.isHealthy) {
        const data = await response.json();
        const models = data.models?.map((m: any) => m.name) || [];
        
        if (models.length === 0) {
          console.log('[Ollama] No models installed. Run: ollama pull llama3.1:8b');
          this.isHealthy = false;
        } else {
          console.log('[Ollama] Available models:', models.join(', '));

          // Check if our default model is available
          if (!models.some((m: string) => m.includes('llama3.1') || m.includes('llama-3.1'))) {
            console.log('[Ollama] Recommended model not found. Install it with: ollama pull llama3.1:8b');
          }
        }
      }
      
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = now;
      this.lastError = 'Ollama server not reachable';
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    return await this.checkHealth();
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    if (!await this.isAvailable()) {
      throw new Error('Ollama server is not available');
    }

    try {
      const systemPrompt = options?.systemPrompt || 'You are a helpful HR assistant.';
      const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options?.model || this.defaultModel,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 1000
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${error}`);
      }

      const data = await response.json() as OllamaResponse;
      return data.response;
      
    } catch (error: any) {
      this.lastError = error.message;
      this.isHealthy = false;
      throw error;
    }
  }

  async generateJSON(prompt: string, schema?: any): Promise<any> {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond with valid JSON only, no markdown, no explanation.`;
    
    const response = await this.generateText(jsonPrompt, {
      systemPrompt: 'You are a JSON generator. Always respond with valid JSON only.',
      temperature: 0.3
    });
    
    try {
      // Clean any markdown or extra text
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Find JSON in response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return JSON.parse(cleaned);
    } catch {
      throw new Error('Failed to parse JSON response from Ollama');
    }
  }

  async pullModel(modelName: string): Promise<void> {
    console.log(`[Ollama] Pulling model ${modelName}...`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: modelName,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      console.log(`[Ollama] Model ${modelName} pulled successfully`);
    } catch (error: any) {
      console.error(`[Ollama] Failed to pull model: ${error.message}`);
      throw error;
    }
  }

  getStatus(): LLMProviderStatus {
    return {
      provider: this.name,
      available: this.isHealthy,
      responseTime: 500, // Local inference varies
      lastError: this.lastError || undefined
    };
  }
}