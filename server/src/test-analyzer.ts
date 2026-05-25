// test-analyzer.ts — Real project analysis producing scored test issues
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

export interface TestIssue {
  id: string;
  category: string;
  file?: string;
  line?: number;
  column?: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  fixSuggestion: string;
  scoreImpact: number;
}

export interface TestResult {
  mode: string;
  root: string;
  totalFiles: number;
  scannedFiles: number;
  scores: Record<string, number>;
  overallScore: number;
  issues: TestIssue[];
  duration: number;
}

interface FileEntry { path: string; name: string; ext: string; size: number; lines: number; }

function walk(dir: string, maxDepth = 8, depth = 0): FileEntry[] {
  if (depth > maxDepth) return [];
  const entries: FileEntry[] = [];
  try {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build' || name === '.git') continue;
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) entries.push(...walk(p, maxDepth, depth + 1));
      else if (s.isFile() && s.size < 5 * 1024 * 1024) {
        try {
          const ext = extname(name).toLowerCase();
          const content = readFileSync(p, 'utf-8');
          const lines = content.split('\n').length;
          entries.push({ path: p, name, ext, size: s.size, lines });
        } catch { /* skip */ }
      }
    }
  } catch { /* skip unreadable dirs */ }
  return entries;
}

function score(max: number, deductions: number): number { return Math.max(0, Math.round(max - deductions)); }

