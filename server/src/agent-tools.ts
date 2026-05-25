import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';

// ─── Agent Tools ──────
// The AI can read, write, edit, delete, and run commands within the project root.
// All paths are sandboxed to prevent directory traversal.

function resolveSandbox(root: string, filePath: string): string {
  const resolved = path.resolve(root, filePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes project root');
  }
  return resolved;
}

export interface ToolResult {
  ok: boolean;
  output?: string;
  error?: string;
}

// ─── FILE TOOLS ───

export async function readFile(root: string, filePath: string): Promise<ToolResult> {
  try {
    const full = resolveSandbox(root, filePath);
    const content = await fs.readFile(full, 'utf-8');
    return { ok: true, output: content };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function writeFile(root: string, filePath: string, content: string): Promise<ToolResult> {
  try {
    const full = resolveSandbox(root, filePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf-8');
    return { ok: true, output: `Wrote ${full}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function editFile(root: string, filePath: string, oldString: string, newString: string): Promise<ToolResult> {
  try {
    const full = resolveSandbox(root, filePath);
    const content = await fs.readFile(full, 'utf-8');
    if (!content.includes(oldString)) {
      return { ok: false, error: `Search string not found in ${full}` };
    }
    const replaced = content.split(oldString).join(newString);
    await fs.writeFile(full, replaced, 'utf-8');
    return { ok: true, output: `Edited ${full}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function deleteFile(root: string, filePath: string): Promise<ToolResult> {
  try {
    const full = resolveSandbox(root, filePath);
    await fs.unlink(full);
    return { ok: true, output: `Deleted ${full}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function listFiles(root: string, relativePath = '.'): Promise<ToolResult> {
  try {
    const full = resolveSandbox(root, relativePath);
    const entries = await fs.readdir(full, { withFileTypes: true });
    const lines = entries.map(e => {
      const size = e.isFile() ? ' (file)' : '/';
      return `${e.name}${size}`;
    });
    return { ok: true, output: lines.join('\n') };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function getFileTree(root: string): Promise<ToolResult> {
  try {
    const entries: { path: string; type: string }[] = [];
    async function walk(dir: string, prefix = '') {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const rel = path.join(prefix, item.name);
        if (item.isDirectory()) {
          if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
          entries.push({ path: rel + '/', type: 'dir' });
          await walk(path.join(dir, item.name), rel);
        } else {
          entries.push({ path: rel, type: 'file' });
        }
      }
    }
    await walk(root);
    return { ok: true, output: entries.map(e => `${e.type === 'dir' ? '[D]' : '[F]'} ${e.path}`).join('\n') };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── SHELL TOOL ───

export async function runCommand(root: string, command: string): Promise<ToolResult> {
  return new Promise((resolve) => {
    const timeoutMs = 30000;
    const [cmd, ...args] = command.split(' ').filter(Boolean);
    if (!cmd) {
      resolve({ ok: false, error: 'Empty command' });
      return;
    }
    const child = execFile(cmd, args, { cwd: root, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: `${error.message}\n${stderr}` });
      } else {
        resolve({ ok: true, output: (stdout + '\n' + stderr).trim() || '(no output)' });
      }
    });
    setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: 'Command timed out after 30s' });
    }, timeoutMs + 2000);
  });
}

// ─── CONTEXT BUILDER ───

export async function getProjectContext(root: string): Promise<ToolResult> {
  try {
    const entries: string[] = [];
    let fileCount = 0;
    let dirCount = 0;
    async function walk(dir: string, prefix = '') {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
        const rel = path.join(prefix, item.name);
        if (item.isDirectory()) {
          dirCount++;
          entries.push(`[D] ${rel}/`);
          if (entries.length < 200) await walk(path.join(dir, item.name), rel);
        } else {
          fileCount++;
          if (entries.length < 200) entries.push(`[F] ${rel}`);
        }
      }
    }
    await walk(root);
    const summary = `Project: ${root}\nFiles: ${fileCount} | Dirs: ${dirCount}\n\n${entries.slice(0, 100).join('\n')}${entries.length > 100 ? '\n... (' + (entries.length - 100) + ' more)' : ''}`;
    return { ok: true, output: summary };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── TOOL DEFINITIONS FOR AI ───

export const TOOL_DEFINITIONS = `
You have access to the following tools to work on the user's project. Use them by emitting XML blocks in your response.

<tool name="getProjectContext"><param name="root">.</param></tool>
  → Returns a summary of the project: file count, directories, and top-level file listing.

<tool name="readFile"><param name="path">relative/path/from/project</param></tool>
  → Returns the full content of a file.

<tool name="writeFile"><param name="path">relative/path</param><param name="content">file content here</param></tool>
  → Writes/overwrites a file. Creates directories automatically.

<tool name="editFile"><param name="path">relative/path</param><param name="oldString">exact text to find</param><param name="newString">replacement text</param></tool>
  → Replaces the first occurrence of oldString with newString in a file.

<tool name="deleteFile"><param name="path">relative/path</param></tool>
  → Deletes a file.

<tool name="listFiles"><param name="path">relative/path</param></tool>
  → Lists files and directories at a path.

<tool name="runCommand"><param name="command">command string</param></tool>
  → Runs a shell command in the project root. Timeout: 30s.

IMPORTANT:
- Always wrap tool calls in self-contained XML like: <tool name="readFile"><param name="path">src/App.tsx</param></tool>
- You may emit multiple tool calls in one message.
- After you emit a tool, I will execute it and give you the results. Do NOT guess file contents.
- Never emit markdown code blocks for tools — use raw XML only.
`;

// ─── DISPATCHER ───

export async function executeTool(root: string, name: string, params: Record<string, string>): Promise<ToolResult> {
  switch (name) {
    case 'getProjectContext': return getProjectContext(root);
    case 'readFile': return readFile(root, params.path);
    case 'writeFile': return writeFile(root, params.path, params.content);
    case 'editFile': return editFile(root, params.path, params.oldString, params.newString);
    case 'deleteFile': return deleteFile(root, params.path);
    case 'listFiles': return listFiles(root, params.path || '.');
    case 'runCommand': return runCommand(root, params.command);
    default: return { ok: false, error: `Unknown tool: ${name}` };
  }
}

// ─── PARSER ───
// Extract <tool name="...">...</tool> blocks from assistant response

export function parseToolCalls(text: string): { name: string; params: Record<string, string> }[] {
  const calls: { name: string; params: Record<string, string> }[] = [];
  const regex = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1];
    const inner = match[2];
    const params: Record<string, string> = {};
    const paramRegex = /<param\s+name="([^"]+)">([\s\S]*?)<\/param>/g;
    let pMatch;
    while ((pMatch = paramRegex.exec(inner)) !== null) {
      params[pMatch[1]] = pMatch[2].trim();
    }
    calls.push({ name, params });
  }
  return calls;
}

// Strip tool calls from displayed message text
export function stripToolCalls(text: string): string {
  return text.replace(/<tool[\s\S]*?<\/tool>/g, '').trim();
}
