import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getProviders, updateProvider, getSessions, createSession, deleteSession, getMessages, getCodeChanges, addCodeChange, getLatestLoopState, createLoopState, } from './db.js';
import { testProvider, listOllamaModels, sendSingleMessage } from './providers.js';
import { getFeatures, updateFeature, seedFeatures } from './features.js';
import { runAgentChat } from './agent.js';
import { db } from './db.js';
export const router = Router();
// ========== Providers ==========
router.get('/providers', (_req, res) => {
    res.json(getProviders());
});
router.patch('/providers/:id', (req, res) => {
    updateProvider(req.params.id, req.body);
    res.json({ ok: true });
});
router.post('/providers/:id/test', async (req, res) => {
    const providers = getProviders();
    const p = providers.find(x => x.id === req.params.id);
    if (!p)
        return res.status(404).json({ error: 'Provider not found' });
    // Special: OpenCode uses local CLI
    if (p.id === 'opencode') {
        const start = Date.now();
        try {
            const { execFile } = await import('child_process');
            const { promisify } = await import('util');
            const execFileAsync = promisify(execFile);
            const { stdout } = await execFileAsync('opencode', ['--version'], { timeout: 5000 });
            return res.json({ ok: true, latency: Date.now() - start, models: ['ollama/kimi-k2.6:cloud', 'opencode/gpt-5', 'opencode/claude-sonnet-4'], version: stdout.trim() });
        }
        catch (err) {
            return res.json({ ok: false, latency: Date.now() - start, error: err.message });
        }
    }
    const result = await testProvider(p);
    res.json(result);
});
router.get('/providers/:id/models', async (req, res) => {
    const providers = getProviders();
    const p = providers.find(x => x.id === req.params.id);
    if (!p)
        return res.status(404).json({ error: 'Provider not found' });
    if (p.id === 'ollama' && p.baseUrl) {
        const models = await listOllamaModels(p.baseUrl);
        return res.json({ models });
    }
    res.json({ models: p.models });
});
// ========== Chat Sessions ==========
router.get('/sessions', (_req, res) => {
    res.json(getSessions());
});
router.post('/sessions', (req, res) => {
    const s = createSession({
        ...req.body,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    res.json(s);
});
router.delete('/sessions/:id', (req, res) => {
    deleteSession(req.params.id);
    res.json({ ok: true });
});
// ========== Messages ==========
router.get('/sessions/:id/messages', (req, res) => {
    res.json(getMessages(req.params.id));
});
router.post('/chat', async (req, res) => {
    const { sessionId, content, providerId, projectRoot } = req.body;
    const providers = getProviders();
    const rawProvider = providers.find((p) => p.id === providerId) || providers.find((p) => p.enabled);
    if (!rawProvider) {
        return res.status(400).json({ error: 'No active provider configured' });
    }
    // Fire-and-forget agent (async streaming will happen over WebSocket)
    runAgentChat(rawProvider, sessionId, content, projectRoot).catch(console.error);
    // Immediate acknowledgment — client will get real messages via WebSocket + /sessions/:id/messages
    res.json({ ok: true, status: 'running', sessionId });
});
// ========== Code Changes ==========
router.get('/changes', (_req, res) => {
    res.json(getCodeChanges());
});
router.post('/changes', (req, res) => {
    addCodeChange({ ...req.body, id: randomUUID() });
    res.json({ ok: true });
});
// ========== Loop ==========
router.get('/loop', (_req, res) => {
    res.json(getLatestLoopState() || { status: 'paused' });
});
router.post('/loop', (req, res) => {
    const state = {
        id: randomUUID(), iteration: 1, stage: 'analyze', status: 'running',
        task: req.body.task || 'Autonomous task', plan: [], progress: 0, logs: [],
        startTime: new Date().toISOString(),
    };
    createLoopState(state);
    res.json(state);
});
// ========== Features ==========
router.get('/features', (_req, res) => {
    seedFeatures();
    res.json(getFeatures());
});
router.patch('/features/:id', (req, res) => {
    updateFeature(req.params.id, req.body);
    res.json({ ok: true });
});
// ========== Test Results ==========
router.get('/test-results', (_req, res) => {
    const rows = db.prepare('SELECT * FROM test_results ORDER BY timestamp DESC LIMIT 100').all();
    res.json(rows.map(r => ({ id: r.id, featureId: r.feature_id, name: r.name, status: r.status, duration: r.duration, error: r.error, timestamp: r.timestamp })));
});
// ========== Error Reports ==========
router.get('/errors', (_req, res) => {
    const rows = db.prepare('SELECT * FROM error_reports ORDER BY timestamp DESC LIMIT 100').all();
    res.json(rows.map(r => ({ id: r.id, type: r.type, message: r.message, stack: r.stack, source: r.source, line: r.line, column: r.col, timestamp: r.timestamp, status: r.status, fix: r.fix, verifiedAt: r.verified_at })));
});
router.post('/errors', (req, res) => {
    db.prepare('INSERT INTO error_reports (id, type, message, stack, source, line, col, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), req.body.type, req.body.message, req.body.stack || null, req.body.source || null, req.body.line || null, req.body.column || null, new Date().toISOString(), 'open');
    res.json({ ok: true });
});
router.post('/errors/:id/fix', (req, res) => {
    db.prepare('UPDATE error_reports SET status = ?, fix = ?, verified_at = ? WHERE id = ?')
        .run('fixed', req.body.fix || 'Auto-fixed', new Date().toISOString(), req.params.id);
    res.json({ ok: true });
});
// ========== Agent Actions ==========
router.get('/actions', (_req, res) => {
    const rows = db.prepare('SELECT * FROM agent_actions ORDER BY timestamp DESC LIMIT 200').all();
    res.json(rows.map(r => ({ id: r.id, agent: r.agent, action: r.action, target: r.target, timestamp: r.timestamp, status: r.status, details: r.details })));
});
router.post('/actions', (req, res) => {
    db.prepare('INSERT INTO agent_actions (id, agent, action, target, timestamp, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), req.body.agent, req.body.action, req.body.target, new Date().toISOString(), req.body.status, req.body.details || null);
    res.json({ ok: true });
});
// ========== Verify Results ==========
router.get('/verify', (_req, res) => {
    const rows = db.prepare('SELECT * FROM verify_results ORDER BY timestamp DESC LIMIT 50').all();
    res.json(rows.map(r => ({ id: r.id, featureId: r.feature_id, timestamp: r.timestamp, status: r.status, screenshots: JSON.parse(r.screenshots || '[]'), logs: JSON.parse(r.logs || '[]'), error: r.error })));
});
router.post('/verify', (req, res) => {
    db.prepare('INSERT INTO verify_results (id, feature_id, timestamp, status, screenshots, logs, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), req.body.featureId || null, new Date().toISOString(), req.body.status, JSON.stringify(req.body.screenshots || []), JSON.stringify(req.body.logs || []), req.body.error || null);
    res.json({ ok: true });
});
// ========== File Tree ==========
import { getFileTree, getProjectStats } from './fs-utils.js';
router.get('/files', (req, res) => {
    const root = typeof req.query.root === 'string' ? req.query.root : process.cwd();
    res.json(getFileTree(root));
});
// ========== Project Stats ==========
router.get('/project-stats', (req, res) => {
    const root = typeof req.query.root === 'string' ? req.query.root : process.cwd();
    try {
        res.json(getProjectStats(root));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ========== Health ==========
router.get('/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});
// ========== File Content ==========
import { readFileSync } from 'fs';
router.get('/files/content', (req, res) => {
    const path = typeof req.query.path === 'string' ? req.query.path : '';
    if (!path)
        return res.status(400).json({ error: 'Missing path' });
    try {
        const content = readFileSync(path, 'utf-8');
        res.json({ content });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/swarm', async (req, res) => {
    const { prompt, agentIds } = req.body;
    if (!prompt || !Array.isArray(agentIds) || agentIds.length === 0) {
        return res.status(400).json({ error: 'Missing prompt or agentIds' });
    }
    const allProviders = getProviders();
    const agents = req.body.agents || [];
    const selectedAgents = agents.filter(a => agentIds.includes(a.id));
    if (selectedAgents.length === 0) {
        return res.status(400).json({ error: 'No valid agents found' });
    }
    const startAll = Date.now();
    const results = [];
    await Promise.all(selectedAgents.map(async (agent) => {
        const provider = allProviders.find(p => p.id === agent.providerId);
        if (!provider || !provider.enabled) {
            results.push({ agentId: agent.id, content: `Provider ${agent.providerId} not available`, tokens: 0, latency: 0, timestamp: new Date().toISOString() });
            return;
        }
        const start = Date.now();
        try {
            const result = await sendSingleMessage(provider, agent.systemPrompt, prompt, agent.model, agent.temperature);
            results.push({ agentId: agent.id, content: result.content, tokens: result.tokens || 0, latency: Date.now() - start, timestamp: new Date().toISOString() });
        }
        catch (err) {
            results.push({ agentId: agent.id, content: `Error: ${err.message}`, tokens: 0, latency: Date.now() - start, timestamp: new Date().toISOString() });
        }
    }));
    res.json({ prompt, totalLatency: Date.now() - startAll, results });
});
// ========== Testing Engine ==========
router.post('/test', async (req, res) => {
    const { root, mode } = req.body;
    if (!root)
        return res.status(400).json({ error: 'Missing root path' });
    try {
        const { analyzeProject } = await import('./test-analyzer.js');
        const result = analyzeProject(root, mode || 'standard');
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ========== UI Tester Proxy ==========
router.get('/uitester/proxy', async (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    const bridge = typeof req.query.bridge === 'string' ? decodeURIComponent(req.query.bridge) : '';
    if (!url)
        return res.status(400).send('Missing url');
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        let body = await response.text();
        if (body.includes('\u003chead\u003e')) {
            body = body.replace('\u003chead\u003e', '\u003chead\u003e' + bridge);
        }
        else if (body.includes('\u003chtml\u003e')) {
            body = body.replace('\u003chtml\u003e', '\u003chtml\u003e' + bridge);
        }
        else {
            body = bridge + body;
        }
        res.set('Content-Type', response.headers.get('content-type') || 'text/html');
        res.send(body);
    }
    catch (err) {
        res.status(500).send(`Failed to proxy: ${err.message}`);
    }
});
// ========== Project Architecture Graph ==========
router.get('/project-graph', async (req, res) => {
    const root = typeof req.query.root === 'string' ? req.query.root : process.cwd();
    try {
        const { buildProjectGraph } = await import('./arch-graph.js');
        const graph = buildProjectGraph(root);
        res.json(graph);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ========== Skills ==========
router.post('/skills/terminal', async (req, res) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { command = 'echo no command' } = req.body || {};
    try {
        const { stdout, stderr } = await execAsync(command, { timeout: 30000, env: process.env });
        res.json({ output: stdout + stderr });
    }
    catch (err) {
        res.status(500).json({ error: err.stderr || err.message });
    }
});
router.post('/skills/git', async (req, res) => {
    const { spawn } = await import('child_process');
    const { command = 'status' } = req.body || {};
    const cwd = req.body?.cwd || '.';
    try {
        const proc = spawn('git', command.split(' '), { cwd, stdio: 'pipe' });
        let out = '', err = '';
        proc.stdout.on('data', (d) => out += d.toString());
        proc.stderr.on('data', (d) => err += d.toString());
        proc.on('close', (code) => {
            if (code === 0)
                res.json({ output: out || err });
            else
                res.status(500).json({ error: err || `Git exited with ${code}` });
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/skills/brave', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (!q)
        return res.status(400).json({ error: 'Missing q' });
    try {
        const { search } = await import('./skills/brave.js');
        const results = await search(q);
        res.json({ results });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/skills/fetch', async (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!url)
        return res.status(400).json({ error: 'Missing url' });
    try {
        const { fetchPage } = await import('./skills/fetch.js');
        const content = await fetchPage(url);
        res.json({ content });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/skills/context7', async (req, res) => {
    const { library } = req.body || {};
    if (!library)
        return res.status(400).json({ error: 'Missing library' });
    try {
        const { getDocs } = await import('./skills/context7.js');
        const docs = await getDocs(library);
        res.json({ docs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/skills/playwright', async (req, res) => {
    const { url, action } = req.body || {};
    if (!url)
        return res.status(400).json({ error: 'Missing url' });
    try {
        const data = await import('./skills/playwright.js');
        const result = await data.runTest({ url, action });
        res.json({ result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ========== OpenCode CLI Integration ==========
router.get('/opencode/models', async (_req, res) => {
    try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync('opencode', ['models'], { timeout: 10000, encoding: 'utf-8' });
        const models = stdout.trim().split('\n').filter(Boolean);
        res.json({ models });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to list models' });
    }
});
router.get('/opencode/agents', async (_req, res) => {
    try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync('opencode', ['agent', 'list'], { timeout: 10000, encoding: 'utf-8' });
        // Parse the text output: each agent name is on its own line before the permissions block
        const lines = stdout.trim().split('\n').filter(Boolean);
        const agents = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith('"') && !trimmed.startsWith('{')) {
                const match = trimmed.match(/^(\S+)\s*(?:\((\S+)\))?/);
                if (match) {
                    agents.push({ name: match[1], primary: match[2] === 'primary' });
                }
            }
        }
        res.json({ agents });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to list agents' });
    }
});
router.get('/opencode/sessions', async (_req, res) => {
    try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync('opencode', ['session', 'list', '--format', 'json'], { timeout: 10000, encoding: 'utf-8' });
        const sessions = JSON.parse(stdout.trim());
        res.json({ sessions });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to list sessions' });
    }
});
router.post('/opencode/run', async (req, res) => {
    const { prompt, model, agent, session, dir, continueSession } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Missing prompt' });
    }
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const args = ['run', '--format', 'json'];
    if (model)
        args.push('-m', model);
    if (agent)
        args.push('--agent', agent);
    if (session)
        args.push('-s', session);
    if (dir)
        args.push('--dir', dir);
    if (continueSession)
        args.push('-c');
    const { spawn } = await import('child_process');
    const child = spawn('opencode', args, {
        env: process.env,
        shell: false,
        windowsHide: true,
    });
    child.stdin.write(prompt);
    child.stdin.end();
    let stderr = '';
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.stdout.pipe(res);
    child.on('close', (code) => {
        if (code !== 0 && !res.writableEnded) {
            res.write(JSON.stringify({ type: 'error', error: stderr || `OpenCode exited with code ${code}` }) + '\n');
        }
        if (!res.writableEnded)
            res.end();
    });
    child.on('error', (err) => {
        if (!res.writableEnded) {
            res.write(JSON.stringify({ type: 'error', error: err.message }) + '\n');
            res.end();
        }
    });
    req.on('close', () => { child.kill(); });
});
//# sourceMappingURL=routes.js.map