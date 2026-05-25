// src/ai/index.ts — unified barrel export for the AI provider integration system.
// ---------------------------------------------------------------------------

export * from './types.js';

export { BaseAIProvider } from './providers/base.js';
export { OllamaProvider } from './providers/ollama.js';
export { OpenAIProvider } from './providers/openai.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { GeminiProvider } from './providers/gemini.js';
export { GroqProvider } from './providers/groq.js';
export { OpenRouterProvider } from './providers/openrouter.js';
export { NvidiaProvider } from './providers/nvidia.js';
export { OpencodeProvider } from './providers/opencode.js';
export { LocalProvider } from './providers/local.js';
export { CustomProvider } from './providers/custom.js';

export { AIProviderManager } from './AIProviderManager.js';
export { AIRequestRouter } from './AIRequestRouter.js';
export { AIStreamingEngine } from './AIStreamingEngine.js';
export { AIModelRegistry } from './AIModelRegistry.js';
export { AIConnectionTester } from './AIConnectionTester.js';
export { AISettingsManager } from './AISettingsManager.js';
