import { randomUUID } from 'crypto';
import type { Feature } from './types.js';
import { db } from './db.js';

const FEATURE_SEED: Omit<Feature, 'createdAt'>[] = [
  {
    id: 'feat-codebase-search',
    name: 'AI Codebase Search',
    description: 'Semantic search across project files using embeddings. Query with natural language.',
    status: 'complete',
    priority: 1,
    progress: 100,
    component: 'CodebaseSearch',
  },
  {
    id: 'feat-arch-viz',
    name: 'Architecture Visualizer',
    description: 'Interactive graph of components, imports, and relationships.',
    status: 'complete',
    priority: 2,
    progress: 100,
    component: 'ArchitectureViz',
  },
  {
    id: 'feat-multi-model',
    name: 'Multi-Model Comparison',
    description: 'Send the same prompt to multiple providers and compare responses side-by-side.',
    status: 'complete',
    priority: 3,
    progress: 100,
    component: 'ModelComparison',
  },
  {
    id: 'feat-workflow',
    name: 'Agent Workflow Builder',
    description: 'Drag-and-drop pipeline builder for chaining agent actions.',
    status: 'complete',
    priority: 4,
    progress: 100,
    component: 'WorkflowBuilder',
  },
  {
    id: 'feat-test-dash',
    name: 'Automated Testing Dashboard',
    description: 'Live test results, coverage maps, and failure drill-down.',
    status: 'complete',
    priority: 5,
    progress: 100,
    component: 'TestingDashboard',
  },
];

export function seedFeatures() {
  const row = db.prepare('SELECT count(*) as c FROM features').get() as { c: number };
  if (row.c > 0) return;
  const insert = db.prepare(`
    INSERT INTO features (id, name, description, status, priority, progress, component, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const f of FEATURE_SEED) {
    insert.run(f.id, f.name, f.description, f.status, f.priority, f.progress, f.component, new Date().toISOString());
  }
}

export function getFeatures(): Feature[] {
  const rows = db.prepare('SELECT * FROM features ORDER BY priority ASC').all() as any[];
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status as Feature['status'],
    priority: r.priority,
    progress: r.progress,
    component: r.component,
    createdAt: r.created_at,
  }));
}

export function updateFeature(id: string, updates: Partial<Feature>) {
  const sets: string[] = [];
  const values: any[] = [];
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.progress !== undefined) { sets.push('progress = ?'); values.push(updates.progress); }
  if (updates.priority !== undefined) { sets.push('priority = ?'); values.push(updates.priority); }
  values.push(id);
  if (sets.length) db.prepare(`UPDATE features SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}