export function analyzeProject(root: string, mode: string): TestResult {
  const start = Date.now();
  const files = walk(root);
  const scanned = mode === 'quick' ? files.slice(0, 200) : mode === 'deep' ? files : files.slice(0, 500);
  const issues: TestIssue[] = [];
  let structureDeduction = 0, securityDeduction = 0, qualityDeduction = 0, uiDeduction = 0, perfDeduction = 0, a11yDeduction = 0, depDeduction = 0;

  for (const f of scanned) {
    let content: string;
    try { content = readFileSync(f.path, 'utf-8'); } catch { continue; }
    const rel = f.path.replace(root, '');

    // ─── Structure ───
    if (f.lines > 500 && (f.ext === '.ts' || f.ext === '.tsx' || f.ext === '.js' || f.ext === '.jsx')) {
      const deduction = Math.min(3, Math.floor((f.lines - 500) / 300));
      structureDeduction += deduction;
      issues.push({ id: `struct-${f.path}`, category: 'structure', file: rel, severity: 'warning', message: `File is ${f.lines} lines — consider splitting into smaller modules`, fixSuggestion: `Refactor ${rel} into multiple files (e.g. util.ts, component.tsx) using barrel exports.`, scoreImpact: deduction });
    }
    if ((f.ext === '.ts' || f.ext === '.tsx') && content.includes('export default') && content.includes('namedExport')) {
      // Nothing special
    }
    // Detect unused imports (simple check)
    const importMatches = content.match(/^\s*import\s+.*?\s+from\s+['"][^'"]+['"];?\s*$/gm) || [];
    for (const imp of importMatches) {
      const names = imp.match(/\{([^}]+)\}/);
      if (names) {
        for (const name of names[1].split(',').map(s => s.trim().split(' ')[0].replace(/[^a-zA-Z0-9_$]/, ''))) {
          if (name && !content.includes(name + '(') && !content.includes(' <' + name) && !content.includes('return ' + name) && !content.includes('export ' + name)) {
            qualityDeduction += 1;
            issues.push({ id: `unused-${f.path}-${name}`, category: 'quality', file: rel, line: 1, severity: 'info', message: `Possibly unused import: ${name}`, fixSuggestion: `Remove import { ${name} } from ... if not used in ${rel}.`, scoreImpact: 1 });
          }
        }
      }
    }

    // ─── Security ───
    if (content.includes('eval(') || content.includes('new Function(')) {
      securityDeduction += 8;
      issues.push({ id: `sec-eval-${f.path}`, category: 'security', file: rel, severity: 'critical', message: 'Dangerous eval() or new Function() detected', fixSuggestion: 'Use JSON.parse() for data parsing or structured alternatives to dynamic code execution.', scoreImpact: 8 });
    }
    if (content.includes('innerHTML') && !content.includes('DOMPurify') && !content.includes('sanitize')) {
      securityDeduction += 5;
      issues.push({ id: `sec-xss-${f.path}`, category: 'security', file: rel, severity: 'error', message: 'innerHTML usage without sanitization', fixSuggestion: 'Use DOMPurify.sanitize() before innerHTML or switch to React JSX rendering.', scoreImpact: 5 });
    }
    if (content.match(/password\s*=\s*['"][^'"]{0,30}['"]/) || content.match(/api[_-]?key\s*=\s*['"][^'"]+['"]/i)) {
      securityDeduction += 10;
      issues.push({ id: `sec-key-${f.path}`, category: 'security', file: rel, severity: 'critical', message: 'Hardcoded credential detected in source', fixSuggestion: 'Move secrets to environment variables (.env) and use a config loader like dotenv.', scoreImpact: 10 });
    }
    if (content.includes('http://') && !content.includes('localhost')) {
      securityDeduction += 2;
      issues.push({ id: `sec-http-${f.path}`, category: 'security', file: rel, severity: 'warning', message: 'Insecure HTTP URL found', fixSuggestion: 'Upgrade to HTTPS URLs for all external API calls.', scoreImpact: 2 });
    }

    // ─── Code Quality ───
    if (f.ext === '.js' && !content.includes('use strict') && f.lines > 5) {
      qualityDeduction += 1;
      issues.push({ id: `qs-${f.path}`, category: 'quality', file: rel, severity: 'info', message: 'Missing "use strict" directive', fixSuggestion: 'Add "use strict"; at the top of the file or convert to TypeScript.', scoreImpact: 1 });
    }
    if (f.ext === '.tsx' && content.includes('any')) {
      const count = (content.match(/\bany\b/g) || []).length;
      const deduction = Math.min(count, 5);
      qualityDeduction += deduction;
      if (count > 3) {
        issues.push({ id: `qa-${f.path}`, category: 'quality', file: rel, severity: 'warning', message: `${count} occurrences of 'any' type`, fixSuggestion: 'Replace any with proper interfaces or use unknown + type guards for runtime safety.', scoreImpact: deduction });
      }
    }
    if (content.includes('TODO') || content.includes('FIXME') || content.includes('HACK')) {
      const todos = (content.match(/TODO/gi) || []).length + (content.match(/FIXME/gi) || []).length + (content.match(/HACK/gi) || []).length;
      if (todos > 1) {
        qualityDeduction += Math.min(todos, 3);
        issues.push({ id: `qt-${f.path}`, category: 'quality', file: rel, severity: 'info', message: `${todos} TODO/FIXME comments found`, fixSuggestion: 'Resolve technical debt items and convert to tracked issues or remove completed items.', scoreImpact: Math.min(todos, 3) });
      }
    }

    // ─── UI / Accessibility ───
    if ((f.ext === '.tsx' || f.ext === '.jsx' || f.ext === '.html') && content.includes('<img') && !content.includes('alt=')) {
      uiDeduction += 3;
      issues.push({ id: `ui-alt-${f.path}`, category: 'ui', file: rel, severity: 'error', message: '<img> tag missing alt attribute', fixSuggestion: 'Add descriptive alt="..." to all <img> tags for screen readers.', scoreImpact: 3 });
    }
    if ((f.ext === '.tsx' || f.ext === '.jsx') && content.match(/style\s*=\s*\{\{\[/m)) {
      // inline style arrays — nothing major
    }
    if (f.ext === '.css' || f.ext === '.scss') {
      if (content.includes('px') && !content.includes('rem') && !content.includes('em') && f.lines > 20) {
        uiDeduction += 2;
        issues.push({ id: `ui-px-${f.path}`, category: 'ui', file: rel, severity: 'info', message: 'CSS uses px units — consider rem/em for accessibility', fixSuggestion: 'Replace px with rem units for fonts and spacing to respect user zoom settings.', scoreImpact: 2 });
      }
    }

    // ─── Performance ───
    if (content.includes('requestAnimationFrame') && content.includes('setState') && f.ext.startsWith('.tsx')) {
      perfDeduction += 3;
      issues.push({ id: `perf-raf-${f.path}`, category: 'performance', file: rel, severity: 'warning', message: 'Potential setState in requestAnimationFrame loop', fixSuggestion: 'Debounce or batch state updates in animation loops. Consider using refs or CSS transforms.', scoreImpact: 3 });
    }
    if (content.includes('JSON.parse') && f.size > 100_000) {
      perfDeduction += 2;
      issues.push({ id: `perf-json-${f.path}`, category: 'performance', file: rel, severity: 'info', message: 'Large file with JSON.parse — memory risk', fixSuggestion: 'Stream large JSON or use a streaming JSON parser instead of loading into memory.', scoreImpact: 2 });
    }

    // ─── Dependencies ───
    if (f.name === 'package.json' || f.name === 'Cargo.toml' || f.name === 'requirements.txt') {
      if (f.name === 'package.json') {
        try {
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          for (const [name] of Object.entries(deps)) {
            if (['lodash', 'moment', 'jquery'].includes(name.toLowerCase())) {
              depDeduction += 2;
              issues.push({ id: `dep-${name}-${f.path}`, category: 'dependencies', file: rel, severity: 'warning', message: `Legacy dependency: ${name}`, fixSuggestion: `Replace ${name} with modern alternatives (e.g. date-fns for moment, native methods for lodash).`, scoreImpact: 2 });
            }
          }
        } catch { /* skip malformed */ }
      }
    }
  }

  // ─── Package.json missing scripts ───
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (!pkg.scripts?.test) {
        issues.push({ id: 'dep-no-test', category: 'dependencies', file: 'package.json', severity: 'warning', message: 'No test script in package.json', fixSuggestion: 'Add "test": "vitest" or "jest" script with at least one passing test.', scoreImpact: 5 });
      }
      if (!pkg.scripts?.lint) {
        issues.push({ id: 'dep-no-lint', category: 'dependencies', file: 'package.json', severity: 'info', message: 'No lint script in package.json', fixSuggestion: 'Add "lint": "eslint . --ext .ts,.tsx" for code quality enforcement.', scoreImpact: 2 });
      }
    } catch { /* skip */ }
  }

  const scores = {
    structure: score(100, structureDeduction),
    security: score(100, securityDeduction),
    quality: score(100, qualityDeduction),
    ui: score(100, uiDeduction),
    performance: score(100, perfDeduction),
    accessibility: score(100, a11yDeduction),
    dependencies: score(100, depDeduction),
  };

  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);

  return {
    mode,
    root,
    totalFiles: files.length,
    scannedFiles: scanned.length,
    scores,
    overallScore: overall,
    issues: issues.sort((a, b) => {
      const order = { critical: 0, error: 1, warning: 2, info: 3 };
      return order[a.severity] - order[b.severity];
    }),
    duration: Date.now() - start,
  };
}
