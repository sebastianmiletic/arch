// AIRequestRouter.ts — Routes requests to the right provider with fallback logic.
// ---------------------------------------------------------------------------

import { AIProviderManager } from './AIProviderManager.js';
import { BaseAIProvider } from './providers/base.js';
import {
  type AIChatRequest,
  type AIChatResponse,
  type AIStreamChunk,
} from './types.js';

export class AIRequestRouter {
  constructor(private manager: AIProviderManager) {}

  /**
   * Route a synchronous chat request.
   * If a preferred provider or model is supplied, honour it when possible.
   */
  async route(
    request: AIChatRequest,
    preferredProvider?: string,
    preferredModel?: string
  ): Promise<AIChatResponse> {
    const provider = this.resolveProvider(preferredProvider);
    if (preferredModel) request.model = preferredModel;
    return provider.chat(request);
  }

  /**
   * Route a streaming chat request.
   */
  async *routeStream(
    request: AIChatRequest,
    preferredProvider?: string,
    preferredModel?: string
  ): AsyncGenerator<AIStreamChunk> {
    const provider = this.resolveProvider(preferredProvider);
    if (preferredModel) request.model = preferredModel;
    yield* provider.stream(request);
  }

  /**
   * Route an embedding request.
   */
  async routeEmbed(texts: string[], preferredProvider?: string): Promise<number[][]> {
    const provider = this.resolveProvider(preferredProvider);
    return provider.embed(texts);
  }

  /**
   * Attempt a chat request across a list of provider ids, stopping at the first success.
   */
  async routeWithFailover(
    request: AIChatRequest,
    providerIds: string[]
  ): Promise<AIChatResponse> {
    const triedErrors: string[] = [];
    for (const id of providerIds) {
      const p = this.manager.get(id);
      if (!p || !p.config.enabled) continue;
      try {
        return await p.chat(request);
      } catch (err) {
        triedErrors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error(`All providers failed: ${triedErrors.join('; ')}`);
  }

  /**
   * Pick a model id best suited for the request based on capabilities required.
   */
  autoSelectModel(request: AIChatRequest): string {
    const required: string[] = [];
    if (request.tools?.length) required.push('tool_call');
    if (request.stream) required.push('stream');
    // Simple heuristic: first enabled provider with all required capabilities
    const candidates = this.manager.getByPriority();
    for (const p of candidates) {
      if (required.every((cap) => p.supports(cap))) {
        return p.config.defaultModel;
      }
    }
    // Fallback to highest-priority enabled provider
    const first = candidates[0];
    if (first) return first.config.defaultModel;
    throw new Error('No enabled providers available for auto-select');
  }

  /** Resolve a provider instance from an optional id, falling back to highest-priority enabled. */
  private resolveProvider(preferred?: string): BaseAIProvider {
    if (preferred) {
      const p = this.manager.get(preferred);
      if (p && p.config.enabled) return p;
    }
    const prioritized = this.manager.getByPriority();
    if (prioritized.length === 0) throw new Error('No enabled providers available');
    return prioritized[0];
  }
}
