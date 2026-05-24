import BetterSqlite3 from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type {
  Message, ProviderConfig, ChatSession, CodeChange,
  LoopState, LoopLog, LoopStage, Feature, TestResult, ErrorReport, VerifyResult, AgentAction,
} from './types.js';

export const db = new BetterSqlite3('studio.db') as any;

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 0,
      api_key TEXT,
      base_url TEXT,
      models TEXT NOT NULL,
      default_model TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      provider TEXT,
      model TEXT
    );

    CREATE TABLE IF NOT EXISTS code_changes (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      change_type TEXT NOT NULL,
      line_start INTEGER,
      line_end INTEGER,
      old_content TEXT,
      new_content TEXT,
      timestamp TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS loop_states (
      id TEXT PRIMARY KEY,
      iteration INTEGER DEFAULT 0,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      task TEXT,
      plan TEXT,
      progress REAL DEFAULT 0,
      start_time TEXT NOT NULL,
      end_time TEXT
    );

    CREATE TABLE IF NOT EXISTS loop_logs (
      id TEXT PRIMARY KEY,
      state_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      stage TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planned',
      priority INTEGER DEFAULT 0,
      progress REAL DEFAULT 0,
      component TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      feature_id TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      duration REAL,
      error TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS error_reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      stack TEXT,
      source TEXT,
      line INTEGER,
      col INTEGER,
      timestamp TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      fix TEXT,
      verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS verify_results (
      id TEXT PRIMARY KEY,
      feature_id TEXT,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      screenshots TEXT,
      logs TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_actions (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT
    );
  `);
}

function getDefaultModels(providerId: string): string[] {
  const map: Record<string, string[]> = {
    ollama: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'qwen2.5'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-70b-instruct'],
    nvidia: ['meta/llama3-70b-instruct', 'meta/llama3-8b-instruct', 'mistralai/mixtral-8x7b-instruct-v0.1'],
    local: ['local-model', 'local-qwen', 'local-llama'],
  };
  return map[providerId] || ['default'];
}

function seedProviders() {
  const providersSeed: Omit<ProviderConfig, 'models'>[] = [
    { id: 'ollama', name: 'Ollama', enabled: true, baseUrl: 'http://localhost:11434', defaultModel: 'llama3.2', temperature: 0.7, maxTokens: 4096 },
    { id: 'openai', name: 'OpenAI', enabled: false, baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', temperature: 0.7, maxTokens: 8192 },
    { id: 'anthropic', name: 'Anthropic', enabled: false, baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-5-sonnet-20241022', temperature: 0.7, maxTokens: 8192 },
    { id: 'gemini', name: 'Gemini', enabled: false, baseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-1.5-pro', temperature: 0.7, maxTokens: 8192 },
    { id: 'openrouter', name: 'OpenRouter', enabled: false, baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o', temperature: 0.7, maxTokens: 8192 },
    { id: 'nvidia', name: 'NVIDIA NIM', enabled: false, baseUrl: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama3-70b-instruct', temperature: 0.7, maxTokens: 4096 },
    { id: 'local', name: 'Local Endpoint', enabled: false, baseUrl: 'http://localhost:8000/v1', defaultModel: 'local-model', temperature: 0.7, maxTokens: 4096 },
  ];

  const check = db.prepare('SELECT count(*) as c FROM providers WHERE id = ?');
  const insert = db.prepare(`
    INSERT INTO providers (id, name, enabled, base_url, models, default_model, temperature, max_tokens)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of providersSeed) {
    const row = check.get(p.id) as { c: number } | undefined;
    if (!row || row.c === 0) {
      insert.run(p.id, p.name, p.enabled ? 1 : 0, p.baseUrl || '', JSON.stringify(getDefaultModels(p.id)), p.defaultModel, p.temperature, p.maxTokens);
    }
  }
}

initTables();
seedProviders();

export function getProviders(): ProviderConfig[] {
  const rows = db.prepare('SELECT * FROM providers').all() as any[];
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    enabled: !!r.enabled,
    apiKey: r.api_key || undefined,
    baseUrl: r.base_url || undefined,
    models: JSON.parse(r.models),
    defaultModel: r.default_model,
    temperature: r.temperature,
    maxTokens: r.max_tokens,
  }));
}

