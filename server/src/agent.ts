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

const MAX_TURNS = 15;
const PROJECT_ROOT_ENV = process.env.PROJECT_ROOT || '';

const SYSTEM_PROMPT = `You are Arch, an expert AI engineer embedded inside the Arch Code Studio IDE with full control over the user's project and the IDE itself.

CRITICAL INSTRUCTION: When the user asks you to write, modify, create, edit, refactor, fix, or change any code — you MUST use your file tools. NEVER send code in a text response. The user wants you to directly edit their project files, not give them code snippets to copy.

You also have the unique ability to CONTROL THE IDE UI directly. You can switch panels, launch dev servers, open previews, and more. When the user asks you to:
- Preview a website: use launchLocalServer + openUrlInTester + switchToPanel(uitester)
- Open file in editor: use switchToPanel(codeview) 
- Run tests: use switchToPanel(testing)
- Search code: use switchToPanel(search)
- Show architecture: use switchToPanel(arch)
- View gitHub: use switchToPanel(github)
- Open settings: use switchToPanel(settings)

${TOOL_DEFINITIONS}

RULES:
1. Before making changes, ALWAYS read the file first.
2. When asked to modify code, search for the exact string to replace.
3. After any file change, report what you did in plain text (NOT in code blocks).
4. If a command fails, explain what went wrong and suggest a fix.
5. Keep responses concise and focused on the task.
6. Prefer editFile over writeFile for small changes.
7. Use runCommand for: builds, tests, linting, dependency installs.
8. IMPORTANT: You operate on the project that the user has OPENED in Arch.
9. NEVER wrap tool calls in markdown code blocks — use raw XML only.
10. NEVER write code in chat messages — always write files using tools.
11. For web/apps: after writing files, preview the result automatically using previewProject or launchLocalServer+switchToPanel.
12. When doing multi-file changes, read all files first, then make edits.
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

      // ─── Handle UI control tools (auto-execute frontend actions) ───
      if (toolRes.metadata?.action) {
        const action = toolRes.metadata.action;
        const meta = toolRes.metadata;

        switch (action) {
          case 'switchPanel': {
            broadcast({ type: 'app:switchPanel', panel: meta.panel });
            break;
          }
          case 'launchServer': {
            broadcast({ type: 'app:launchServer', url: meta.url, port: meta.port });
            break;
          }
          case 'openUrlInTester': {
            broadcast({ type: 'app:openUrlInTester', url: meta.url });
            break;
          }
          case 'previewProject': {
            broadcast({ type: 'app:previewProject', command: meta.command, file: meta.file });
            break;
          }
        }
      }

      // ─── Record file changes for CodeView addon ───
      const filePath = call.params.path;
      if (filePath && (call.name === 'writeFile' || call.name === 'editFile' || call.name === 'deleteFile' || call.name === 'renameFile')) {
        const changeType = call.name === 'deleteFile' ? 'remove' : call.name === 'writeFile' ? 'add' : call.name === 'renameFile' ? 'rename' : 'modify';
        const changeId = randomUUID();
        const oldContent = call.params.oldString || '';
        const newContent = call.params.newString || call.params.content || '';
        
        addCodeChange({
          id: changeId,
          filePath,
          changeType,
          lineStart: 0, lineEnd: 0,
          oldContent,
          newContent,
          timestamp: new Date().toISOString(),
          reason: 'AI: ' + userContent.slice(0, 80),
          status: 'applied',
        });

        // Get file content for preview
        let fileContent = '';
        try {
          const { readFile } = await import('./agent-tools.js');
          const res = await readFile(root, filePath);
          if (res.ok) fileContent = res.output || '';
        } catch {}

        // Broadcast for CodeView addon and file tree updates
        broadcast({
          type: 'change',
          data: { filePath, changeType, changeId, oldContent, newContent, fileContent },
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

export async function runAgentChatWithAutoActions(
  provider: ProviderConfig,
  sessionId: string,
  userContent: string,
  projectRoot?: string
): Promise<void> {
  // Wrapper that can intercept tool results and auto-perform UI actions
  // e.g., if user says "create a website and preview it", the AI should:
  //   1. Create the files
  //   2. Launch local server
  //   3. Switch to UI tester panel
  await runAgentChat(provider, sessionId, userContent, projectRoot);
}

interface CodeChange {
  id: string;
  filePath: string;
  changeType: 'add' | 'modify' | 'remove' | 'rename';
  oldContent: string;
  newContent: string;
  timestamp: string;
  reason: string;
  fileContent?: string;
}

// Get recent changes for CodeView addon
export function getRecentChanges(limit = 50): CodeChange[] {
  const { db } = require('./db.js');
  const rows = db.prepare('SELECT * FROM code_changes ORDER BY timestamp DESC LIMIT ?').all(limit);
  return rows.map((r: any) => ({
    id: r.id,
    filePath: r.file_path,
    changeType: r.change_type,
    oldContent: r.old_content,
    newContent: r.new_content,
    timestamp: r.timestamp,
    reason: r.reason,
  }));
}
