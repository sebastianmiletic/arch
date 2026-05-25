// AIModelRegistry.ts — Registry for all known models across all providers.
// ---------------------------------------------------------------------------

import { AIProviderManager } from './AIProviderManager.js';
import { type AIModel } from './types.js';

export class AIModelRegistry {
  models: AIModel[] = [];

  /** Add a model to the registry (idempotent by id+provider). */
  register(model: AIModel): void {
    const idx = this.models.findIndex((m) => m.id === model.id && m.provider === model.provider);
    if (idx >= 0) {
      this.models[idx] = model;
    } else {
      this.models.push(model);
    }
  }

  /** Remove a model by id (removes all providers with that id). */
  unregister(id: string): void {
    this.models = this.models.filter((m) => m.id !== id);
  }

  /** Search by name or provider (partial, case-insensitive). */
  find(query: string): AIModel[] {
    const q = query.toLowerCase();
    return this.models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }

  /** Return models that support a given capability. */
  findByCapability(cap: string): AIModel[] {
    return this.models.filter((m) =>
      m.capabilities?.some((c) => c.toLowerCase() === cap.toLowerCase())
    );
  }

  /** Return models belonging to a specific provider id. */
  findByProvider(providerId: string): AIModel[] {
    return this.models.filter((m) => m.provider.toLowerCase() === providerId.toLowerCase());
  }

  /** Return the entire model list. */
  getAll(): AIModel[] {
    return this.models.slice();
  }

  /**
   * Discover and register models from every provider in the manager.
   * Operates on the passed registry instance.
   */
  static async discoverModels(
    manager: AIProviderManager,
    registry: AIModelRegistry
  ): Promise<void> {
    for (const provider of manager.getAll()) {
      try {
        const models = await provider.listModels();
        for (const m of models) {
          const enriched: AIModel = {
            ...m,
            provider: provider.id,
            capabilities: m.capabilities ?? provider.getCapabilities(),
          };
          registry.register(enriched);
        }
      } catch {
        // ignore unreachable providers during discovery
      }
    }
  }
}
