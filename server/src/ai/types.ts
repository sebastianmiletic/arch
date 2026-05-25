// AI Provider Integration System: Core Types
// ---------------------------------------------------------------------------

/**
 * Feature/capability string identifiers supported by providers.
 */
export type AIFunctionName =
  | 'chat'
  | 'stream'
  | 'embed'
  | 'reason'
  | 'vision'
  | 'tool_call';

/**
 * Per-function response wrapper.
 */
export interface AIFunctionResponse<T = unknown> {
  function: AIFunctionName;
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

/**
 * Provider configuration record used by the manager and persisted in settings.
 */
export interface AIProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  type: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  metadata: Record<string, unknown>;
  priority: number;
  capabilities: string[];
  lastTestedAt?: string;
  lastTestResult?: boolean;
  models: AIModel[];
}

/**
 * A single message in a chat conversation.
 */
export interface AIMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  provider?: string;
  model?: string;
  timestamp?: string;
  tokens?: number;
  latency?: number;
}

/**
 * Chat completion request shape.
 */
export interface AIChatRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: unknown[];
  system?: string;
}

/**
 * Chat completion response shape.
 */
export interface AIChatResponse {
  content: string;
  model: string;
  tokens?: { prompt: number; completion: number; total: number };
  latency?: number;
  done?: boolean;
  error?: string;
  streamData?: AIStreamChunk[];
}

/**
 * Chunk emitted during a streaming response.
 */
export interface AIStreamChunk {
  content: string;
  done: boolean;
  model?: string;
  tokens?: { prompt: number; completion: number; total: number };
}

/**
 * Model descriptor.
 */
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
  capabilities?: string[];
  description?: string;
}

/**
 * Result of a connection / health test against a provider.
 */
export interface AIConnectionTest {
  ok: boolean;
  latency: number;
  error?: string;
  models?: AIModel[];
  version?: string;
  capabilities?: string[];
  streaming?: boolean;
}
