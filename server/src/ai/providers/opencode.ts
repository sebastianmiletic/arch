// providers/opencode.ts — OpenCode CLI Provider Adapter
// ---------------------------------------------------------------------------
import { spawn } from 'child_process';

const OPENCODE_BIN = process.env.OPENCODE_BIN || 'opencode';

import {
  type AIProviderConfig,
  type AIChatRequest,
  type AIChatResponse,
  type AIStreamChunk,
  type AIModel,
  type AIConnectionTest,
} from '../types.js';
import { BaseAIProvider } from './base.js';

export class OpencodeProvider extends BaseAIProvider {
  id = 'opencode';
  name = 'OpenCode';
  type = 'opencode';

  constructor(config: AIProviderConfig) {
    super(config);
  }

  getCapabilities(): string[] {
    return this.config.capabilities?.length
      ? this.config.capabilities
      : ['chat', 'stream', 'tool_call'];
  }

  private execOpencode(args: string[], input?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(OPENCODE_BIN, args, {
        env: { ...process.env },
        shell: false,
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      if (input !== undefined) {
        child.stdin.write(input);
        child.stdin.end();
      }
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`OpenCode exited with ${code}${stderr ? ': ' + stderr : ''}`));
        } else {
          resolve(stdout);
        }
      });
      child.on('error', (err) => reject(err));
    });
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const inputText = request.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const output = await this.execOpencode(['run', '--format', 'json'], inputText);
    const lines = output.split('\n').filter(Boolean);
    let content = '';
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'text' && obj.part?.text) {
          content += obj.part.text;
        }
      } catch {
        // ignore non-JSON lines
      }
    }
    return {
      content,
      model: request.model ?? this.config.defaultModel,
    };
  }

  async *stream(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    const inputText = request.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const child = spawn(OPENCODE_BIN, ['run', '--format', 'json'], {
      env: { ...process.env },
      shell: false,
      windowsHide: true,
    });

    let buffer = '';
    let done = false;

    child.stdin.write(inputText);
    child.stdin.end();

    // Handle stdout
    child.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();
    });

    // Handle stderr
    child.stderr.on('data', (data: Buffer) => {
      buffer += data.toString(); // treat stderr as error output lines
    });

    child.on('close', () => {
      done = true;
    });

    while (!done || buffer.length > 0) {
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          yield {
            content: obj.part?.text ?? '',
            done: false,
            model: request.model ?? this.config.defaultModel,
          };
        } catch {
          yield {
            content: '',
            done: false,
            model: request.model ?? this.config.defaultModel,
          };
        }
      }
      if (!done) {
        await new Promise((res) => setTimeout(res, 50));
      }
    }

    yield {
      content: '',
      done: true,
      model: request.model ?? this.config.defaultModel,
    };
  }

  async listModels(): Promise<AIModel[]> {
    return [
      {
        id: 'opencode-default',
        name: 'OpenCode Default',
        provider: this.id,
      },
    ];
  }

  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error('OpenCode does not expose an embedding endpoint.');
  }

  buildHeaders(): Record<string, string> {
    return {};
  }

  async test(): Promise<AIConnectionTest> {
    const start = Date.now();
    try {
      const out = await this.execOpencode(['--version']);
      return {
        ok: true,
        latency: Date.now() - start,
        models: [{ id: 'opencode-default', name: 'OpenCode Default', provider: this.id }],
        capabilities: this.getCapabilities(),
        streaming: this.supports('stream'),
        version: out.trim(),
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
