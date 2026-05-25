import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, resolve, relative } from 'path';

export interface ArchNode {
  id: string;
  label: string;
  type: 'entry' | 'page' | 'component' | 'hook' | 'util' | 'store' | 'service' | 'api' | 'db' | 'config' | 'test' | 'style' | 'unknown';
  path: string;
  depth: number;
  lines: number;
  imports: string[];      // relative import paths
  importedBy: string[];   // ids of files that import this one
  exports: string[];      // exported names
  tech: string[];
}

export interface ArchGraph {
  root: string;
  nodes: ArchNode[];
  totalLines: number;
  totalFiles: number;
  layers: { label: string; nodeIds: string[] }[];
}

const SKIP_DIRS = new Set(['node_modules','.git','dist','build','.next','.turbo','coverage','vendor','__pycache__','.github','.vscode','.idea','release','.husky']);
const MAX_DEPTH = 5;

function walk(root: string, dir: string, depth: number, out: { path: string; rel: string; ext: string; lines: number }[]) {
  if (depth > MAX_DEPTH) return;
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    try {
      const st = statSync(p);
      if (st.isDirectory()) walk(root, p, depth + 1, out);
      else if (st.isFile() && st.size < 2 * 1024 * 1024) {
        const ext = extname(name).toLowerCase();
        if (!['.ts','.tsx','.js','.jsx','.vue','.svelte','.py','.go','.rs','.java'].includes(ext)) continue;
        try {
          const content = readFileSync(p, 'utf-8');
          out.push({ path: p, rel: relative(root, p), ext, lines: content.split('\n').length });
        } catch {}
      }
    } catch {}
  }
}

function guessType(rel: string, ext: string): ArchNode['type'] {
  const base = rel.toLowerCase();
  if (base.match(/(app|main|entry|index)\.(ts|tsx|js|jsx)$/)) return 'entry';
  if (base.includes('page') || base.includes('route') || base.includes('screen')) return 'page';
  if (base.includes('test') || base.includes('spec') || base.includes('__tests__')) return 'test';
  if (base.includes('hook') || base.startsWith('use')) return 'hook';
  if (base.includes('store') || base.includes('state') || base.includes('context')) return 'store';
  if (base.includes('service') || base.includes('api') || base.includes('client')) return 'service';
  if (base.includes('db') || base.includes('model.') || base.includes('schema')) return 'db';
  if (base.includes('config') || base.includes('.config.')) return 'config';
  if (base.includes('util') || base.includes('helper') || base.includes('lib/')) return 'util';
  if (ext === '.css' || ext === '.scss' || ext === '.less' || ext === '.sass') return 'style';
  if (base.match(/^[A-Z]/) || base.includes('component')) return 'component';
  return 'unknown';
}

function extractImports(content: string, ext: string): string[] {
  const imports: string[] = [];
  if (ext === '.py') {
    const m = content.match(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm);
    if (m) m.forEach(l => { const f = l.match(/from\s+([\w.]+)/)?.[1] || l.match(/import\s+([\w.]+)/)?.[1]; if (f) imports.push(f); });
  } else if (ext === '.go') {
    const m = content.match(/^\s*import\s+["']([^"']+)["']/gm);
    if (m) m.forEach(l => { const path = l.match(/["']([^"']+)["']/)?.[1]; if (path) imports.push(path); });
  } else {
    const m = content.match(/(?:import\s+.*?\s+from\s+['"][^'"]+['"]|import\s*\(\s*['"][^'"]+['"]\s*\)|require\s*\(\s*['"][^'"]+['"]\s*\))/gm);
    if (m) {
      m.forEach(l => {
        const path = l.match(/['"]([^'"]+)['"]/)?.[1];
        if (path && !path.startsWith('.') && !path.startsWith('/')) return; // skip node_modules
        if (path) imports.push(path);
      });
    }
  }
  return [...new Set(imports)];
}

function extractExports(content: string): string[] {
  const exports: string[] = [];
  const defaultMatch = content.match(/export\s+default\s+(?:function\s+|class\s+|const\s+)?([A-Z]\w*)/);
  if (defaultMatch) exports.push(defaultMatch[1]);
  const namedMatches = content.match(/export\s+(?:function|class|const|let|var)\s+([A-Z]\w*)/g);
  if (namedMatches) namedMatches.forEach(m => {
    const name = m.match(/\s+([A-Z]\w*)/)?.[1];
    if (name) exports.push(name);
  });
  const destructureMatch = content.match(/export\s*\{([^}]+)\}/g);
  if (destructureMatch) {
    destructureMatch.forEach(m => {
      m.replace(/(\w+)/g, (_s, name) => { if (name !== 'as') exports.push(name); return name; });
    });
  }
  return [...new Set(exports)];
}