export function updateProvider(id: string, updates: Partial<ProviderConfig>) {
  const sets: string[] = [];
  const values: any[] = [];
  if (updates.enabled !== undefined) { sets.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (updates.apiKey !== undefined) { sets.push('api_key = ?'); values.push(updates.apiKey); }
  if (updates.baseUrl !== undefined) { sets.push('base_url = ?'); values.push(updates.baseUrl); }
  if (updates.defaultModel !== undefined) { sets.push('default_model = ?'); values.push(updates.defaultModel); }
  if (updates.temperature !== undefined) { sets.push('temperature = ?'); values.push(updates.temperature); }
  if (updates.maxTokens !== undefined) { sets.push('max_tokens = ?'); values.push(updates.maxTokens); }
  values.push(id);
  if (sets.length) db.prepare(`UPDATE providers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function getSessions(): ChatSession[] {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as any[];
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    providerId: r.provider_id,
    model: r.model,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    messages: getMessages(r.id),
  }));
}

export function createSession(session: Omit<ChatSession, 'messages'>): ChatSession {
  const id = session.id || randomUUID();
  db.prepare('INSERT INTO sessions (id, name, provider_id, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, session.name, session.providerId, session.model, session.createdAt, session.updatedAt);
  return { ...session, id, messages: [] };
}

export function deleteSession(id: string) {
  db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function getMessages(sessionId: string): Message[] {
  const rows = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId) as any[];
  return rows.map(r => ({
    id: r.id,
    role: r.role as Message['role'],
    content: r.content,
    timestamp: r.timestamp,
    provider: r.provider || undefined,
    model: r.model || undefined,
  }));
}

export function addMessage(msg: Message & { sessionId: string }) {
  db.prepare('INSERT INTO messages (id, session_id, role, content, timestamp, provider, model) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(msg.id, msg.sessionId, msg.role, msg.content, msg.timestamp, msg.provider || null, msg.model || null);
}

export function getCodeChanges(limit = 100): CodeChange[] {
  const rows = db.prepare('SELECT * FROM code_changes ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];
  return rows.map(r => ({
    id: r.id,
    filePath: r.file_path,
    changeType: r.change_type as CodeChange['changeType'],
    lineStart: r.line_start,
    lineEnd: r.line_end,
    oldContent: r.old_content || undefined,
    newContent: r.new_content || undefined,
    timestamp: r.timestamp,
    reason: r.reason,
    status: r.status as CodeChange['status'],
  }));
}

export function addCodeChange(change: CodeChange) {
  db.prepare(`
    INSERT INTO code_changes (id, file_path, change_type, line_start, line_end, old_content, new_content, timestamp, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(change.id, change.filePath, change.changeType, change.lineStart, change.lineEnd,
    change.oldContent || null, change.newContent || null, change.timestamp, change.reason, change.status);
}

export function updateCodeChangeStatus(id: string, status: CodeChange['status']) {
  db.prepare('UPDATE code_changes SET status = ? WHERE id = ?').run(status, id);
}

export function getLatestLoopState(): LoopState | undefined {
  const row = db.prepare('SELECT * FROM loop_states ORDER BY start_time DESC LIMIT 1').get() as any;
  if (!row) return undefined;
  return {
    id: row.id,
    iteration: row.iteration,
    stage: row.stage as LoopStage,
    status: row.status as LoopState['status'],
    task: row.task,
    plan: JSON.parse(row.plan || '[]'),
    progress: row.progress,
    logs: getLoopLogs(row.id),
    startTime: row.start_time,
    endTime: row.end_time || undefined,
  };
}

export function createLoopState(state: LoopState) {
  db.prepare('INSERT INTO loop_states (id, iteration, stage, status, task, plan, progress, start_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(state.id, state.iteration, state.stage, state.status, state.task || null, JSON.stringify(state.plan || []), state.progress, state.startTime);
}

export function updateLoopState(id: string, updates: Partial<LoopState>) {
  const sets: string[] = [];
  const values: any[] = [];
  if (updates.stage !== undefined) { sets.push('stage = ?'); values.push(updates.stage); }
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.task !== undefined) { sets.push('task = ?'); values.push(updates.task); }
  if (updates.plan !== undefined) { sets.push('plan = ?'); values.push(JSON.stringify(updates.plan)); }
  if (updates.progress !== undefined) { sets.push('progress = ?'); values.push(updates.progress); }
  if (updates.endTime !== undefined) { sets.push('end_time = ?'); values.push(updates.endTime); }
  values.push(id);
  if (sets.length) db.prepare(`UPDATE loop_states SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function getLoopLogs(stateId: string): LoopLog[] {
  const rows = db.prepare('SELECT * FROM loop_logs WHERE state_id = ? ORDER BY timestamp ASC').all(stateId) as any[];
  return rows.map(r => ({
    timestamp: r.timestamp,
    stage: r.stage as LoopStage,
    level: r.level as LoopLog['level'],
    message: r.message,
  }));
}

export function addLoopLog(stateId: string, log: LoopLog) {
  db.prepare('INSERT INTO loop_logs (id, state_id, timestamp, stage, level, message) VALUES (?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), stateId, log.timestamp, log.stage, log.level, log.message);
}

export type { LoopStage };
export { randomUUID };
