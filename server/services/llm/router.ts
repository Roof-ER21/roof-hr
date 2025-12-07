import { LLMProvider, LLMOptions, LLMTaskContext, LLMProviderStatus, LLMRouterConfig } from './types';
import { OpenAIProvider } from './providers/openai';
import { GroqProvider } from './providers/groq';
import { GeminiProvider } from './providers/gemini';
import { OllamaProvider } from './providers/ollama';

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private providerStats: Map<string, {
    successCount: number;
    failureCount: number;
    totalLatency: number;
    lastUsed: Date;
  }> = new Map();

  private config: LLMRouterConfig = {
    providers: [],
    // Cost-optimized fallback chain: cheapest to most expensive
    fallbackChain: ['Groq', 'Gemini', 'OpenAI', 'Ollama'],
    taskRouting: {
      // Chat: Use fastest/cheapest providers first
      'chat': ['Groq', 'Gemini', 'OpenAI', 'Ollama'],
      // Analysis: Balance quality and cost
      'analysis': ['Gemini', 'OpenAI', 'Groq', 'Ollama'],
      // Generation: Quality matters more, but still cost-conscious
      'generation': ['Gemini', 'OpenAI', 'Groq', 'Ollama'],
      // Extraction: Speed matters most
      'extraction': ['Groq', 'Gemini', 'OpenAI', 'Ollama'],
      // Summary: Gemini excels at this
      'summary': ['Gemini', 'Groq', 'OpenAI', 'Ollama'],
      // Classification: Fast and accurate
      'classification': ['Groq', 'Gemini', 'OpenAI', 'Ollama']
    },
    quotaLimits: {
      'Groq': { requestsPerMinute: 30 },
      'Gemini': { requestsPerMinute: 60 }
    }
  };

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize all providers
    const providers = [
      new OpenAIProvider(),
      new GroqProvider(),
      new GeminiProvider(),
      new OllamaProvider()
    ];

    for (const provider of providers) {
      this.providers.set(provider.name, provider);
      this.config.providers.push(provider);
      
      // Initialize stats
      this.providerStats.set(provider.name, {
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        lastUsed: new Date(0)
      });
    }

    console.log('[LLM Router] Initialized with providers:', Array.from(this.providers.keys()).join(', '));
  }

  async selectProvider(context: LLMTaskContext): Promise<LLMProvider | null> {
    // Get preferred providers for this task type
    const preferredProviders = this.config.taskRouting[context.taskType] || this.config.fallbackChain;
    
    // If privacy is required, only use local providers
    if (context.requiresPrivacy) {
      const ollama = this.providers.get('Ollama');
      if (ollama && await ollama.isAvailable()) {
        console.log(`[LLM Router] Selected Ollama for privacy-required task`);
        return ollama;
      }
    }

    // For real-time needs, prioritize Groq
    if (context.expectedResponseTime === 'realtime') {
      const groq = this.providers.get('Groq');
      if (groq && await groq.isAvailable()) {
        console.log(`[LLM Router] Selected Groq for real-time response`);
        return groq;
      }
    }

    // Try providers in order of preference
    for (const providerName of preferredProviders) {
      const provider = this.providers.get(providerName);
      if (provider && await provider.isAvailable()) {
        console.log(`[LLM Router] Selected ${providerName} for ${context.taskType} task`);
        return provider;
      }
    }

    // Fallback: try any available provider
    for (const [name, provider] of Array.from(this.providers)) {
      if (await provider.isAvailable()) {
        console.log(`[LLM Router] Fallback to ${name}`);
        return provider;
      }
    }

    console.error('[LLM Router] No providers available');
    return null;
  }

  async generateText(
    prompt: string, 
    context: LLMTaskContext,
    options?: LLMOptions
  ): Promise<{ text: string; provider: string }> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    // Try primary provider
    const primaryProvider = await this.selectProvider(context);
    if (primaryProvider) {
      try {
        const text = await primaryProvider.generateText(prompt, options);
        this.recordSuccess(primaryProvider.name, Date.now() - startTime);
        return { text, provider: primaryProvider.name };
      } catch (error: any) {
        console.error(`[LLM Router] ${primaryProvider.name} failed:`, error.message);
        this.recordFailure(primaryProvider.name);
        lastError = error;
      }
    }

    // Fallback chain
    for (const providerName of this.config.fallbackChain) {
      const provider = this.providers.get(providerName);
      if (!provider || !await provider.isAvailable()) continue;
      
      try {
        console.log(`[LLM Router] Trying fallback: ${providerName}`);
        const text = await provider.generateText(prompt, options);
        this.recordSuccess(provider.name, Date.now() - startTime);
        return { text, provider: provider.name };
      } catch (error: any) {
        console.error(`[LLM Router] ${providerName} failed:`, error.message);
        this.recordFailure(providerName);
        lastError = error;
      }
    }

    throw lastError || new Error('All LLM providers failed');
  }

  async generateJSON(
    prompt: string,
    context: LLMTaskContext,
    schema?: any
  ): Promise<{ data: any; provider: string }> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    const provider = await this.selectProvider(context);
    if (provider) {
      try {
        const data = await provider.generateJSON(prompt, schema);
        this.recordSuccess(provider.name, Date.now() - startTime);
        return { data, provider: provider.name };
      } catch (error: any) {
        console.error(`[LLM Router] ${provider.name} JSON generation failed:`, error.message);
        this.recordFailure(provider.name);
        lastError = error;
      }
    }

    // Fallback
    for (const providerName of this.config.fallbackChain) {
      const fallbackProvider = this.providers.get(providerName);
      if (!fallbackProvider || !await fallbackProvider.isAvailable()) continue;
      
      try {
        const data = await fallbackProvider.generateJSON(prompt, schema);
        this.recordSuccess(providerName, Date.now() - startTime);
        return { data, provider: providerName };
      } catch (error: any) {
        console.error(`[LLM Router] ${providerName} JSON fallback failed:`, error.message);
        this.recordFailure(providerName);
        lastError = error;
      }
    }

    throw lastError || new Error('All LLM providers failed for JSON generation');
  }

  private recordSuccess(provider: string, latency: number) {
    const stats = this.providerStats.get(provider);
    if (stats) {
      stats.successCount++;
      stats.totalLatency += latency;
      stats.lastUsed = new Date();
    }
  }

  private recordFailure(provider: string) {
    const stats = this.providerStats.get(provider);
    if (stats) {
      stats.failureCount++;
    }
  }

  async getStatus(): Promise<LLMProviderStatus[]> {
    const statuses: LLMProviderStatus[] = [];

    for (const [name, provider] of Array.from(this.providers)) {
      const stats = this.providerStats.get(name);
      const avgLatency = stats && stats.successCount > 0 
        ? Math.round(stats.totalLatency / stats.successCount)
        : undefined;
      
      statuses.push({
        provider: name,
        available: await provider.isAvailable(),
        responseTime: avgLatency,
        lastUsed: stats?.lastUsed
      });
    }

    return statuses;
  }

  async healthCheck(): Promise<{
    availableProviders: string[];
    totalProviders: number;
    status: 'healthy' | 'degraded' | 'down';
  }> {
    const available: string[] = [];

    for (const [name, provider] of Array.from(this.providers)) {
      if (await provider.isAvailable()) {
        available.push(name);
      }
    }

    return {
      availableProviders: available,
      totalProviders: this.providers.size,
      status: available.length === 0 ? 'down' : 
              available.length < this.providers.size ? 'degraded' : 
              'healthy'
    };
  }
}

// Singleton instance
export const llmRouter = new LLMRouter();