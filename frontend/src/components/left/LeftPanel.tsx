import { useEffect, useState, useCallback } from 'react';
import { Folder, FileCode, GitPullRequest, Activity, ChevronRight, ChevronDown, Search, RefreshCw } from 'lucide-react';
import { useStore } from '../../stores/appStore';
import { changesApi, filesApi } from '../../services/api';
import { wsListen } from '../../services/ws';
import type { FileNode } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export default function LeftPanel() {
  const leftTab = useStore(s => s.leftTab);
  const setLeftTab = useStore(s => s.setLeftTab);
  const selectedFile = useStore(s => s.selectedFile);
  

  const tabs = [
    { id: 'files', icon: Folder, label: 'Files' },
    { id: 'changes', icon: GitPullRequest, label: 'Changes' },
    { id: 'actions', icon: Activity, label: 'Actions' },
  ];

  return (
    <div className="w-[280px] min-w-[220px] max-w-[400px] flex flex-col border-r border-border bg-bg-panel">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border">
        {tabs.map(t => (
          <TabButton
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={leftTab === t.id}
            onClick={() => setLeftTab(t.id)}
          />
        ))}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={leftTab}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {leftTab === 'files' && <FileExplorer />}
            {leftTab === 'changes' && <ChangeList />}
            {leftTab === 'actions' && <ActionList />}
          </motion.div>
        </AnimatePresence>
      </div>
      {selectedFile && (
        <div className="border-t border-border px-3 py-2 text-[11px] text-text-muted truncate font-mono bg-bg-surface">
          {selectedFile}
        </div>
      )}
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
        active
          ? 'bg-bg-surface text-text shadow-sm'
          : 'text-text-secondary hover:text-text hover:bg-bg-hover'
      }`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

// ─── File Tree ───
function FileExplorer() {
  const fileTree = useStore(s => s.fileTree);
  const setFileTree = useStore(s => s.setFileTree);
  const setSelectedFile = useStore(s => s.setSelectedFile);
  const setFileContent = useStore(s => s.setFileContent);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const projectRoot = useStore(s => s.projectRoot);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const rootPath = projectRoot || (window as any).__PROJECT_ROOT__ || '/';
      const tree = await filesApi.tree(rootPath);
      setFileTree(tree);
    } catch (err) {
      console.error('Failed to load file tree:', err);
      setFileTree(null);
    } finally {
      setLoading(false);
    }
  }, [setFileTree, projectRoot]);

  useEffect(() => {
    loadTree();
  }, [loadTree, projectRoot]);

  const handleFileClick = async (node: FileNode) => {
    if (node.type !== 'file') return;
    setSelectedFile(node.path);
    try {
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(node.path)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
      }
    } catch {
      setFileContent('// Unable to load file content');
    }
  };

  if (!fileTree && loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <RefreshCw size={20} className="text-text-muted animate-spin" />
        <span className="text-text-muted text-xs">Loading project files...</span>
      </div>
    );
  }

  if (!fileTree) return <Empty>No files found</Empty>;

  const filteredTree = search
    ? filterTree(fileTree!, search.toLowerCase())
    : fileTree;

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-2 border-b border-border">
        <div className="flex items-center gap-2 bg-bg-surface border border-border rounded-lg px-2.5 py-1.5">
          <Search size={12} className="text-text-muted shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-[11px] text-text placeholder:text-text-dim focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-text-muted hover:text-text">
              ×
            </button>
          )}
        </div>
      </div>
        <div className="flex-1 overflow-y-auto py-1">
          {filteredTree ? (
            <FileNodeView node={filteredTree} level={0} onFileClick={handleFileClick} search={search} />
          ) : (
            <div className="p-4 text-text-muted text-xs">No matching files found</div>
          )}
        </div>
    </div>
  );
}

function filterTree(node: FileNode, query: string): FileNode | null {
  if (node.name.toLowerCase().includes(query)) return node;
  if (node.children) {
    const filtered = node.children.map(c => filterTree(c, query)).filter(Boolean) as FileNode[];
    if (filtered.length > 0) return { ...node, children: filtered };
  }
  return null;
}

function FileNodeView({ node, level, onFileClick, search }: { node: FileNode; level: number; onFileClick: (n: FileNode) => void; search: string }) {
  const [open, setOpen] = useState(level < 2 || !!search);
  const selectedFile = useStore(s => s.selectedFile);
  const isSelected = selectedFile === node.path;

  useEffect(() => {
    if (search) setOpen(true);
  }, [search]);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 w-full text-left px-2 py-1 text-xs hover:bg-bg-hover transition-colors text-text-secondary group"
          style={{ paddingLeft: `${level * 14 + 8}px` }}
        >
          <span className="transition-transform duration-150">{open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
          <Folder size={13} className="text-text-muted group-hover:text-text-secondary" />
          <span className="truncate font-medium">{node.name}</span>
          {node.children && (
            <span className="ml-auto text-[10px] text-text-dim">{node.children.length}</span>
          )}
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {node.children?.map(child => (
                <FileNodeView key={child.path} node={child} level={level + 1} onFileClick={onFileClick} search={search} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  const langColors: Record<string, string> = {
    ts: 'text-accent', tsx: 'text-accent', js: 'text-warning', jsx: 'text-warning',
    css: 'text-text-secondary', scss: 'text-text-secondary', html: 'text-danger',
    json: 'text-text-muted', md: 'text-success', py: 'text-accent-dim',
    go: 'text-accent', rs: 'text-warning', java: 'text-danger', cpp: 'text-accent',
  };

  return (
    <button
      onClick={() => onFileClick(node)}
      className={`flex items-center gap-1.5 w-full text-left px-2 py-1 text-xs transition-all duration-100 ${
        isSelected
          ? 'bg-accent-bg text-accent border-l-2 border-accent'
          : 'hover:bg-bg-hover text-text-secondary border-l-2 border-transparent'
      }`}
      style={{ paddingLeft: `${level * 14 + 8}px` }}
    >
      <span className="w-3" />
      <FileCode size={12} className={langColors[ext] || 'text-text-muted'} />
      <span className="truncate">{node.name}</span>
      <span className="ml-auto text-[10px] text-text-dim shrink-0">{formatBytes(node.size)}</span>
    </button>
  );
}

// ─── Changes ───
function ChangeList() {
  const changes = useStore(s => s.changes);
  const setChanges = useStore(s => s.setChanges);

  useEffect(() => {
    changesApi.list().then(setChanges);
    const un = wsListen(msg => {
      if (msg.type === 'change') {
        const current = useStore.getState().changes;
        setChanges([msg.data, ...current]);
      }
    });
    return un;
  }, [setChanges]);

  if (!changes.length) return <Empty>No changes yet</Empty>;

  return (
    <div className="flex flex-col">
      {changes.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="border-b border-border px-3 py-2.5 hover:bg-bg-hover transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-block w-2 h-2 rounded-full ${
              c.changeType === 'add' ? 'bg-success' : c.changeType === 'remove' ? 'bg-danger' : 'bg-warning'
            }`} />
            <span className="font-mono text-[11px] text-text truncate">{c.filePath}</span>
            <span className="ml-auto text-[10px] text-text-dim">L{c.lineStart}</span>
          </div>
          <div className="text-[11px] text-text-secondary truncate group-hover:text-text transition-colors">{c.reason}</div>
          <div className="text-[10px] text-text-dim mt-1 flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
              c.status === 'applied' ? 'bg-success/10 text-success' :
              c.status === 'reverted' ? 'bg-danger-bg text-danger' :
              'bg-warning/10 text-warning'
            }`}>
              {c.status}
            </span>
            <span>{new Date(c.timestamp).toLocaleTimeString()}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Actions ───
function ActionList() {
  const actions = useStore(s => s.agentActions);
  if (!actions.length) return <Empty>No actions yet</Empty>;

  return (
    <div className="flex flex-col">
      {actions.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="border-b border-border px-3 py-2.5 hover:bg-bg-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
              a.status === 'completed' ? 'bg-success' :
              a.status === 'failed' ? 'bg-danger' : 'bg-warning'
            }`} />
            <span className="text-[11px] font-semibold text-text">{a.agent}</span>
            <span className="text-[11px] text-text-secondary">{a.action}</span>
            <span className="ml-auto text-[10px] text-text-dim">{new Date(a.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="text-[11px] text-text-muted truncate mt-0.5 pl-3.5">{a.target}</div>
        </motion.div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 gap-2">
      <span className="text-text-muted text-xs">{children}</span>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}K`;
  return `${(n / 1024 / 1024).toFixed(1)}M`;
}
