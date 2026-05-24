import { readdirSync, statSync } from 'fs';
import { join, extname, resolve } from 'path';
import { execSync } from 'child_process';
const EXT_LANG = {
    '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
    '.json': 'json', '.md': 'markdown', '.css': 'css', '.html': 'html',
    '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
};
const MAX_DEPTH = 4;
const MAX_FILES = 200;
let fileCount = 0;
export function getFileTree(root) {
    fileCount = 0;
    return buildNode(resolve(root || '.'), resolve(root || '.'), 0);
}
function buildNode(absPath, rootPath, depth) {
    const stats = statSync(absPath);
    if (stats.isDirectory()) {
        if (depth >= MAX_DEPTH) {
            return { name: absPath.split('/').pop() || '', path: absPath, type: 'directory', size: 0, modified: stats.mtime.toISOString(), children: [] };
        }
        try {
            const entries = readdirSync(absPath);
            const children = [];
            for (const e of entries) {
                if (e.startsWith('.') || e === 'node_modules' || e === 'dist' || e === 'build')
                    continue;
                if (fileCount >= MAX_FILES)
                    break;
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
        }
        catch {
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
export function getProjectStats(root) {
    const resolved = require('path').resolve(root);
    let files = 0;
    let lines = 0;
    const langCount = {};
    const EXT_LANG = {
        '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
        '.json': 'json', '.md': 'markdown', '.css': 'css', '.html': 'html',
        '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
        '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
        '.swift': 'swift', '.kt': 'kotlin', '.scala': 'scala',
        '.php': 'php', '.rb': 'ruby', '.sh': 'shell', '.sql': 'sql',
        '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml', '.xml': 'xml',
    };
    function scan(dir, depth) {
        if (depth > 4)
            return;
        try {
            const entries = require('fs').readdirSync(dir);
            for (const e of entries) {
                if (e.startsWith('.') || e === 'node_modules' || e === 'dist' || e === 'build' || e === '.git' || e === '.next' || e === 'out')
                    continue;
                const p = require('path').join(dir, e);
                const s = require('fs').statSync(p);
                if (s.isDirectory()) {
                    scan(p, depth + 1);
                }
                else {
                    files++;
                    const ext = require('path').extname(e).toLowerCase();
                    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.swift', '.kt', '.php', '.rb', '.sh', '.sql', '.yaml', '.yml', '.toml', '.xml'];
                    if (codeExts.includes(ext)) {
                        try {
                            const content = require('fs').readFileSync(p, 'utf-8');
                            const fileLines = content.split('\n').length;
                            lines += fileLines;
                            const lang = EXT_LANG[ext];
                            if (lang)
                                langCount[lang] = (langCount[lang] || 0) + fileLines;
                        }
                        catch { }
                    }
                }
            }
        }
        catch { }
    }
    scan(resolved, 0);
    let gitCommits = 0;
    let lastModified = new Date().toISOString();
    try {
        gitCommits = parseInt(execSync('git rev-list --count HEAD', { cwd: resolved, encoding: 'utf-8' }).trim());
        lastModified = execSync('git log -1 --format=%cI', { cwd: resolved, encoding: 'utf-8' }).trim();
    }
    catch { }
    return { fileCount: files, lineCount: lines, languageBreakdown: langCount, gitCommits, lastModified };
}
//# sourceMappingURL=fs-utils.js.map