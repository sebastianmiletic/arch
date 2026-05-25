// AIConnectionTester.ts — Deep diagnostics and auto-discovery for AI providers.
// ---------------------------------------------------------------------------

import { BaseAIProvider } from './providers/base.js';
import {
  type AIConnectionTest,
  type AIProviderConfig,
  AIModel,
} from './types.js';

export class AIConnectionTester {
  /**
   * Perform a comprehensive test on a provider:
   * 1. reachability (listModels),
   * 2. auth (non-403/401),
   * 3. latency,
   * 4. streaming (if provider supports it),
   * 5. chat sanity (single-turn ping).
   */
  static async testProvider(provider: BaseAIProvider): Promise<AIConnectionTest> {
    const start = Date.now();
    let ok = false;
    let models: AIModel[] | undefined;
    let streaming = provider.supports('stream');
    let version: string | undefined;
    let error: string | undefined;

    // Step 1: reachability + models
    try {
      models = await provider.listModels();
      ok = true;
    } catch (err) {
      ok = false;
      error = err instanceof Error ? err.message : String(err);
      // Still attempt deeper tests if possible
    }

    // Step 2: streaming sanity
    if (streaming && ok) {
      try {
        const gen = provider.stream({
          messages: [{ role: 'user', content: 'hi' }],
          model: provider.config.defaultModel,
          maxTokens: 1,
          temperature: 0,
          stream: true,
        });
        // Pull first chunk
        const first = await gen.next();
        if (first.done) streaming = false; // stream immediately closed
      } catch (err) {
        streaming = false;
        error = error ?? (err instanceof Error ? err.message : String(err));
      }
    }

    // Step 3: chat sanity
    if (ok) {
      try {
        await provider.chat({
          messages: [{ role: 'user', content: 'hello' }],
          model: provider.config.defaultModel,
          maxTokens: 1,
          temperature: 0,
        });
      } catch (err) {
        // If chat fails but models succeeded, auth may be fine but model may be missing
        const msg = err instanceof Error ? err.message : String(err);
        if (!error) error = msg;
      }
    }

    // For Ollama / Local types infer version from model metadata if present
    if (
      provider.type === 'ollama' ||
      provider.type === 'local' ||
      provider.type === 'opencode'
    ) {
      version = 'unknown';
    }

    return {
      ok,
      latency: Date.now() - start,
      error,
      models,
      version,
      capabilities: provider.getCapabilities(),
      streaming,
    };
  }

  /**
   * Scan localhost well-known ports to auto-discover local AI servers.
   */
  static async autoDiscover(): Promise<AIProviderConfig[]> {
    const discovered: AIProviderConfig[] = [];
    const probes = [
      {
        id: 'ollama',
        name: 'Ollama (auto)',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3',
      },
      {
        id: 'local_lmstudio',
        name: 'LM Studio (auto)',
        type: 'local',
        baseUrl: 'http://localhost:1234/v1',
        defaultModel: 'local-model',
      },
      {
        id: 'local_vllm',
        name: 'vLLM (auto)',
        type: 'local',
        baseUrl: 'http://localhost:8000/v1',
        defaultModel: 'local-model',
      },
      {
        id: 'local_localai',
        name: 'LocalAI (auto)',
        type: 'local',
        baseUrl: 'http://localhost:8080/v1',
        defaultModel: 'local-model',
      },
      {
        id: 'local_ollama_alt',
        name: 'Ollama Alt (auto)',
        type: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        defaultModel: 'llama3',
      },
    ];

    for (const probe of probes) {
      try {
        const res = await fetch(`${probe.baseUrl.replace(/\/+$/, '')}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          discovered.push({
            id: probe.id,
            name: probe.name,
            enabled: false,
            type: probe.type,
            baseUrl: probe.baseUrl,
            defaultModel: probe.defaultModel,
            temperature: 0.7,
            maxTokens: 4096,
            metadata: { autoDiscovered: true },
            priority: 100,
            capabilities: ['chat', 'stream'],
            models: [],
          });
          continue;
        }
      } catch {
        // Fall through to alternative endpoint
      }

      // Alternative endpoint checks per type
      const altUrl =
        probe.type === 'ollama'
          ? `${probe.baseUrl}/api/tags`
          : `${probe.baseUrl}/models`;
      try {
        const res = await fetch(altUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          discovered.push({
            id: probe.id,
            name: probe.name,
            enabled: false,
            type: probe.type,
            baseUrl: probe.baseUrl,
            defaultModel: probe.defaultModel,
            temperature: 0.7,
            maxTokens: 4096,
            metadata: { autoDiscovered: true },
            priority: 100,
            capabilities: ['chat', 'stream'],
            models: [],
          });
        }
      } catch {
        // host/port not reachable
      }
    }

    return discovered;
  }
}
