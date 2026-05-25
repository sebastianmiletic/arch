// providers/openrouter.ts — OpenRouter Provider Adapter
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

export class OpenRouterProvider extends OpenAIProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  type = 'openrouter';

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseUrl: (config.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
    });
  }

  getCapabilities(): string[] {
    return this.config.capabilities?.length
      ? this.config.capabilities
      : ['chat', 'stream', 'tool_call'];
  }

  buildHeaders(): Record<string, string> {
    const headers = super.buildHeaders();
    headers['HTTP-Referer'] = 'https://arch.local';
    headers['X-Title'] = 'Arch AI System';
    return headers;
  }

  async listModels(): Promise<AIModel[]> {
    const res = await fetch(`${(this.config.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '')}/models`, {
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`OpenRouter list models error: ${res.status}`);
    const data = await res.json();
    const list: any[] = data?.data ?? [];
    return list.map((m: any) => ({
      id: m.id,
      name: m.name ?? m.id,
      provider: this.id,
      description: m.description ?? undefined,
    }));
  }

  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error('OpenRouter does not expose an embedding endpoint through this adapter.');
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
