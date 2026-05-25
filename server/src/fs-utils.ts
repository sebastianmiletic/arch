import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname, resolve } from 'path';
import { execSync } from 'child_process';
import type { FileNode } from './types.js';

const EXT_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
  '.json': 'json', '.md': 'markdown', '.css': 'css', '.html': 'html',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
};

const MAX_DEPTH = 4;
const MAX_FILES = 200;
let fileCount = 0;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.turbo', 'coverage', 'vendor', '__pycache__', '.github', '.vscode', '.idea', 'release', 'release-builds', '.husky']);

export function getFileTree(root: string): FileNode {
  fileCount = 0;
  const resolved = resolve(root || '.');
  return buildNode(resolved, resolved, 0);
}

function buildNode(absPath: string, rootPath: string, depth: number): FileNode {
  try {
    const stats = statSync(absPath);
    const name = absPath === rootPath ? (rootPath.split('/').pop() || rootPath) : (absPath.split('/').pop() || '');
    const modified = stats.mtime.toISOString();

    if (stats.isDirectory()) {
      if (depth >= MAX_DEPTH) {
        return { name, path: absPath, type: 'directory', size: 0, modified, children: [] };
      }
      try {
        const entries = readdirSync(absPath);
        const children: FileNode[] = [];
        for (const e of entries) {
          if (e.startsWith('.') && e !== '.env' && e !== '.env.local') continue;
          if (SKIP_DIRS.has(e)) continue;
          if (fileCount >= MAX_FILES) break;
          children.push(buildNode(join(absPath, e), rootPath, depth + 1));
        }
        return { name, path: absPath, type: 'directory', size: 0, modified, children };
      } catch {
        return { name, path: absPath, type: 'directory', size: 0, modified, children: [] };
      }
    }

    fileCount++;
    return {
      name,
      path: absPath,
      type: 'file',
      size: stats.size,
      modified,
      language: EXT_LANG[extname(absPath).toLowerCase()],
    };
  } catch (err: any) {
    // Path doesn't exist or inaccessible — return a placeholder node
    const name = absPath.split('/').pop() || '';
    return { name, path: absPath, type: 'file', size: 0, modified: new Date().toISOString() };
  }
}

export function getProjectStats(root: string) {
  const resolved = resolve(root || '.');
  let files = 0;
  let lines = 0;
  const langCount: Record<string, number> = {};

  const CODE_EXTS = new Set([
    '.ts','.tsx','.js','.jsx','.json','.md','.css','.html','.py','.go','.rs',
    '.java','.c','.cpp','.h','.hpp','.swift','.kt','.php','.rb','.sh','.sql',
    '.yaml','.yml','.toml','.xml','.vue','.svelte','.scss','.sass','.less',
    '.dockerfile','.prisma','.graphql','.gql',
  ]);

  const ALL_EXT_LANG: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
    '.json': 'json', '.md': 'markdown', '.css': 'css', '.html': 'html',
    '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
    '.swift': 'swift', '.kt': 'kotlin', '.php': 'php',
    '.rb': 'ruby', '.sh': 'shell', '.sql': 'sql',
    '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml', '.xml': 'xml',
    '.vue': 'vue', '.svelte': 'svelte', '.scss': 'scss',
  };

  function scan(dir: string, depth: number) {
    if (depth > 4) return;
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }

    for (const e of entries) {
      if (e.startsWith('.') || SKIP_DIRS.has(e)) continue;
      const p = join(dir, e);
      let s;
      try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) {
        scan(p, depth + 1);
      } else {
        files++;
        const ext = extname(e).toLowerCase();
        if (!CODE_EXTS.has(ext)) continue;
        try {
          const content = readFileSync(p, 'utf-8');
          const fileLines = content.split('\n').length;
          lines += fileLines;
          const lang = ALL_EXT_LANG[ext];
          if (lang) langCount[lang] = (langCount[lang] || 0) + fileLines;
        } catch {}
      }
    }
  }

  try { scan(resolved, 0); } catch {}

  let gitCommits = 0;
  let lastModified = new Date().toISOString();
  try {
    gitCommits = parseInt(execSync('git rev-list --count HEAD', { cwd: resolved, encoding: 'utf-8' }).trim());
    lastModified = execSync('git log -1 --format=%cI', { cwd: resolved, encoding: 'utf-8' }).trim();
  } catch {}

  return { fileCount: files, lineCount: lines, languageBreakdown: langCount, gitCommits, lastModified };
}
