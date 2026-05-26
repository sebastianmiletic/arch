import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Folder, Zap, Layers,
  ArrowRight, Clock, Hash,
  AlertCircle, RefreshCw, Trash2, Search,
  BarChart3
} from 'lucide-react';
import { useStore } from '../stores/appStore';
import { projectApi } from '../services/api';

function ArchLogo({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="Arch"
      className="shrink-0"
      draggable={false}
    />
  );
}

export default function HomeScreen() {
  const theme = useStore((s: any) => s.theme);
  const projectRoot = useStore((s: any) => s.projectRoot);
  const setProjectRoot = useStore((s: any) => s.setProjectRoot);
  const setCenterTab = useStore((s: any) => s.setCenterTab);
  const setLeftTab = useStore((s: any) => s.setLeftTab);
  const extensions = useStore((s: any) => s.extensions);
  const setShowHome = useStore((s: any) => s.setShowHome);
  const sessions = useStore((s: any) => s.sessions);

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<{ id: string; path: string; name: string; openedAt: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("arch:recentProjects");
    if (saved) { try { setRecentProjects(JSON.parse(saved)); } catch {} }
  }, []);

  useEffect(() => { if (projectRoot) loadStats(projectRoot); }, [projectRoot]);

  const loadStats = useCallback(async (root: string) => {
    setLoading(true); setError(null);
    try { const data = await projectApi.stats(root); setStats(data); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  const handleSelectDir = useCallback(async () => {
    try {
      const result = await (window as any).electron?.selectProject?.();
      if (result && !result.canceled && result.filePaths?.length > 0) {
        const root = result.filePaths[0];
        setProjectRoot(root);
        addRecentProject(root);
        setShowHome(false);
        setLeftTab("files");
      }
    } catch {
      const root = prompt("Enter project directory path:");
      if (root) {
        setProjectRoot(root);
        addRecentProject(root);
        setShowHome(false);
        setLeftTab("files");
      }
    }
  }, [setProjectRoot, setShowHome, setLeftTab]);

  const addRecentProject = (root: string) => {
    const name = root.split("/").pop() || root;
    const item = { id: Date.now().toString(), path: root, name, openedAt: new Date().toISOString() };
    setRecentProjects(prev => {
      const filtered = prev.filter(p => p.path !== root);
      const next = [item, ...filtered].slice(0, 8);
      localStorage.setItem("arch:recentProjects", JSON.stringify(next)); return next;
    });
  };

  const removeRecent = (id: string) => {
    setRecentProjects(prev => { const next = prev.filter(p => p.id !== id); localStorage.setItem("arch:recentProjects", JSON.stringify(next)); return next; });
  };

  const totalExts = extensions.length;
  // all extensions are installed by default

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="p-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: theme.accentBg, border: `1px solid ${theme.borderStrong}` }}>
              <ArchLogo size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-heading tracking-tight">Arch</h1>
              <p className="text-[12px] text-text-muted">AI-native code studio</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border bg-bg-surface p-5">
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen size={16} className="text-accent" />
                <span className="text-[12px] font-bold text-text-heading">Project</span>
              </div>

              {projectRoot ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-bg border border-border">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: theme.accentBg }}>
                      <Folder size={16} style={{ color: theme.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-text">{projectRoot.split("/").pop() || "Project"}</p>
                      <p className="text-[10px] text-text-muted">{projectRoot}</p>
                    </div>
                    <button onClick={handleSelectDir} className="text-[10px] text-accent hover:underline px-2 py-1">Change</button>
                  </div>

                  {loading && (
                    <div className="flex items-center justify-center py-8 gap-2 text-text-muted">
                      <RefreshCw size={14} className="animate-spin" /><span className="text-[11px]">Scanning project...</span>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-bg border border-danger/20 text-[11px] text-danger">
                      <AlertCircle size={12} /> {error}
                    </div>
                  )}
                  {stats && !loading && (
                    <div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <StatCard label="Files" value={String(stats.fileCount)} />
                        <StatCard label="Lines" value={String(stats.lineCount)} />
                        <StatCard label="Commits" value={String(stats.gitCommits)} />
                        <StatCard label="Modified" value={new Date(stats.lastModified).toLocaleDateString()} />
                      </div>
                      {Object.keys(stats.languageBreakdown).length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Languages</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(stats.languageBreakdown).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8).map(([lang, count]: any) => (
                              <span key={lang} className="text-[10px] px-2 py-1 rounded-md border border-border bg-bg">
                                <span className="font-semibold text-text-secondary">{lang}</span>
                                <span className="text-text-muted ml-1">{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setLeftTab("files"); setShowHome(false); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors border border-accent/20">
                      <Folder size={12} /> Browse Files
                    </button>
                    <button onClick={() => setCenterTab("CodebaseSearch")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold bg-bg border border-border text-text-secondary rounded-lg hover:bg-bg-hover transition-colors">
                      <Search size={12} /> Search Code
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={handleSelectDir} className="w-full flex flex-col items-center justify-center gap-3 p-12 rounded-xl border-2 border-dashed border-border bg-bg hover:bg-bg-hover hover:border-accent/30 transition-all cursor-pointer group">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-bg-surface border border-border group-hover:border-accent/30 transition-colors">
                    <FolderOpen size={28} className="text-text-muted group-hover:text-accent transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-text mb-1">Open a Project</p>
                    <p className="text-[11px] text-text-muted">Select a directory to start working</p>
                  </div>
                </button>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-border bg-bg-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-accent" />
                <span className="text-[12px] font-bold text-text-heading">Recent Projects</span>
              </div>
              {recentProjects.length === 0 ? (
                <p className="text-[11px] text-text-muted py-4 text-center">No projects yet - open one above</p>
              ) : (
                <div className="space-y-1">
                  {recentProjects.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-bg-hover transition-colors group cursor-pointer" onClick={() => { setProjectRoot(p.path); setShowHome(false); setLeftTab("files"); }}>
                      <Folder size={14} className="text-text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-text">{p.name}</p>
                        <p className="text-[10px] text-text-muted">{p.path}</p>
                      </div>
                      <span className="text-[9px] text-text-dim shrink-0">{formatSince(p.openedAt)}</span>
                      <button onClick={(e) => { e.stopPropagation(); removeRecent(p.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-text-dim hover:text-danger transition-opacity rounded">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-border bg-bg-surface p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-accent" />
                <span className="text-[12px] font-bold text-text-heading">Studio</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Extensions" value={`${totalExts}`} />
                <StatCard label="Chats" value={String(sessions?.length || 0)} />
                <StatCard label="Providers" value="1" />
              </div>
            </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-2xl border border-border bg-bg-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <Layers size={16} className="text-accent" />
                <span className="text-[12px] font-bold text-text-heading">Pinned</span>
                <button onClick={() => setCenterTab("ExtensionStore")} className="ml-auto text-[10px] text-accent hover:underline">All...</button>
              </div>
              <div className="space-y-1">
                {extensions.map((e: any) => (
                  <button key={e.id} onClick={() => { if (e.component) setCenterTab(e.component); }} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-bg-hover transition-colors text-left">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: theme.accentBg }}>
                      <Hash size={12} style={{ color: theme.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-text">{e.name}</p>
                      <p className="text-[10px] text-text-muted">{e.description}</p>
                    </div>
                    <ArrowRight size={12} className="text-text-dim shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-border bg-bg-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-accent" />
                <span className="text-[12px] font-bold text-text-heading">Quick Start</span>
              </div>
              <button
                onClick={handleSelectDir}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-bg border border-border rounded-xl hover:bg-bg-hover hover:border-accent/30 transition-all text-left group"
              >
                <FolderOpen size={18} className="text-text-muted group-hover:text-accent transition-colors shrink-0" />
                <div>
                  <span className="text-[12px] font-semibold text-text">Select Project</span>
                  <p className="text-[10px] text-text-muted mt-0.5">Open a workspace from disk</p>
                </div>
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useStore((s: any) => s.theme);
  return (
    <div className="rounded-xl border border-border bg-bg p-3 text-center">
      <Hash size={14} className="mx-auto mb-1.5" style={{ color: theme.accent }} />
      <p className="text-[15px] font-bold text-text-heading leading-tight">{value}</p>
      <p className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function formatSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(diff / 86400000)}d`;
}
