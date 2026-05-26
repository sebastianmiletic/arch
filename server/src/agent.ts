import { randomUUID } from 'crypto';
import { addMessage, addCodeChange } from './db.js';
import { chatWithProvider } from './providers.js';
import type { ProviderConfig, Message } from './types.js';
import {
  TOOL_DEFINITIONS,
  executeTool,
  stripToolCalls,
  parseToolCalls,
} from './agent-tools.js';
import { broadcast } from './ws-shared.js';

const MAX_TURNS = 10;
const PROJECT_ROOT_ENV = process.env.PROJECT_ROOT || '';

const SYSTEM_PROMPT = `You are Arch, an expert software engineer embedded inside the Arch Code Studio IDE with full control over the user's project.

CRITICAL INSTRUCTION: When the user asks you to write, modify, create, edit, refactor, fix, or change any code — you MUST use your file tools. NEVER send code in a text response. The user wants you to directly edit their project files, not give them code snippets to copy.

${TOOL_DEFINITIONS}

RULES:
1. Before making changes, ALWAYS read the file first.
2. When asked to modify code, search for the exact string to replace.
3. After any file change (write, edit, delete), report what you did in plain text.
4. If a command fails, explain what went wrong and suggest a fix.
5. Keep responses concise and focused on the task.
6. Prefer editFile over writeFile for small changes.
7. Use runCommand for: builds, tests, linting, dependency installs.
8. IMPORTANT: You operate on the project that the user has OPENED in Arch. Use your tools to explore and edit that project.
9. NEVER wrap tool calls in markdown code blocks — use raw XML only.
10. NEVER write code in chat messages — always write files using tools.
`;

export async function runAgentChat(
  provider: ProviderConfig,
  sessionId: string,
  userContent: string,
  projectRoot?: string
): Promise<void> {
  const root = projectRoot || PROJECT_ROOT_ENV || process.cwd();
  const turnHistory: Message[] = [];

  const userMsg: Message = {
    id: randomUUID(), role: 'user', content: userContent,
    timestamp: new Date().toISOString(),
    provider: provider.name, model: provider.defaultModel,
  };
  addMessage({ ...userMsg, sessionId });
  turnHistory.push(userMsg);

  broadcast({ type: 'chat:thinking', sessionId });

  let turn = 0;
  while (turn < MAX_TURNS) {
    turn++;

    // Build messages with system prompt
    const systemMsg: Message = {
      id: 'sys', role: 'system', content: SYSTEM_PROMPT,
      timestamp: new Date().toISOString(),
    };
    const fullMessages = [systemMsg, ...turnHistory];

    const result = await chatWithProvider(provider, fullMessages);

    const calls = parseToolCalls(result.content);

    if (calls.length === 0) {
      // No tool calls — done
      const assistantMsg: Message = {
        id: randomUUID(), role: 'assistant', content: result.content,
        timestamp: new Date().toISOString(),
        provider: provider.name, model: result.model,
      };
      addMessage({ ...assistantMsg, sessionId });
      broadcast({ type: 'chat:done', sessionId });
      return;
    }

    // Tools detected — save stripped display message
    const stripped = stripToolCalls(result.content);
    if (stripped.length > 0) {
      const displayMsg: Message = {
        id: randomUUID(), role: 'assistant', content: stripped,
        timestamp: new Date().toISOString(),
        provider: provider.name, model: result.model,
      };
      addMessage({ ...displayMsg, sessionId });
      turnHistory.push(displayMsg);
    }

    // Execute tools
    const toolResults: string[] = [];
    for (const call of calls) {
      broadcast({ type: 'chat:tool', sessionId, tool: call.name, params: call.params });
      const toolRes = await executeTool(root, call.name, call.params);

      // Record file changes
      const filePath = call.params.path;
      if (filePath && (call.name === 'writeFile' || call.name === 'editFile' || call.name === 'deleteFile')) {
        addCodeChange({
          id: randomUUID(),
          filePath,
          changeType: call.name === 'deleteFile' ? 'remove' : call.name === 'writeFile' ? 'add' : 'modify',
          lineStart: 0, lineEnd: 0,
          oldContent: call.params.oldString || '',
          newContent: call.params.newString || call.params.content || '',
          timestamp: new Date().toISOString(),
          reason: 'AI: ' + userContent.slice(0, 80),
          status: 'applied',
        });
        broadcast({
          type: 'change',
          data: { filePath, changeType: call.name === 'deleteFile' ? 'remove' : 'modify' }
        });
      }

      toolResults.push(
        `Tool: ${call.name}\nResult: ${toolRes.ok ? 'SUCCESS' : 'ERROR'}\n${toolRes.output || toolRes.error || ''}`
      );
    }

    // Feed tool results back as next user message
    const observationMsg: Message = {
      id: randomUUID(), role: 'user',
      content: `Tool results (${toolResults.length} operations):\n\n${toolResults.join('\n---\n')}`,
      timestamp: new Date().toISOString(),
      provider: 'tool', model: 'tool',
    };
    addMessage({ ...observationMsg, sessionId });
    turnHistory.push(observationMsg);
  }

  // Budget exhausted
  const stopMsg: Message = {
    id: randomUUID(), role: 'assistant',
    content: '*Max tool call budget reached. Split the request into smaller steps.*',
    timestamp: new Date().toISOString(),
    provider: provider.name, model: provider.defaultModel,
  };
  addMessage({ ...stopMsg, sessionId });
  broadcast({ type: 'chat:done', sessionId });
}