function techStack(ext: string, content: string): string[] {
  const tech: string[] = [];
  if (ext === '.ts' || ext === '.tsx') tech.push('TypeScript');
  else if (ext === '.js' || ext === '.jsx') tech.push('JavaScript');
  else if (ext === '.vue') tech.push('Vue');
  else if (ext === '.svelte') tech.push('Svelte');
  else if (ext === '.py') tech.push('Python');
  else if (ext === '.go') tech.push('Go');
  else if (ext === '.rs') tech.push('Rust');
  else if (ext === '.java') tech.push('Java');

  if (content.includes('react') || content.includes('React')) tech.push('React');
  if (content.includes('express') || content.includes('Express')) tech.push('Express');
  if (content.includes('zustand')) tech.push('Zustand');
  if (content.includes('tailwind')) tech.push('Tailwind');
  if (content.includes('framer-motion')) tech.push('Framer Motion');
  if (content.includes('prisma') || content.includes('@prisma')) tech.push('Prisma');
  if (content.includes('better-sqlite')) tech.push('SQLite');
  if (content.includes('electron')) tech.push('Electron');
  if (content.includes('vite')) tech.push('Vite');
  if (content.includes('vitest') || content.includes('jest') || content.includes('mocha')) tech.push('Testing');
  return [...new Set(tech)];
}

export function buildProjectGraph(root: string): ArchGraph {
  const resolved = resolve(root || '.');
  const files: { path: string; rel: string; ext: string; lines: number }[] = [];
  walk(resolved, resolved, 0, files);

  const nodes: ArchNode[] = [];
  const nodeByPath = new Map<string, ArchNode>();
  const contentByPath = new Map<string, string>();

  for (const f of files) {
    try {
      const content = readFileSync(f.path, 'utf-8');
      contentByPath.set(f.path, content);
    } catch { contentByPath.set(f.path, ''); }
  }

  for (const f of files) {
    const content = contentByPath.get(f.path) || '';
    const type = guessType(f.rel, f.ext);
    const imports = extractImports(content, f.ext);
    const exports = extractExports(content);
    const tech = techStack(f.ext, content);

    const node: ArchNode = {
      id: f.rel,
      label: f.rel.split('/').pop() || f.rel,
      type,
      path: f.rel,
      depth: f.rel.split('/').length,
      lines: f.lines,
      imports,
      importedBy: [],
      exports,
      tech,
    };
    nodes.push(node);
    nodeByPath.set(f.rel, node);
  }

  // Resolve imports to node ids
  for (const node of nodes) {
    for (const imp of node.imports) {
      const dir = node.path.split('/').slice(0, -1).join('/');
      const candidates = [
        imp,
        imp + '.ts', imp + '.tsx', imp + '.js', imp + '.jsx',
        join(dir, imp),
        join(dir, imp + '.ts'), join(dir, imp + '.tsx'),
        join(dir, imp + '.js'), join(dir, imp + '.jsx'),
        imp + '/index.ts', imp + '/index.tsx', imp + '/index.js', imp + '/index.jsx',
      ];
      for (const c of candidates) {
        if (nodeByPath.has(c)) {
          nodeByPath.get(c)!.importedBy.push(node.id);
          break;
        }
      }
    }
  }

  // Build layers
  const layers = [
    { label: 'Entry', nodeIds: nodes.filter(n => n.type === 'entry').map(n => n.id) },
    { label: 'Pages', nodeIds: nodes.filter(n => n.type === 'page').map(n => n.id) },
    { label: 'Components', nodeIds: nodes.filter(n => n.type === 'component').map(n => n.id) },
    { label: 'Hooks', nodeIds: nodes.filter(n => n.type === 'hook').map(n => n.id) },
    { label: 'Store / State', nodeIds: nodes.filter(n => n.type === 'store').map(n => n.id) },
    { label: 'Services / API', nodeIds: nodes.filter(n => n.type === 'service').map(n => n.id) },
    { label: 'Utils', nodeIds: nodes.filter(n => n.type === 'util').map(n => n.id) },
    { label: 'Database', nodeIds: nodes.filter(n => n.type === 'db').map(n => n.id) },
    { label: 'Config', nodeIds: nodes.filter(n => n.type === 'config').map(n => n.id) },
    { label: 'Other', nodeIds: nodes.filter(n => !['entry','page','component','hook','store','service','util','db','config','test','style'].includes(n.type)).map(n => n.id) },
  ].filter(l => l.nodeIds.length > 0);

  return {
    root: resolved,
    nodes,
    totalLines: nodes.reduce((a, n) => a + n.lines, 0),
    totalFiles: nodes.length,
    layers,
  };
}
