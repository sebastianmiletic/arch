// AIProviderManager.ts — Central registry and lifecycle manager for AI providers.
// ---------------------------------------------------------------------------

import { BaseAIProvider } from './providers/base.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';
import { GroqProvider } from './providers/groq.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import { NvidiaProvider } from './providers/nvidia.js';
import { OpencodeProvider } from './providers/opencode.js';
import { LocalProvider } from './providers/local.js';
import { CustomProvider } from './providers/custom.js';
import {
  type AIProviderConfig,
  type AIConnectionTest,
  type AIModel,
} from './types.js';

export class AIProviderManager {
  providers = new Map<string, BaseAIProvider>();

  /** Register a provider instance. */
  register(provider: BaseAIProvider): void {
    this.providers.set(provider.id, provider);
  }

  /** Fetch a provider by its id. */
  get(id: string): BaseAIProvider | undefined {
    return this.providers.get(id);
  }

  /** Return all registered providers. */
  getAll(): BaseAIProvider[] {
    return Array.from(this.providers.values());
  }

  /** Return only providers whose config.enabled is true. */
  getEnabled(): BaseAIProvider[] {
    return this.getAll().filter((p) => p.config.enabled);
  }

  /** Return enabled providers sorted by priority (ascending). */
  getByPriority(): BaseAIProvider[] {
    return this.getEnabled().sort((a, b) => a.config.priority - b.config.priority);
  }

  /** Enable a provider by id. Returns false if id not found. */
  enable(id: string): boolean {
    const p = this.providers.get(id);
    if (!p) return false;
    p.config.enabled = true;
    return true;
  }

  /** Disable a provider by id. Returns false if id not found. */
  disable(id: string): boolean {
    const p = this.providers.get(id);
    if (!p) return false;
    p.config.enabled = false;
    return true;
  }

  /** Run a health test on a specific provider. */
  async test(id: string): Promise<AIConnectionTest> {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider '${id}' not found`);
    return p.test();
  }

  /** Fetch models for a specific provider via listModels(). */
  async listModels(id: string): Promise<AIModel[]> {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider '${id}' not found`);
    return p.listModels();
  }

  /** Bulk initialise providers from an array of config objects. */
  fromConfig(configs: AIProviderConfig[]): void {
    for (const cfg of configs) {
      let provider: BaseAIProvider;
      switch (cfg.type) {
        case 'ollama':
          provider = new OllamaProvider(cfg);
          break;
        case 'openai':
          provider = new OpenAIProvider(cfg);
          break;
        case 'anthropic':
          provider = new AnthropicProvider(cfg);
          break;
        case 'gemini':
          provider = new GeminiProvider(cfg);
          break;
        case 'groq':
          provider = new GroqProvider(cfg);
          break;
        case 'openrouter':
          provider = new OpenRouterProvider(cfg);
          break;
        case 'nvidia':
          provider = new NvidiaProvider(cfg);
          break;
        case 'opencode':
          provider = new OpencodeProvider(cfg);
          break;
        case 'local':
          provider = new LocalProvider(cfg);
          break;
        case 'custom':
          provider = new CustomProvider(cfg);
          break;
        default:
          provider = new CustomProvider(cfg);
      }
      this.register(provider);
    }
  }

  /** Return a default config set covering all built-in provider types. */
  static createDefaultConfigs(): AIProviderConfig[] {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        enabled: false,
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 1,
        capabilities: ['chat', 'stream', 'embed', 'reason', 'vision', 'tool_call'],
        models: [],
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        enabled: false,
        type: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        defaultModel: 'claude-3-sonnet-20240229',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 2,
        capabilities: ['chat', 'stream', 'reason', 'vision', 'tool_call'],
        models: [],
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        enabled: false,
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        defaultModel: 'gemini-1.5-pro',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 3,
        capabilities: ['chat', 'stream', 'embed', 'reason', 'vision', 'tool_call'],
        models: [],
      },
      {
        id: 'groq',
        name: 'Groq',
        enabled: false,
        type: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama3-8b-8192',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 4,
        capabilities: ['chat', 'stream', 'tool_call'],
        models: [],
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        enabled: false,
        type: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'mistralai/mistral-7b-instruct',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 5,
        capabilities: ['chat', 'stream', 'tool_call'],
        models: [],
      },
      {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        enabled: false,
        type: 'nvidia',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        defaultModel: 'meta/llama3-8b-instruct',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 6,
        capabilities: ['chat', 'stream', 'embed'],
        models: [],
      },
      {
        id: 'ollama',
        name: 'Ollama',
        enabled: true,
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 7,
        capabilities: ['chat', 'stream', 'embed'],
        models: [],
      },
      {
        id: 'opencode',
        name: 'OpenCode',
        enabled: true,
        type: 'opencode',
        defaultModel: 'opencode-default',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 8,
        capabilities: ['chat', 'stream', 'tool_call'],
        models: [],
      },
      {
        id: 'local',
        name: 'Local',
        enabled: false,
        type: 'local',
        baseUrl: 'http://localhost:1234/v1',
        defaultModel: 'local-model',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 9,
        capabilities: ['chat', 'stream', 'embed'],
        models: [],
      },
      {
        id: 'azure',
        name: 'Azure OpenAI',
        enabled: false,
        type: 'custom',
        baseUrl: 'https://{your-resource}.openai.azure.com/openai/deployments/{deployment-id}',
        defaultModel: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 10,
        capabilities: ['chat', 'stream', 'embed', 'vision', 'tool_call'],
        models: [],
      },
      {
        id: 'cohere',
        name: 'Cohere',
        enabled: false,
        type: 'custom',
        baseUrl: 'https://api.cohere.ai/v1',
        defaultModel: 'command-r',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 11,
        capabilities: ['chat', 'stream', 'embed', 'tool_call'],
        models: [],
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        enabled: false,
        type: 'custom',
        baseUrl: 'https://api.mistral.ai/v1',
        defaultModel: 'mistral-large-latest',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 12,
        capabilities: ['chat', 'stream', 'embed', 'tool_call'],
        models: [],
      },
      {
        id: 'perplexity',
        name: 'Perplexity',
        enabled: false,
        type: 'custom',
        baseUrl: 'https://api.perplexity.ai',
        defaultModel: 'sonar-medium-chat',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 13,
        capabilities: ['chat', 'stream'],
        models: [],
      },
      {
        id: 'ai21',
        name: 'AI21 Labs',
        enabled: false,
        type: 'custom',
        baseUrl: 'https://api.ai21.com/studio/v1',
        defaultModel: 'jamba-instruct',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 14,
        capabilities: ['chat', 'stream'],
        models: [],
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        enabled: false,
        type: 'custom',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 15,
        capabilities: ['chat', 'stream', 'reason'],
        models: [],
      },
      {
        id: 'fireworks',
        name: 'Fireworks AI',
        enabled: false,
        type: 'custom',
        baseUrl: 'https://api.fireworks.ai/inference/v1',
        defaultModel: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 16,
        capabilities: ['chat', 'stream', 'tool_call'],
        models: [],
      },
      {
        id: 'custom',
        name: 'Custom',
        enabled: false,
        type: 'custom',
        baseUrl: 'http://localhost:8080/v1',
        defaultModel: 'custom-model',
        temperature: 0.7,
        maxTokens: 4096,
        metadata: {},
        priority: 17,
        capabilities: ['chat', 'stream'],
        models: [],
      },
    ];
  }
}
