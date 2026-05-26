import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ─── Unified Tool System ──────
// All tools available to ALL providers (not just OpenCode).
// Supports file operations, UI testing, web search, browsing, git, terminal, etc.

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
  metadata?: Record<string, any>;
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

export async function readFileLines(root: string, filePath: string, offset: number, limit: number): Promise<ToolResult> {
  try {
    const full = resolveSandbox(root, filePath);
    const content = await fs.readFile(full, 'utf-8');
    const lines = content.split('\n');
    const start = Math.max(0, offset - 1);
    const end = Math.min(lines.length, start + limit);
    const sliced = lines.slice(start, end);
    return { ok: true, output: sliced.join('\n'), metadata: { totalLines: lines.length, returned: sliced.length, startLine: start + 1 } };
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

export async function editFile(root: string, filePath: string, oldString: string, newString: string, replaceAll = false): Promise<ToolResult> {
  try {
    const full = resolveSandbox(root, filePath);
    const content = await fs.readFile(full, 'utf-8');
    if (!content.includes(oldString)) {
      return { ok: false, error: `Search string not found in ${full}` };
    }
    const replaced = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
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

export async function renameFile(root: string, oldPath: string, newPath: string): Promise<ToolResult> {
  try {
    const fullOld = resolveSandbox(root, oldPath);
    const fullNew = resolveSandbox(root, newPath);
    await fs.mkdir(path.dirname(fullNew), { recursive: true });
    await fs.rename(fullOld, fullNew);
    return { ok: true, output: `Renamed ${fullOld} -> ${fullNew}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function listFiles(root: string, relativePath = '.'): Promise<ToolResult> {
  try {
    const full = resolveSandbox(root, relativePath);
    const entries = await fs.readdir(full, { withFileTypes: true });
    const lines = entries.map(e => e.isDirectory() ? `${e.name}/` : e.name);
    return { ok: true, output: lines.join('\n') };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function getFileTree(root: string, maxDepth = 5): Promise<ToolResult> {
  try {
    const entries: { path: string; type: string }[] = [];
    async function walk(dir: string, prefix = '', depth: number) {
      if (depth > maxDepth) return;
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const rel = path.join(prefix, item.name);
        if (item.isDirectory()) {
          if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
          entries.push({ path: rel + '/', type: 'dir' });
          await walk(path.join(dir, item.name), rel, depth + 1);
        } else {
          entries.push({ path: rel, type: 'file' });
        }
      }
    }
    await walk(root, '', 1);
    return { ok: true, output: entries.map(e => `${e.type === 'dir' ? '[D]' : '[F]'} ${e.path}`).join('\n') };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function globFiles(root: string, pattern: string): Promise<ToolResult> {
  try {
    // @ts-ignore
    const globMod = await import('glob');
    const glob = globMod.glob || globMod.default?.glob || globMod;
    const matches = glob.sync ? glob.sync(pattern, { cwd: root, absolute: false }) : [];
    return { ok: true, output: matches.join('\n') };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function searchFiles(root: string, query: string, pattern?: string): Promise<ToolResult> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    let cmd = `cd "${root}" && rg -n "${query}" --max-columns 200`;
    if (pattern) cmd += ` -g "${pattern}"`;
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    return { ok: true, output: stdout.trim() };
  } catch (e: any) {
    return { ok: false, error: e.stderr || e.message };
  }
}

// ─── SHELL TOOL ───

export async function runCommand(root: string, command: string, timeoutMs = 30000): Promise<ToolResult> {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.trim().split(/\s+/);
    if (!cmd) {
      resolve({ ok: false, error: 'Empty command' });
      return;
    }
    const child = execFile(cmd, args, { cwd: root, timeout: timeoutMs, shell: false }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: `${error.message}\n${stderr}`.trim(), output: stdout.trim() || undefined });
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

// ─── WEB TOOLS ───

export async function fetchWebUrl(url: string, format: 'text' | 'markdown' | 'html' = 'markdown'): Promise<ToolResult> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Arch-Code-Studio/1.0' } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    let body = await res.text();
    if (format === 'markdown') {
      // Simple HTML-to-text fallback
      body = body
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    } else if (format === 'text') {
      body = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }
    return { ok: true, output: body.slice(0, 100000) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function webSearch(query: string): Promise<ToolResult> {
  try {
    const { search } = await import('./skills/brave.js');
    const results = await search(query);
    return { ok: true, output: JSON.stringify(results, null, 2) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── GIT TOOLS ───

export async function gitStatus(root: string): Promise<ToolResult> {
  return runCommand(root, 'git status --short', 10000);
}

export async function gitDiff(root: string, staged?: boolean): Promise<ToolResult> {
  const cmd = staged ? 'git diff --staged' : 'git diff';
  return runCommand(root, cmd, 10000);
}

export async function gitLog(root: string, limit = 10): Promise<ToolResult> {
  return runCommand(root, `git log --oneline -n ${limit}`, 10000);
}

export async function gitAdd(root: string, paths: string[]): Promise<ToolResult> {
  return runCommand(root, `git add ${paths.map(p => `"${p}"`).join(' ')}`, 10000);
}

export async function gitCommit(root: string, message: string): Promise<ToolResult> {
  return runCommand(root, `git commit -m "${message.replace(/"/g, '\\"')}"`, 10000);
}

export async function gitBranch(root: string): Promise<ToolResult> {
  return runCommand(root, 'git branch -a', 10000);
}

// ─── APP CONTROL TOOLS ───
// These send commands to the frontend via WebSocket

export async function switchToPanel(panelName: 'uitester' | 'codeview' | 'testing' | 'search' | 'github' | 'arch' | 'settings' | 'skills'): Promise<ToolResult> {
  return { ok: true, output: `Switching to ${panelName} panel...`, metadata: { action: 'switchPanel', panel: panelName } };
}

export async function launchLocalServer(root: string, port?: number): Promise<ToolResult> {
  const serverPort = port || 3000;
  return new Promise((resolve) => {
    const child = spawn('python3', ['-m', 'http.server', String(serverPort)], { 
      cwd: root, 
      stdio: 'ignore',
      detached: true 
    });
    child.on('error', (err) => resolve({ ok: false, error: err.message }));
    setTimeout(() => {
      resolve({ ok: true, output: `Server started on http://localhost:${serverPort}`, metadata: { action: 'launchServer', url: `http://localhost:${serverPort}`, port: serverPort } });
    }, 1000);
  });
}

export async function openUrlInTester(url: string): Promise<ToolResult> {
  return { ok: true, output: `Opening ${url} in UI tester...`, metadata: { action: 'openUrlInTester', url } };
}

export async function previewProject(root: string, framework?: string): Promise<ToolResult> {
  try {
    if (existsSync(path.join(root, 'package.json'))) {
      const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
      if (pkg.scripts?.dev) {
        return { ok: true, output: 'Starting dev server...', metadata: { action: 'previewProject', command: 'npm run dev' } };
      }
      if (pkg.scripts?.start) {
        return { ok: true, output: 'Starting project...', metadata: { action: 'previewProject', command: 'npm start' } };
      }
    }
    if (existsSync(path.join(root, 'index.html'))) {
      return { ok: true, output: 'Found index.html', metadata: { action: 'previewProject', file: 'index.html' } };
    }
    return { ok: false, error: 'No previewable project found' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
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
        if (item.name === 'node_modules' || item.name.startsWith('.') || item.name === 'dist' || item.name === 'build') continue;
        const rel = path.join(prefix, item.name);
        if (item.isDirectory()) {
          dirCount++;
          entries.push(`[D] ${rel}/`);
          if (entries.length < 150) await walk(path.join(dir, item.name), rel);
        } else {
          fileCount++;
          if (entries.length < 150) entries.push(`[F] ${rel}`);
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
You are Arch, an expert AI engineer with full tool access to this IDE. You can directly operate on files, run commands, search the web, and control the UI.

<tool name="getProjectContext"><param name="root">.</param></tool>
  → Returns project overview: file count, directory structure.

<tool name="readFile"><param name="path">relative/path</param></tool>
  → Read a file's full content.

<tool name="readFileLines"><param name="path">relative/path</param><param name="offset">1</param><param name="limit">50</param></tool>
  → Read specific lines from a file (1-indexed).

<tool name="writeFile"><param name="path">relative/path</param><param name="content">file content</param></tool>
  → Create or overwrite a file. Auto-creates directories.

<tool name="editFile"><param name="path">relative/path</param><param name="oldString">exact text</param><param name="newString">replacement</param><param name="replaceAll">false</param></tool>
  → Search-and-replace. Set replaceAll to "true" for multiple occurrences.

<tool name="deleteFile"><param name="path">relative/path</param></tool>
  → Delete a file.

<tool name="renameFile"><param name="oldPath">old/path</param><param name="newPath">new/path</param></tool>
  → Rename/move a file.

<tool name="listFiles"><param name="path">relative/path</param></tool>
  → List directory contents.

<tool name="getFileTree"><param name="maxDepth">5</param></tool>
  → Get recursive project tree.

<tool name="searchFiles"><param name="query">search term</param><param name="pattern">*.ts</param></tool>
  → Search across all files using ripgrep. Pattern is optional glob filter.

<tool name="runCommand"><param name="command">command string</param></tool>
  → Execute shell command in project root. 30s timeout.

<tool name="fetchWebUrl"><param name="url">https://example.com</param><param name="format">markdown</param></tool>
  → Fetch and convert webpage to text/markdown/html.

<tool name="webSearch"><param name="query">search query</param><param name="numResults">8</param></tool>
  → Search the web for information.

<tool name="gitStatus"><param name="root">.</param></tool>
  → Show git status.

<tool name="gitDiff"><param name="root">.</param></tool>
  → Show unstaged changes.

<tool name="gitLog"><param name="root">.</param><param name="limit">10</param></tool>
  → Show recent git commits.

<tool name="gitAdd"><param name="paths">file1.ts,file2.ts</param></tool>
  → Stage files for commit.

<tool name="gitCommit"><param name="message">commit message</param></tool>
  → Commit staged changes.

<tool name="switchToPanel"><param name="panelName">uitester</param></tool>
  → Switch the IDE to a specific panel (uitester, codeview, testing, search, github, arch, settings, skills).

<tool name="launchLocalServer"><param name="port">3000</param></tool>
  → Start a local HTTP server for preview.

<tool name="openUrlInTester"><param name="url">http://localhost:3000</param></tool>
  → Open a URL in the UI Tester panel.

<tool name="previewProject"><param name="framework">react|vue|html</param></tool>
  → Detect and start project's dev server or preview.

IMPORTANT RULES:
1. ALWAYS read files before editing them.
2. For UI/web projects, after creating files, use previewProject or launchLocalServer + openUrlInTester to show the result.
3. Use switchToPanel to open the UI tester when previewing web apps.
4. Use searchFiles to find relevant code before editing.
5. NEVER write code inside text messages — always use tools to write files.
6. You may emit multiple tools in one message.
7. After any file change (write/edit/delete/rename), REPORT what you did in plain text.
8. Use runCommand for: installs, builds, tests, linting.
9. Prefer editFile over writeFile for small changes.
`;

// ─── DISPATCHER ───

export async function executeTool(root: string, name: string, params: Record<string, string>): Promise<ToolResult> {
  switch (name) {
    case 'getProjectContext': return getProjectContext(root);
    case 'readFile': return readFile(root, params.path);
    case 'readFileLines': return readFileLines(root, params.path, parseInt(params.offset || '1'), parseInt(params.limit || '50'));
    case 'writeFile': return writeFile(root, params.path, params.content);
    case 'editFile': return editFile(root, params.path, params.oldString, params.newString, params.replaceAll === 'true');
    case 'deleteFile': return deleteFile(root, params.path);
    case 'renameFile': return renameFile(root, params.oldPath, params.newPath);
    case 'listFiles': return listFiles(root, params.path || '.');
    case 'getFileTree': return getFileTree(root, parseInt(params.maxDepth || '5'));
    case 'searchFiles': return searchFiles(root, params.query, params.pattern);
    case 'runCommand': return runCommand(root, params.command, parseInt(params.timeout || '30000'));
    case 'fetchWebUrl': return fetchWebUrl(params.url, (params.format as any) || 'markdown');
    case 'webSearch': return webSearch(params.query);
    case 'gitStatus': return gitStatus(root);
    case 'gitDiff': return gitDiff(root, params.staged === 'true');
    case 'gitLog': return gitLog(root, parseInt(params.limit || '10'));
    case 'gitAdd': return gitAdd(root, params.paths.split(','));
    case 'gitCommit': return gitCommit(root, params.message);
    case 'switchToPanel': return switchToPanel(params.panelName as any);
    case 'launchLocalServer': return launchLocalServer(root, parseInt(params.port || '3000'));
    case 'openUrlInTester': return openUrlInTester(params.url);
    case 'previewProject': return previewProject(root, params.framework);
    default: return { ok: false, error: `Unknown tool: ${name}` };
  }
}

// ─── PARSER ───

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

export function stripToolCalls(text: string): string {
  return text.replace(/<tool[\s\S]*?<\/tool>/g, '').trim();
}
