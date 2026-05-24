import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import {
  getProviders, updateProvider, getSessions, createSession, deleteSession,
  getMessages, addMessage, getCodeChanges, addCodeChange,
  getLatestLoopState, createLoopState, updateLoopState,
  getLoopLogs, addLoopLog,
} from './db.js';
import { chatWithProvider, testProvider, listOllamaModels, sendSingleMessage } from './providers.js';
import { getFeatures, updateFeature, seedFeatures } from './features.js';
import type { ProviderConfig, Message, LoopState, LoopLog } from './types.js';
import { db } from './db.js';

export const router = Router();

// ========== Providers ==========
router.get('/providers', (_req: Request, res: Response) => {
  res.json(getProviders());
});

router.patch('/providers/:id', (req: Request, res: Response) => {
  updateProvider(req.params.id as string, req.body);
  res.json({ ok: true });
});

router.post('/providers/:id/test', async (req: Request, res: Response) => {
  const providers = getProviders();
  const p = providers.find(x => x.id === req.params.id as string);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  const result = await testProvider(p);
  res.json(result);
});

router.get('/providers/:id/models', async (req: Request, res: Response) => {
  const providers = getProviders();
  const p = providers.find(x => x.id === req.params.id as string);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  if (p.id === 'ollama' && p.baseUrl) {
    const models = await listOllamaModels(p.baseUrl);
    return res.json({ models });
  }
  res.json({ models: p.models });
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
  const { sessionId, content, providerId } = req.body as { sessionId: string; content: string; providerId: string };
  const providers = getProviders();
  const provider = providers.find(p => p.id === providerId) || providers.find(p => p.enabled);

  if (!provider) {
    return res.status(400).json({ error: 'No active provider configured' });
  }

  const userMsg: Message = {
    id: randomUUID(),
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
    provider: provider.name,
    model: provider.defaultModel,
  };
  addMessage({ ...userMsg, sessionId });

  try {
    const history = getMessages(sessionId);
    const result = await chatWithProvider(provider, history);
    const assistantMsg: Message = {
      id: randomUUID(),
      role: 'assistant',
      content: result.content,
      timestamp: new Date().toISOString(),
      provider: provider.name,
      model: result.model,
    };
    addMessage({ ...assistantMsg, sessionId });
    res.json({ messages: [userMsg, assistantMsg] });
  } catch (err) {
    const errorMsg: Message = {
      id: randomUUID(),
      role: 'assistant',
      content: `Error: ${(err as Error).message}`,
      timestamp: new Date().toISOString(),
    };
    addMessage({ ...errorMsg, sessionId });
    res.status(500).json({ messages: [userMsg, errorMsg], error: (err as Error).message });
  }
});

// ========== Code Changes ==========
router.get('/changes', (_req: Request, res: Response) => {
  res.json(getCodeChanges());
});

router.post('/changes', (req: Request, res: Response) => {
  addCodeChange({ ...req.body, id: randomUUID() });
  res.json({ ok: true });
});

// ========== Loop ==========
router.get('/loop', (_req: Request, res: Response) => {
  res.json(getLatestLoopState() || { status: 'paused' });
});

