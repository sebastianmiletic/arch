import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { broadcast } from './ws-shared.js';
import {
  getProviders, updateProvider, getSessions, createSession, deleteSession,
  getMessages, addMessage, getCodeChanges, addCodeChange,
  getLatestLoopState, createLoopState, updateLoopState,
  getLoopLogs, addLoopLog,
} from './db.js';
import { testProvider, listOllamaModels, sendSingleMessage } from './providers.js';
import { getFeatures, updateFeature, seedFeatures } from './features.js';
import { runAgentChat } from './agent.js';
import type { ProviderConfig, Message, LoopState, LoopLog } from './types.js';
import { db } from './db.js';

export const router = Router();

const OPENCODE_BIN = process.env.OPENCODE_BIN || 'opencode';

// ========== Providers ==========

router.get('/providers', (_req: Request, res: Response) => {
  res.json(getProviders());
});

router.patch('/providers/:id', (req: Request, res: Response) => {
  updateProvider(req.params.id as string, req.body);
  res.json({ ok: true });
});

router.post('/providers/:id/test', async (req: Request, res: Response) => {
  try {
    const result = await testProvider(req.params.id as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/providers/:id/models', async (req: Request, res: Response) => {
  try {
    if (req.params.id === 'ollama') {
      const models = await listOllamaModels();
      res.json({ models });
    } else if (req.params.id === 'opencode') {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(OPENCODE_BIN, ['models'], { timeout: 10000, encoding: 'utf-8' });
      res.json({ models: stdout.trim().split('\n').filter(Boolean) });
    } else {
      res.json({ models: [] });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========== Chat Sessions ==========

router.get('/sessions', (_req: Request, res: Response) => {
  res.json(getSessions());
});

router.post('/sessions', (req: Request, res: Response) => {
  const s = createSession({
    ...req.body,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.json(s);
});

router.delete('/sessions/:id', (req: Request, res: Response) => {
  deleteSession(req.params.id as string);
  res.json({ ok: true });
});

// ========== Messages ==========

router.get('/sessions/:id/messages', (req: Request, res: Response) => {
  res.json(getMessages(req.params.id as string));
});

router.post('/chat', async (req: Request, res: Response) => {
  const { sessionId, content, providerId, projectRoot } = req.body;
  const providers = getProviders();
  const rawProvider = providers.find((p: ProviderConfig) => p.id === providerId) || providers.find((p: ProviderConfig) => p.enabled);

  if (!rawProvider) {
    return res.status(400).json({ error: 'No active provider configured' });
  }

  runAgentChat(rawProvider, sessionId, content, projectRoot).catch(console.error);

  res.json({ ok: true, status: 'running', sessionId });
});

// ========== Code Changes ==========

router.get('/changes', (_req: Request, res: Response) => {
  res.json(getCodeChanges());
});

router.post('/changes', (req: Request, res: Response) => {
  const change = req.body;
  addCodeChange(change);
  res.json({ ok: true });
});

// ========== Loop ==========

router.get('/loop', (_req: Request, res: Response) => {
  res.json(getLatestLoopState());
});

router.post('/loop', (req: Request, res: Response) => {
  const state: LoopState = {
    id: randomUUID(),
    iteration: 0,
    stage: 'analyze',
    status: 'running',
    task: req.body.task || '',
    plan: [],
    progress: 0,
    logs: [],
    startTime: new Date().toISOString(),
  };
  createLoopState(state);
  res.json(state);
});

// ========== Features ==========

router.get('/features', (_req: Request, res: Response) => {
  seedFeatures();
  res.json(getFeatures());
});

router.patch('/features/:id', (req: Request, res: Response) => {
  updateFeature(req.params.id as string, req.body);
  res.json({ ok: true });
});

// ========== Single Shot ==========

router.post('/ai/ask', async (req: Request, res: Response) => {
  try {
    const { prompt, providerId, systemPrompt } = req.body;
    const providers = getProviders();
    const provider = providers.find((p: ProviderConfig) => p.id === providerId) || providers.find((p: ProviderConfig) => p.enabled);
    if (!provider) {
      return res.status(400).json({ error: 'No active provider' });
    }
    const result = await sendSingleMessage(provider, systemPrompt || 'You are a helpful coding assistant.', prompt);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========== File Operations ==========

router.get('/files/content', (req: Request, res: Response) => {
  const filePath = typeof req.query.path === 'string' ? req.query.path : '';
  if (!filePath) return res.status(400).json({ error: 'Missing path' });
  try {
    const content = readFileSync(filePath, 'utf-8');
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/files/content', (req: Request, res: Response) => {
  const { path: filePath, content } = req.body || {};
  if (!filePath || content === undefined) return res.status(400).json({ error: 'Missing path or content' });
  try {
    writeFileSync(filePath, content, 'utf-8');
    res.json({ ok: true, path: filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/files', (req: Request, res: Response) => {
  const root = typeof req.query.root === 'string' ? req.query.root : process.cwd();
  try {
    const entries: any[] = [];
    function walk(dir: string, prefix = '') {
      const items = require('fs').readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist' || item.name === 'build') continue;
        const rel = path.join(prefix, item.name);
        if (item.isDirectory()) {
          entries.push({ name: item.name, path: rel, type: 'directory' });
          // limit depth
          if (rel.split('/').length < 5) walk(path.join(dir, item.name), rel);
        } else {
          entries.push({ name: item.name, path: rel, type: 'file' });
        }
      }
    }
    walk(root);
    res.json({ files: entries, root });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========== Project Stats ==========

router.get('/project-stats', (req: Request, res: Response) => {
  const root = typeof req.query.root === 'string' ? req.query.root : process.cwd();
  try {
    const pkgPath = path.join(root, 'package.json');
    let devUrl: string | null = null;
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.dev?.includes('vite')) devUrl = 'http://localhost:5173';
      else if (pkg.scripts?.dev?.includes('next')) devUrl = 'http://localhost:3000';
      else if (pkg.scripts?.start) devUrl = 'http://localhost:3000';
    }
    res.json({ root, devUrl, hasPackageJson: existsSync(pkgPath) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CodeView Changes ==========

router.get('/codeview/changes', (_req: Request, res: Response) => {
  res.json(getCodeChanges(50));
});

router.get('/codeview/changes/:sessionId', (req: Request, res: Response) => {
  res.json(getCodeChanges(50));
});

// ========== App Actions ==========

router.get('/app/actions', (_req: Request, res: Response) => {
  res.json({ actions: [] });
});

router.post('/app/actions', (req: Request, res: Response) => {
  const { type, data } = req.body || {};
  if (type) broadcast({ type: `app:${type}`, ...data });
  res.json({ ok: true });
});

// ========== Health ==========

router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ========== Verify ==========

router.get('/verify', (_req: Request, res: Response) => {
  res.json([]);
});

router.post('/verify', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ========== Errors ==========

router.get('/errors', (_req: Request, res: Response) => {
  res.json([]);
});

router.post('/errors', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.post('/errors/:id/fix', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ========== Test ==========

router.post('/test', (_req: Request, res: Response) => {
  res.json({ ok: true, results: [] });
});

// ========== OpenCode ==========

// List models
router.get('/opencode/models', async (_req: Request, res: Response) => {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(OPENCODE_BIN, ['models'], { timeout: 10000, encoding: 'utf-8' });
    const lines = stdout.trim().split('\n').filter(Boolean);
    res.json({ models: lines });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list models' });
  }
});

// List agents
router.get('/opencode/agents', async (_req: Request, res: Response) => {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(OPENCODE_BIN, ['agent', 'list'], { timeout: 10000, encoding: 'utf-8' });
    const lines = stdout.trim().split('\n').filter(Boolean);
    const agents = lines.map(line => {
      const parts = line.split(/\s+/);
      const name = parts[0] || '';
      const primary = parts.includes('(primary)') || parts.includes('*');
      return { name, primary };
    });
    res.json({ agents });
  } catch (err: any) {
    res.json({ agents: [{ name: 'build', primary: true }, { name: 'plan', primary: false }] });
  }
});

// List sessions
router.get('/opencode/sessions', async (_req: Request, res: Response) => {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(OPENCODE_BIN, ['session', 'list', '--format', 'json'], { timeout: 10000, encoding: 'utf-8' });
    const sessions = JSON.parse(stdout.trim());
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list sessions' });
  }
});

// Run OpenCode with streaming
router.post('/opencode/run', async (req: Request, res: Response) => {
  const { prompt, model, agent, session, dir, continueSession } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const args = ['run', '--format', 'json'];
  if (model) args.push('-m', model);
  if (agent) args.push('--agent', agent);
  if (session) args.push('-s', session);
  if (dir) args.push('--dir', dir);
  if (continueSession) args.push('-c');

  const { spawn } = await import('child_process');
  const child = spawn(OPENCODE_BIN, args, {
    env: process.env,
    shell: false,
    windowsHide: true,
  });

  child.stdin.write(prompt);
  child.stdin.end();

  let stderr = '';
  child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

  child.stdout.pipe(res);
  child.on('close', (code) => {
    if (code !== 0 && !res.writableEnded) {
      res.write(JSON.stringify({ type: 'error', error: stderr || `OpenCode exited with code ${code}` }) + '\n');
    }
    if (!res.writableEnded) res.end();
  });

  child.on('error', (err) => {
    if (!res.writableEnded) {
      res.write(JSON.stringify({ type: 'error', error: err.message }) + '\n');
      res.end();
    }
  });

  req.on('close', () => { child.kill(); });
});

// Export OpenCode session
router.get('/opencode/export/:sessionId', async (req: Request, res: Response) => {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(OPENCODE_BIN, ['export', req.params.sessionId as string], { timeout: 10000, encoding: 'utf-8' });
    res.json(JSON.parse(stdout.trim()));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export session' });
  }
});

// Import OpenCode session
router.post('/opencode/import', async (req: Request, res: Response) => {
  try {
    const { file } = req.body;
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(OPENCODE_BIN, ['import', file], { timeout: 10000, encoding: 'utf-8' });
    res.json({ output: stdout.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to import session' });
  }
});

// OpenCode version
router.get('/opencode/version', async (_req: Request, res: Response) => {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(OPENCODE_BIN, ['--version'], { timeout: 10000, encoding: 'utf-8' });
    res.json({ version: stdout.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get version' });
  }
});

// ========== Swarm ==========

router.post('/swarm/ask', async (req: Request, res: Response) => {
  try {
    const { agents, prompt, systemPrompt } = req.body;
    const providers = getProviders();
    const results: any[] = [];
    for (const agent of agents || []) {
      const provider = providers.find((p: ProviderConfig) => p.id === agent.providerId) || providers.find((p: ProviderConfig) => p.enabled);
      if (!provider) {
        results.push({ agentId: agent.id, content: `Provider ${agent.providerId} not available`, tokens: 0, latency: 0, timestamp: new Date().toISOString() });
        continue;
      }
      const start = Date.now();
      try {
        const result = await sendSingleMessage(provider, systemPrompt || 'You are a helpful assistant.', prompt, agent.model);
        results.push({ agentId: agent.id, content: result.content, tokens: result.tokens || 0, latency: Date.now() - start, timestamp: new Date().toISOString() });
      } catch (err: any) {
        results.push({ agentId: agent.id, content: `Error: ${err.message}`, tokens: 0, latency: Date.now() - start, timestamp: new Date().toISOString() });
      }
    }
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========== Web Search / Fetch ==========

async function fetchPage(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Arch-Code-Studio/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let body = await res.text();
  body = body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return body.slice(0, 50000);
}

router.post('/web/fetch', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const content = await fetchPage(url);
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/web/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    const { search } = await import('./skills/brave.js');
    const results = await search(query);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========== Project Architecture Graph ==========

router.get('/project-graph', async (req: Request, res: Response) => {
  const root = typeof req.query.root === 'string' ? req.query.root : process.cwd();
  try {
    const { buildProjectGraph } = await import('./arch-graph.js');
    const graph = buildProjectGraph(root);
    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========== Skills ==========

router.post('/skills/terminal', async (req: Request, res: Response) => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const { command = 'echo no command' } = req.body || {};
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 30000, env: process.env });
    res.json({ output: stdout + stderr });
  } catch (err: any) {
    res.status(500).json({ error: err.stderr || err.message });
  }
});

router.post('/skills/git', async (req: Request, res: Response) => {
  const { spawn } = await import('child_process');
  const { command = 'status' } = req.body || {};
  const child = spawn('git', [command], { cwd: process.cwd(), env: process.env });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
  child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
  child.on('close', (code) => {
    if (code === 0) res.json({ output: stdout, stderr });
    else res.status(500).json({ error: stderr || `Git exited with code ${code}` });
  });
});

// ========== UI Tester Proxy ==========

router.get('/uitester/proxy', async (req: Request, res: Response) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  const bridge = typeof req.query.bridge === 'string' ? decodeURIComponent(req.query.bridge) : '';
  if (!url) return res.status(400).send('Missing url');
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    let body = await response.text();
    if (body.includes('<head>')) {
      body = body.replace('<head>', '<head>' + bridge);
    } else if (body.includes('<html>')) {
      body = body.replace('<html>', '<html>' + bridge);
    } else {
      body = bridge + body;
    }
    res.set('Content-Type', response.headers.get('content-type') || 'text/html');
    res.send(body);
  } catch (err: any) {
    res.status(500).send(`Failed to proxy: ${err.message}`);
  }
});
