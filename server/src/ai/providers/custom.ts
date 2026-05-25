// providers/custom.ts — Fully customizable OpenAI-compatible provider
// ---------------------------------------------------------------------------

import {
  type AIProviderConfig,
  type AIChatRequest,
  type AIChatResponse,
  type AIStreamChunk,
  type AIModel,
  type AIConnectionTest,
} from '../types.js';
import { OpenAIProvider } from './openai.js';

/**
 * A catch-all provider that accepts any baseUrl, apiKey, and model name,
 * speaking the standard OpenAI chat-completions format.
 */
export class CustomProvider extends OpenAIProvider {
  id = 'custom';
  name = 'Custom';
  type = 'custom';

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseUrl: (config.baseUrl ?? 'http://localhost:8080/v1').replace(/\/+$/, ''),
    });
    this.id = config.id ?? 'custom';
    this.name = config.name ?? 'Custom';
  }

  getCapabilities(): string[] {
    return this.config.capabilities?.length
      ? this.config.capabilities
      : ['chat', 'stream'];
  }

  async test(): Promise<AIConnectionTest> {
    const start = Date.now();
    try {
      const models = await this.listModels();
      return {
        ok: true,
        latency: Date.now() - start,
        models,
        capabilities: this.getCapabilities(),
        streaming: this.supports('stream'),
      };
    } catch (err) {
      return {
        ok: false,
        latency: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        capabilities: this.getCapabilities(),
        streaming: this.supports('stream'),
      };
    }
  }
}
