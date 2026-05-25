// AIStreamingEngine.ts — Normalises SSE streams from multiple provider dialects.
// ---------------------------------------------------------------------------

import { BaseAIProvider } from './providers/base.js';
import { type AIStreamChunk, type AIChatRequest } from './types.js';

export class AIStreamingEngine {
  /**
   * Parse an OpenAI-compatible SSE stream from a ReadableStreamDefaultReader.
   */
  static async *parseOpenAIStream(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): AsyncGenerator<AIStreamChunk> {
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
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === 'data: [DONE]') {
            yield { content: '', done: true };
            return;
          }
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed?.choices?.[0]?.delta;
              const content = delta?.content ?? '';
              const finishReason = parsed?.choices?.[0]?.finish_reason;
              yield {
                content,
                done: finishReason != null,
                model: parsed?.model,
              };
              if (finishReason != null) return;
            } catch {
              // malformed JSON line – skip
            }
          }
        }
      }
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            yield {
              content: parsed?.choices?.[0]?.delta?.content ?? '',
              done: true,
              model: parsed?.model,
            };
          } catch {
            // ignore trailing garbage
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse an Anthropic SSE stream.
   */
  static async *parseAnthropicStream(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): AsyncGenerator<AIStreamChunk> {
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
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') {
            yield { content: '', done: true };
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            let text = '';
            if (parsed?.type === 'content_block_delta') text = parsed.delta?.text ?? '';
            else if (parsed?.delta?.type === 'text_delta') text = parsed.delta?.text ?? '';
            const isDone = parsed?.type === 'message_stop' || parsed?.type === 'message_delta';
            yield { content: text, done: isDone, model: parsed?.model };
            if (isDone) return;
          } catch {
            // malformed
          }
        }
      }
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            yield { content: parsed?.delta?.text ?? '', done: true, model: parsed?.model };
          } catch {
            // ignore
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse an Ollama ND-JSON stream (one JSON object per line, no SSE prefix).
   */
  static async *parseOllamaStream(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): AsyncGenerator<AIStreamChunk> {
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
            yield { content: text, done: isDone, model: parsed?.model };
            if (isDone) return;
          } catch {
            // malformed
          }
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          yield { content: parsed?.message?.content ?? '', done: true, model: parsed?.model };
        } catch {
          // ignore trailing garbage
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Return an AsyncGenerator that delegates to the provider's own stream method.
   * This ensures a single unified interface regardless of protocol details.
   */
  static async *createUnifiedStream(
    provider: BaseAIProvider,
    request: AIChatRequest
  ): AsyncGenerator<AIStreamChunk> {
    yield* provider.stream(request);
  }
}
