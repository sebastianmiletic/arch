import { readdirSync, statSync } from 'fs';
import { join, extname, resolve } from 'path';
import type { FileNode } from './types.js';

const EXT_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
  '.json': 'json', '.md': 'markdown', '.css': 'css', '.html': 'html',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
};

const MAX_DEPTH = 4;
const MAX_FILES = 200;
let fileCount = 0;

export function getFileTree(root: string): FileNode {
  fileCount = 0;
  return buildNode(resolve(root || '.'), resolve(root || '.'), 0);
}

function buildNode(absPath: string, rootPath: string, depth: number): FileNode {
  const stats = statSync(absPath);
  if (stats.isDirectory()) {
    if (depth >= MAX_DEPTH) {
      return { name: absPath.split('/').pop() || '', path: absPath, type: 'directory', size: 0, modified: stats.mtime.toISOString(), children: [] };
    }
    try {
      const entries = readdirSync(absPath);
      const children: FileNode[] = [];
      for (const e of entries) {
        if (e.startsWith('.') || e === 'node_modules' || e === 'dist' || e === 'build') continue;
        if (fileCount >= MAX_FILES) break;
        children.push(buildNode(join(absPath, e), rootPath, depth + 1));
      }
      return {
        name: absPath === rootPath ? rootPath.split('/').pop() || rootPath : absPath.split('/').pop() || '',
        path: absPath,
        type: 'directory',
        size: 0,
        modified: stats.mtime.toISOString(),
        children,
      };
    } catch {
      return { name: absPath.split('/').pop() || '', path: absPath, type: 'directory', size: 0, modified: stats.mtime.toISOString(), children: [] };
    }
  }
  fileCount++;
  return {
    name: absPath.split('/').pop() || '',
    path: absPath,
    type: 'file',
    size: stats.size,
    modified: stats.mtime.toISOString(),
    language: EXT_LANG[extname(absPath).toLowerCase()],
  };
}
