// providers/ollama.ts — Ollama Provider Adapter
// ---------------------------------------------------------------------------

import {
  type AIProviderConfig,
  type AIChatRequest,
  type AIChatResponse,
  type AIStreamChunk,
  type AIModel,
  type AIConnectionTest,
} from '../types.js';
import { BaseAIProvider } from './base.js';

export class OllamaProvider extends BaseAIProvider {
  id = 'ollama';
  name = 'Ollama';
  type = 'ollama';
  private base: string;

  constructor(config: AIProviderConfig) {
    super(config);
    this.base = (config.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
  }

  getCapabilities(): string[] {
    return this.config.capabilities?.length
      ? this.config.capabilities
      : ['chat', 'stream', 'embed'];
  }

  private toOllamaMessages(messages: AIChatRequest['messages']) {
    return messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const url = `${this.base}/api/chat`;
    const body = JSON.stringify({
      model: request.model ?? this.config.defaultModel,
      messages: this.toOllamaMessages(request.messages),
      stream: false,
      options: {
        temperature: request.temperature ?? this.config.temperature,
        num_predict: request.maxTokens ?? this.config.maxTokens,
      },
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Ollama chat error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const content = data?.message?.content ?? '';
    return {
      content,
      model: request.model ?? this.config.defaultModel,
    };
  }

  async *stream(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    const url = `${this.base}/api/chat`;
    const body = JSON.stringify({
      model: request.model ?? this.config.defaultModel,
      messages: this.toOllamaMessages(request.messages),
      stream: true,
      options: {
        temperature: request.temperature ?? this.config.temperature,
        num_predict: request.maxTokens ?? this.config.maxTokens,
      },
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Ollama stream error: ${res.status} ${await res.text()}`);
    if (!res.body) throw new Error('Ollama stream: empty body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const text = parsed?.message?.content ?? '';
            const isDone = parsed?.done === true;
            yield { content: text, done: isDone, model: request.model ?? this.config.defaultModel };
            if (isDone) return;
          } catch {
            // ignore malformed lines
          }
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          yield { content: parsed?.message?.content ?? '', done: true, model: request.model ?? this.config.defaultModel };
        } catch {
          // ignore trailing garbage
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listModels(): Promise<AIModel[]> {
    const res = await fetch(`${this.base}/api/tags`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Ollama tags error: ${res.status}`);
    const data = await res.json();
    const tags: any[] = data?.models ?? [];
    return tags.map((m: any) => ({
      id: m.name ?? m.model ?? String(m),
      name: m.name ?? m.model ?? String(m),
      provider: this.id,
      description: m.details?.family ?? undefined,
    }));
  }

  async embed(texts: string[]): Promise<number[][]> {
    const url = `${this.base}/api/embed`;
    const results: number[][] = [];
    for (const input of texts) {
      const body = JSON.stringify({ model: this.config.defaultModel, input });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`Ollama embed error: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const vec: number[] = data?.embedding ?? [];
      results.push(vec);
    }
    return results;
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
        version: 'local',
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
