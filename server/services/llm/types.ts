export interface LLMProvider {
  name: string;
  priority: number;
  costPerToken: number;
  speedRating: number; // 1-10, 10 being fastest
  privacyLevel: 'local' | 'cloud';
  isAvailable(): Promise<boolean>;
  generateText(prompt: string, options?: LLMOptions): Promise<string>;
  generateJSON(prompt: string, schema?: any): Promise<any>;
  analyzeImage?(imageBase64: string, prompt: string): Promise<string>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
}

export interface LLMTaskContext {
  taskType: 'chat' | 'analysis' | 'generation' | 'extraction' | 'summary' | 'classification';
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiresPrivacy: boolean;
  expectedResponseTime?: 'realtime' | 'fast' | 'normal' | 'batch';
  estimatedTokens?: number;
}

export interface LLMProviderStatus {
  provider: string;
  available: boolean;
  responseTime?: number;
  remainingQuota?: number;
  lastError?: string;
  lastUsed?: Date;
}

export interface LLMRouterConfig {
  providers: LLMProvider[];
  fallbackChain: string[];
  taskRouting: {
    [taskType: string]: string[];
  };
  quotaLimits: {
    [provider: string]: {
      requestsPerMinute?: number;
      tokensPerDay?: number;
    };
  };
}