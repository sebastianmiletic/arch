import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../stores/appStore';
import { filesApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileCode, X, Hash } from 'lucide-react';
import type { FileNode } from '../types';

interface SearchResult {
  path: string;
  name: string;
  line: number;
  content: string;
  context: string;
  type: 'file' | 'content';
}

export default function CodebaseSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState({ files: true, content: true });
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [stats, setStats] = useState({ files: 0, lines: 0, matches: 0 });
  
  const setSelectedFile = useStore(s => s.setSelectedFile);

  useEffect(() => {
    const load = async () => {
      try {
        const rootPath = (window as any).__PROJECT_ROOT__ || '/Users/sebastianmiletic/Arch';
        const tree = await filesApi.tree(rootPath);
        setFileTree(tree);
        const { files, lines } = countStats(tree);
        setStats(s => ({ ...s, files, lines }));
      } catch { /* ignore */ }
    };
    load();
  }, []);

  const performSearch = useCallback(async () => {
    if (!query.trim() || !fileTree) return;
    setSearching(true);
    setResults([]);

    const q = query.toLowerCase();
    const found: SearchResult[] = [];

    // Search file names
    if (filters.files) {
      const matchingFiles = findFilesByName(fileTree, q);
      for (const f of matchingFiles) {
        found.push({
          path: f.path,
          name: f.name,
          line: 0,
          content: f.name,
          context: `File match`,
          type: 'file',
        });
      }
    }

    // Search file content (fetch and scan)
    if (filters.content) {
      const allFiles = getAllFiles(fileTree);
      // Limit to first 50 files for performance
      for (const file of allFiles.slice(0, 50)) {
        try {
          const res = await fetch(`/api/files/content?path=${encodeURIComponent(file.path)}`);
          if (!res.ok) continue;
          const data = await res.json();
          const lines = (data.content || '').split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
              found.push({
                path: file.path,
                name: file.name,
                line: i + 1,
                content: lines[i].trim(),
                context: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n'),
                type: 'content',
              });
            }
          }
        } catch { /* skip files that fail */ }
      }
    }

    setResults(found);
    setStats(s => ({ ...s, matches: found.length }));
    setSearching(false);
  }, [query, fileTree, filters]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim().length > 2) performSearch();
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, performSearch]);

  const handleResultClick = async (result: SearchResult) => {
    setSelectedFile(result.path);
    try {
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(result.path)}`);
      if (res.ok) {
        const data = await res.json();
        useStore.getState().setFileContent(data.content);
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">Codebase Search</span>
          <div className="ml-auto flex items-center gap-3 text-[10px] text-text-muted">
            <span>{stats.files.toLocaleString()} files</span>
            <span>{stats.lines.toLocaleString()} lines</span>
            {stats.matches > 0 && <span className="text-accent">{stats.matches} matches</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-bg-surface border border-border rounded-xl px-3 py-2 focus-within:border-accent transition-colors"
>
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search files, functions, variables..."
              className="flex-1 bg-transparent text-xs text-text placeholder:text-text-dim focus:outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); }} className="text-text-muted hover:text-text">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => performSearch()}
            disabled={searching}
            className="px-4 py-2 bg-accent text-bg text-[11px] font-bold rounded-xl hover:opacity-90 disabled:opacity-30 transition-all"
          >
            {searching ? '...' : 'Search'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <FilterToggle label="Files" active={filters.files} onChange={() => setFilters(f => ({ ...f, files: !f.files }))} />
          <FilterToggle label="Content" active={filters.content} onChange={() => setFilters(f => ({ ...f, content: !f.content }))} />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searching && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            <span className="text-[11px] text-text-muted">Searching codebase...</span>
          </div>
        )}

        {!searching && query && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Search size={24} className="text-text-dim" />
            <span className="text-[11px] text-text-muted">No results found for "{query}"</span>
          </div>
        )}

        {!query && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent-bg flex items-center justify-center">
              <Search size={24} className="text-accent/50" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[12px] text-text-secondary font-medium">Search your codebase</p>
              <p className="text-[11px] text-text-muted">Type to search across all files</p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {results.map((result, i) => (
            <motion.div
              key={`${result.path}-${result.line}-${i}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => handleResultClick(result)}
              className="border-b border-border px-3 py-2.5 hover:bg-bg-hover transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 mb-1">
                <FileCode size={12} className="text-accent shrink-0" />
                <span className="text-[11px] text-text font-mono truncate">{result.path}</span>
                {result.line > 0 && (
                  <span className="text-[10px] text-text-muted font-mono shrink-0">L{result.line}</span>
                )}
                <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  result.type === 'file' ? 'bg-accent-bg text-accent' : 'bg-bg-surface text-text-secondary'
                }`}>
                  {result.type}
                </span>
              </div>
              {result.type === 'content' && (
                <div className="font-mono text-[11px] text-text-secondary pl-5">
                  <pre className="truncate">{highlightMatch(result.content, query)}</pre>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FilterToggle({ label, active, onChange }: { label: string; active: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all ${
        active
          ? 'bg-accent-bg text-accent border border-accent/20'
          : 'bg-bg-surface text-text-muted border border-border'
      }`}
    >
      {active && <Hash size={10} />}
      {label}
    </button>
  );
}

function findFilesByName(node: FileNode, query: string): FileNode[] {
  const results: FileNode[] = [];
  if (node.name.toLowerCase().includes(query)) results.push(node);
  if (node.children) {
    for (const child of node.children) {
      results.push(...findFilesByName(child, query));
    }
  }
  return results;
}

function getAllFiles(node: FileNode): FileNode[] {
  const results: FileNode[] = [];
  if (node.type === 'file') results.push(node);
  if (node.children) {
    for (const child of node.children) {
      results.push(...getAllFiles(child));
    }
  }
  return results;
}

function countStats(node: FileNode): { files: number; lines: number } {
  let files = 0;
  let lines = 0;
  if (node.type === 'file') {
    files++;
    lines += Math.floor(node.size / 40); // rough estimate
  }
  if (node.children) {
    for (const child of node.children) {
      const childStats = countStats(child);
      files += childStats.files;
      lines += childStats.lines;
    }
  }
  return { files, lines };
}

function highlightMatch(text: string, query: string) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  return (
    <>
      {before}
      <mark className="bg-accent/20 text-accent rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}
