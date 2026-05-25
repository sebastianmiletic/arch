// AISettingsManager.ts — Persist and validate provider configs in SQLite.
// ---------------------------------------------------------------------------

import { type AIProviderConfig } from './types.js';

export class AISettingsManager {
  constructor(private db: any) {}

  private ensureTable(): Promise<void> {
    return this.db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL,
        apiKey TEXT,
        baseUrl TEXT,
        defaultModel TEXT NOT NULL,
        temperature REAL NOT NULL DEFAULT 0.7,
        maxTokens INTEGER NOT NULL DEFAULT 4096,
        metadata TEXT NOT NULL DEFAULT '{}',
        priority INTEGER NOT NULL DEFAULT 0,
        capabilities TEXT NOT NULL DEFAULT '[]',
        lastTestedAt TEXT,
        lastTestResult INTEGER,
        models TEXT NOT NULL DEFAULT '[]'
      )
    `);
  }

  /** Load all provider rows from the database. */
  async loadProviders(): Promise<AIProviderConfig[]> {
    await this.ensureTable();
    const rows: any[] = await this.db.all(`SELECT * FROM providers`);
    return rows.map((r) => this.rowToConfig(r));
  }

  /** Insert or update a single provider config using UPSERT semantics. */
  async saveProvider(config: AIProviderConfig): Promise<void> {
    await this.ensureTable();
    const {
      id,
      name,
      enabled,
      type,
      apiKey,
      baseUrl,
      defaultModel,
      temperature,
      maxTokens,
      metadata,
      priority,
      capabilities,
      lastTestedAt,
      lastTestResult,
      models,
    } = config;

    const sql = `
      INSERT INTO providers
        (id, name, enabled, type, apiKey, baseUrl, defaultModel, temperature,
         maxTokens, metadata, priority, capabilities, lastTestedAt, lastTestResult, models)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        enabled = excluded.enabled,
        type = excluded.type,
        apiKey = excluded.apiKey,
        baseUrl = excluded.baseUrl,
        defaultModel = excluded.defaultModel,
        temperature = excluded.temperature,
        maxTokens = excluded.maxTokens,
        metadata = excluded.metadata,
        priority = excluded.priority,
        capabilities = excluded.capabilities,
        lastTestedAt = excluded.lastTestedAt,
        lastTestResult = excluded.lastTestResult,
        models = excluded.models
    `;

    await this.db.run(sql, [
      id,
      name,
      enabled ? 1 : 0,
      type,
      apiKey ?? null,
      baseUrl ?? null,
      defaultModel,
      temperature,
      maxTokens,
      JSON.stringify(metadata),
      priority,
      JSON.stringify(capabilities),
      lastTestedAt ?? null,
      lastTestResult != null ? (lastTestResult ? 1 : 0) : null,
      JSON.stringify(models),
    ]);
  }

  /** Remove a provider row by id. */
  async deleteProvider(id: string): Promise<void> {
    await this.ensureTable();
    await this.db.run(`DELETE FROM providers WHERE id = ?`, [id]);
  }

  /** Mask all but the last 4 characters of an API key. */
  maskKey(key: string): string {
    if (!key || key.length <= 4) return key.replace(/./g, '*');
    return '*'.repeat(key.length - 4) + key.slice(-4);
  }

  /** Validate a provider config and return a list of human-readable errors. */
  validateConfig(config: AIProviderConfig): string[] {
    const errors: string[] = [];
    if (!config.id || config.id.trim().length === 0) errors.push('id is required');
    if (!config.name || config.name.trim().length === 0) errors.push('name is required');
    if (!config.type || config.type.trim().length === 0) errors.push('type is required');
    if (!config.defaultModel || config.defaultModel.trim().length === 0) errors.push('defaultModel is required');
    if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
      errors.push('temperature must be a number between 0 and 2');
    }
    if (typeof config.maxTokens !== 'number' || config.maxTokens < 1) {
      errors.push('maxTokens must be a positive integer');
    }
    if (typeof config.priority !== 'number') errors.push('priority must be a number');
    if (!Array.isArray(config.capabilities)) errors.push('capabilities must be an array');
    if (!Array.isArray(config.models)) errors.push('models must be an array');
    if (config.apiKey && config.apiKey.trim().length < 8) {
      errors.push('apiKey looks too short');
    }
    return errors;
  }

  /** Convert a raw SQLite row into a typed config object. */
  private rowToConfig(row: any): AIProviderConfig {
    return {
      id: row.id,
      name: row.name,
      enabled: row.enabled === 1,
      type: row.type,
      apiKey: row.apiKey ?? undefined,
      baseUrl: row.baseUrl ?? undefined,
      defaultModel: row.defaultModel,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      priority: row.priority,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
      lastTestedAt: row.lastTestedAt ?? undefined,
      lastTestResult: row.lastTestResult != null ? row.lastTestResult === 1 : undefined,
      models: row.models ? JSON.parse(row.models) : [],
    };
  }
}
