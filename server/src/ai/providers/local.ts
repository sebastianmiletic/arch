// providers/local.ts — Generic Local OpenAI-compatible Adapter (LM Studio, vLLM, LocalAI, etc.)
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

export class LocalProvider extends OpenAIProvider {
  id = 'local';
  name = 'Local';
  type = 'local';

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseUrl: (config.baseUrl ?? 'http://localhost:1234/v1').replace(/\/+$/, ''),
    });
  }

  getCapabilities(): string[] {
    return this.config.capabilities?.length
      ? this.config.capabilities
      : ['chat', 'stream', 'embed'];
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