router.post('/loop', (req: Request, res: Response) => {
  const state: LoopState = {
    id: randomUUID(),
    iteration: 1,
    stage: 'analyze',
    status: 'running',
    task: req.body.task || 'Autonomous task',
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

// ========== Test Results ==========
router.get('/test-results', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM test_results ORDER BY timestamp DESC LIMIT 100').all() as any[];
  res.json(rows.map(r => ({
    id: r.id,
    featureId: r.feature_id,
    name: r.name,
    status: r.status,
    duration: r.duration,
    error: r.error,
    timestamp: r.timestamp,
  })));
});

// ========== Error Reports ==========
router.get('/errors', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM error_reports ORDER BY timestamp DESC LIMIT 100').all() as any[];
  res.json(rows.map(r => ({
    id: r.id,
    type: r.type,
    message: r.message,
    stack: r.stack,
    source: r.source,
    line: r.line,
    column: r.col,
    timestamp: r.timestamp,
    status: r.status,
    fix: r.fix,
    verifiedAt: r.verified_at,
  })));
});

router.post('/errors', (req: Request, res: Response) => {
  db.prepare(`
    INSERT INTO error_reports (id, type, message, stack, source, line, col, timestamp, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(randomUUID(), req.body.type, req.body.message, req.body.stack || null, req.body.source || null, req.body.line || null, req.body.column || null, new Date().toISOString());
  res.json({ ok: true });
});

router.post('/errors/:id/fix', (req: Request, res: Response) => {
  db.prepare('UPDATE error_reports SET status = ?, fix = ?, verified_at = ? WHERE id = ?')
    .run('fixed', req.body.fix || 'Auto-fixed', new Date().toISOString(), req.params.id as string);
  res.json({ ok: true });
});

// ========== Agent Actions ==========
router.get('/actions', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM agent_actions ORDER BY timestamp DESC LIMIT 200').all() as any[];
  res.json(rows.map(r => ({
    id: r.id,
    agent: r.agent,
    action: r.action,
    target: r.target,
    timestamp: r.timestamp,
    status: r.status,
    details: r.details,
  })));
});

router.post('/actions', (req: Request, res: Response) => {
  db.prepare('INSERT INTO agent_actions (id, agent, action, target, timestamp, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), req.body.agent, req.body.action, req.body.target, new Date().toISOString(), req.body.status, req.body.details || null);
  res.json({ ok: true });
});

// ========== Verify Results ==========
router.get('/verify', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM verify_results ORDER BY timestamp DESC LIMIT 50').all() as any[];
  res.json(rows.map(r => ({
    id: r.id,
    featureId: r.feature_id,
    timestamp: r.timestamp,
    status: r.status,
    screenshots: JSON.parse(r.screenshots || '[]'),
    logs: JSON.parse(r.logs || '[]'),
    error: r.error,
  })));
});

router.post('/verify', (req: Request, res: Response) => {
  db.prepare('INSERT INTO verify_results (id, feature_id, timestamp, status, screenshots, logs, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), req.body.featureId || null, new Date().toISOString(), req.body.status, JSON.stringify(req.body.screenshots || []), JSON.stringify(req.body.logs || []), req.body.error || null);
  res.json({ ok: true });
});

// ========== File Tree ==========
import { getFileTree } from './fs-utils.js';
router.get('/files', (req: Request, res: Response) => {
  const root = typeof req.query.root === 'string' ? req.query.root : process.cwd();
  res.json(getFileTree(root));
});

// ========== Health ==========
router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ========== File Content ==========
import { readFileSync } from 'fs';
router.get('/files/content', (req: Request, res: Response) => {
  const path = typeof req.query.path === 'string' ? req.query.path : '';
  if (!path) return res.status(400).json({ error: 'Missing path' });
  try {
    const content = readFileSync(path, 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ========== Swarm Engine ==========
interface SwarmAgentConfig {
  id: string;
  name: string;
  role: string;
  providerId: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  active: boolean;
  color: string;
}

interface SwarmResult {
  agentId: string;
  content: string;
  tokens: number;
  latency: number;
  timestamp: string;
}

router.post('/swarm', async (req: Request, res: Response) => {
  const { prompt, agentIds } = req.body as { prompt: string; agentIds: string[] };
  if (!prompt || !Array.isArray(agentIds) || agentIds.length === 0) {
    return res.status(400).json({ error: 'Missing prompt or agentIds' });
  }

  const allProviders = getProviders();
  // For this build, swarm agents are passed in the request body or matched by agent IDs.
  // Since frontend passes agentIds, we read the frontend store data from request.
  // But the backend doesn't have frontend store, so we accept agent configs in request.
  const agents = req.body.agents as SwarmAgentConfig[] || [];
  const selectedAgents = agents.filter(a => agentIds.includes(a.id));

  if (selectedAgents.length === 0) {
    return res.status(400).json({ error: 'No valid agents found' });
  }

  const startAll = Date.now();
  const results: SwarmResult[] = [];

  await Promise.all(
    selectedAgents.map(async (agent) => {
      const provider = allProviders.find(p => p.id === agent.providerId);
      if (!provider || !provider.enabled) {
        results.push({
          agentId: agent.id,
          content: `Provider ${agent.providerId} not available`,
          tokens: 0,
          latency: 0,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const start = Date.now();
      try {
        const result = await sendSingleMessage(provider, agent.systemPrompt, prompt, agent.model, agent.temperature);
        results.push({
          agentId: agent.id,
          content: result.content,
          tokens: result.tokens || 0,
          latency: Date.now() - start,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        results.push({
          agentId: agent.id,
          content: `Error: ${(err as Error).message}`,
          tokens: 0,
          latency: Date.now() - start,
          timestamp: new Date().toISOString(),
        });
      }
    })
  );

  res.json({
    prompt,
    totalLatency: Date.now() - startAll,
    results,
  });
});
