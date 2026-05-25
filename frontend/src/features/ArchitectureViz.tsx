import { useState, useEffect, useCallback } from 'react';
import { Layers, Search, Compass, FileCode, ArrowUpRight, Eye, X } from 'lucide-react';
import { useStore } from '../stores/appStore';

interface ArchNode {
  id: string;
  label: string;
  type: string;
  path: string;
  depth: number;
  lines: number;
  imports: string[];
  importedBy: string[];
  exports: string[];
  tech: string[];
}

interface ArchGraph {
  root: string;
  nodes: ArchNode[];
  totalLines: number;
  totalFiles: number;
  layers: { label: string; nodeIds: string[] }[];
}

export default function ArchitectureViz() {
  const projectRoot = useStore(s => s.projectRoot);
  const [graph, setGraph] = useState<ArchGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'dependencies' | 'overview'>('dependencies');
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  const load = useCallback(async () => {
    const root = projectRoot || (window as any).__PROJECT_ROOT__ || '/Users/sebastianmiletic/Arch';
    setLoading(true);
    try {
      const res = await fetch(`/api/project-graph?root=${encodeURIComponent(root)}`);
      if (!res.ok) throw new Error(await res.text());
      setGraph(await res.json());
    } catch {
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }, [projectRoot]);

  useEffect(() => {
    load();
  }, [load]);

  const nodeById = useCallback((id: string) => graph?.nodes.find(n => n.id === id), [graph]);

  const stats = {
    files: graph?.totalFiles || 0,
    lines: graph?.totalLines || 0,
    types: graph ? Object.entries(graph.nodes.reduce((acc, n) => { acc[n.type] = (acc[n.type] || 0) + 1; return acc; }, {} as Record<string, number>)) : [],
    topImports: graph ? [...graph.nodes].sort((a, b) => b.importedBy.length - a.importedBy.length).slice(0, 5) : [],
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">Architecture</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-bg-surface border border-border rounded-lg px-2 py-1">
            <Search size={11} className="text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Find file..."
              className="bg-transparent text-[11px] text-text placeholder:text-text-dim focus:outline-none w-28"
            />
          </div>
          <button onClick={() => setView(view === 'dependencies' ? 'overview' : 'dependencies')}
            className="text-[10px] px-2 py-1 rounded bg-bg-surface border border-border text-text-secondary hover:bg-bg-hover transition-colors"
          >
            {view === 'dependencies' ? 'Overview' : 'Deps'}
          </button>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors">
            <Compass size={12} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <div className="w-6 h-6 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <span className="text-[11px]">Analyzing project structure...</span>
          </div>
        </div>
      )}

      {!loading && !graph && (
        <div className="flex-1 flex items-center justify-center text-text-muted text-[12px]">Failed to load project graph.</div>
      )}

      {!loading && graph && view === 'overview' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Files" value={stats.files} />
            <StatCard label="Lines" value={stats.lines.toLocaleString()} />
            <StatCard label="Types" value={stats.types.length} />
          </div>

          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Files by Type</p>
            <div className="grid grid-cols-2 gap-2">
              {stats.types.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 rounded-lg border border-border bg-bg-surface">
                  <span className="text-[11px] text-text-secondary capitalize">{type}</span>
                  <span className="text-[12px] font-bold text-text">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Most Referenced</p>
            <div className="space-y-1">
              {stats.topImports.map(n => (
                <div key={n.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-bg-surface hover:bg-bg-hover transition-colors cursor-pointer"
                  onClick={() => setSelectedNode(n)}
                >
                  <span className="text-[11px] text-text truncate font-mono">{n.label}</span>
                  <span className="text-[9px] text-text-muted">{n.importedBy.length} refs · {n.lines} lines</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Layers</p>
            <div className="space-y-1">
              {graph.layers.map(l => (
                <button key={l.label} onClick={() => setSelectedLayer(prev => prev === l.label ? null : l.label)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
                    selectedLayer === l.label ? 'border-accent bg-accent-bg/30' : 'border-border bg-bg-surface hover:bg-bg-hover'
                  }`}
                >
                  <span className="text-[11px] text-text-secondary font-medium">{l.label}</span>
                  <span className="text-[11px] font-bold text-text">{l.nodeIds.length}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && graph && view === 'dependencies' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6 min-w-[600px]">
            {graph.layers.map(layer => {
              const layerNodes = layer.nodeIds
                .map(id => graph.nodes.find(n => n.id === id))
                .filter(Boolean) as ArchNode[];
              const visible = search ? layerNodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase())) : layerNodes;
              if (visible.length === 0) return null;
              return (
                <div key={layer.label}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted px-2">{layer.label} · {visible.length}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {visible.map(node => {
                      const dimmed = selectedLayer && selectedLayer !== layer.label;
                      return (
                        <button key={node.id} onClick={() => setSelectedNode(node)}
                          className={`relative px-3 py-2 rounded-xl border text-left transition-all ${
                            dimmed ? 'opacity-30' : 'opacity-100'
                          } ${selectedNode?.id === node.id ? 'border-accent bg-accent-bg shadow-md' : 'border-border bg-bg-surface hover:border-border-strong'}`}
                        >
                          <span className="text-[11px] font-semibold text-text">{node.label}</span>
                          <div className="text-[9px] text-text-muted mt-1">
                            {node.lines} lines · {node.importedBy.length} refs
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedNode && graph && (
        <div className="absolute top-3 right-3 w-80 bg-bg-panel/95 backdrop-blur border border-border rounded-xl p-4 shadow-xl z-40 max-h-[90%] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-sm text-text-heading truncate pr-2">{selectedNode.label}</span>
            <button onClick={() => setSelectedNode(null)} className="text-text-muted hover:text-text"><X size={12} /></button>
          </div>
          <p className="text-[10px] text-text-muted font-mono mb-3">{selectedNode.path}</p>

          <div className="space-y-3">
            <div className="flex gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-bg-hover text-text-secondary capitalize">{selectedNode.type}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-bg-hover text-text-muted">{selectedNode.lines} lines</span>
            </div>

            {selectedNode.tech.length > 0 && (
              <div>
                <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Tech</div>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.tech.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-bg-surface text-accent border border-accent/20">{t}</span>)}
                </div>
              </div>
            )}

            {selectedNode.exports.length > 0 && (
              <div>
                <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Exports</div>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.exports.map(ex => <span key={ex} className="text-[10px] px-2 py-0.5 rounded bg-bg-surface text-text-secondary border border-border font-mono">{ex}</span>)}
                </div>
              </div>
            )}

            {selectedNode.imports.length > 0 && (
              <div>
                <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Imports ({selectedNode.imports.length})</div>
                <div className="max-h-32 overflow-y-auto space-y-0.5 divide-y divide-border">
                  {selectedNode.imports.map(imp => {
                    const target = graph.nodes.find(n => n.id === imp || n.path === imp);
                    return (
                      <button key={imp} onClick={() => target && setSelectedNode(target)}
                        className="w-full text-left text-[10px] text-text-secondary hover:text-accent py-1 px-1 rounded hover:bg-bg-hover transition-colors flex items-center gap-1"
                      >
                        <ArrowUpRight size={9} />
                        <span className="truncate font-mono">{target?.label || imp}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedNode.importedBy.length > 0 && (
              <div>
                <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Used By ({selectedNode.importedBy.length})</div>
                <div className="max-h-32 overflow-y-auto space-y-0.5 divide-y divide-border">
                  {selectedNode.importedBy.map(id => {
                    const source = nodeById(id);
                    return source ? (
                      <button key={id} onClick={() => setSelectedNode(source)}
                        className="w-full text-left text-[10px] text-text-secondary hover:text-accent py-1 px-1 rounded hover:bg-bg-hover transition-colors flex items-center gap-1"
                      >
                        <Eye size={9} />
                        <span className="truncate font-mono">{source.label}</span>
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                const store = useStore.getState();
                const absPath = `${graph.root}/${selectedNode.path}`;
                store.setSelectedFile(absPath);
                try {
                  const res = await fetch(`/api/files/content?path=${encodeURIComponent(absPath)}`);
                  if (res.ok) { const d = await res.json(); store.setFileContent(d.content); store.setLeftTab('files'); }
                } catch {}
              }}
              className="mt-2 w-full py-1.5 text-[10px] bg-accent text-bg rounded-lg hover:opacity-90 flex items-center justify-center gap-1"
            >
              <FileCode size={10} /> Open File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-bg-surface">
      <div className="text-[9px] text-text-muted mb-1">{label}</div>
      <div className="text-lg font-bold text-text">{value}</div>
    </div>
  );
}
