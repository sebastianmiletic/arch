import { useState, useEffect } from 'react';
import { useStore } from '../stores/appStore';
import {
  Puzzle, Wrench, Eye, Cpu, ArrowLeft, X,
  Search, Layers, FlaskConical, Settings, ShoppingBag,
  GitCompare, BarChart3, Bug, GitBranch, Shield, BookOpen, Globe, Package, Zap
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

function loadPinned(): string[] {
  try { return JSON.parse(localStorage.getItem('arch_pinned_addons') || '[]'); }
  catch { return []; }
}
function savePinned(ids: string[]) { localStorage.setItem('arch_pinned_addons', JSON.stringify(ids)); }

const iconMap: Record<string, any> = {
  search: Search, layers: Layers, cpu: Cpu, zap: Zap,
  'flask-conical': FlaskConical, settings: Settings,
  'shopping-bag': ShoppingBag, 'git-compare': GitCompare,
  'bar-chart': BarChart3, bug: Bug, 'git-branch': GitBranch,
  shield: Shield, 'book-open': BookOpen, globe: Globe,
  package: Package, wrench: Wrench, eye: Eye,
};

export default function AddonLibrary() {
  const extensions = useStore(s => s.extensions);
  const setExtensions = useStore(s => s.setExtensions);
  const setCenterTab = useStore(s => s.setCenterTab);
  const [filter, setFilter] = useState<'installed' | 'available' | 'all'>('all');
  const [search, setSearch] = useState('');
  const [pinned, setPinned] = useState<string[]>(loadPinned);

  useEffect(() => { savePinned(pinned); }, [pinned]);

  const filtered = extensions.filter(e => {
    if (filter === 'installed') return e.installed;
    if (filter === 'available') return !e.installed;
    return true;
  }).filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
  });

  const installedCount = extensions.filter(e => e.installed).length;

  const toggleInstall = (id: string) => {
    const ext = extensions.find(e => e.id === id);
    if (!ext) return;
    if (ext.installed) {
      setExtensions(extensions.map(e => e.id === id ? { ...e, installed: false } : e));
      setPinned(prev => prev.filter(i => i !== id));
    } else {
      setExtensions(extensions.map(e => e.id === id ? { ...e, installed: true } : e));
      setPinned(prev => [...prev, id]);
    }
  };

  const togglePin = (id: string) => {
    const ext = extensions.find(e => e.id === id);
    if (!ext || !ext.installed) return;
    if (pinned.includes(id)) setPinned(prev => prev.filter(i => i !== id));
    else setPinned(prev => [...prev, id]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setCenterTab('CodebaseSearch')} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center">
            <Puzzle size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-text-heading">Addon Library</h2>
            <p className="text-[11px] text-text-muted">{installedCount} pinned · {extensions.length} total</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-bg-surface border border-border rounded-lg px-3 py-1.5">
            <Wrench size={12} className="text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search addons..."
              className="flex-1 bg-transparent text-[11px] text-text placeholder:text-text-dim focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="text-text-muted hover:text-text"><X size={12} /></button>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {(['all', 'installed', 'available'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${filter === f ? 'bg-accent text-bg' : 'text-text-secondary hover:bg-bg-hover'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {pinned.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-text-muted self-center">Pinned:</span>
            {pinned.map(id => {
              const ext = extensions.find(e => e.id === id);
              if (!ext) return null;
              const Icon = iconMap[ext.icon] || Puzzle;
              return (
                <button key={id} onClick={() => setCenterTab(ext.component)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-accent-bg border border-accent/20 rounded-md text-accent hover:bg-accent/10 transition-colors">
                  <Icon size={12} /> {ext.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence>
            {filtered.map((ext, i) => {
              const Icon = iconMap[ext.icon] || Puzzle;
              const isPinned = pinned.includes(ext.id);
              return (
                <motion.div key={ext.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.02 }}
                  className={`border rounded-xl p-3.5 transition-all duration-200 ${ext.installed ? 'border-accent/20 bg-accent-bg' : 'border-border bg-bg-surface hover:border-border-strong'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ext.installed ? 'bg-accent/10' : 'bg-bg-hover'}`}>
                      <Icon size={18} className={ext.installed ? 'text-accent' : 'text-text-muted'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[12px] text-text truncate">{ext.name}</span>
                        {ext.installed && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/10 text-success uppercase">Installed</span>}
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{ext.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] text-text-dim">v{ext.version}</span>
                        <span className="text-[9px] text-text-dim">by {ext.author}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {ext.installed ? (
                      <>
                        <button onClick={() => toggleInstall(ext.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-danger/20 text-danger rounded-lg hover:bg-danger-bg transition-colors"
                        >
                          <X size={11} /> Uninstall
                        </button>
                        <button onClick={() => togglePin(ext.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${isPinned ? 'bg-accent text-bg border-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}
                        >
                          {isPinned ? 'Unpin' : 'Pin to taskbar'}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => toggleInstall(ext.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold bg-accent text-bg rounded-lg hover:opacity-90 transition-colors">
                        <Wrench size={11} /> Install
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Wrench size={24} className="text-text-dim" />
            <span className="text-[11px] text-text-muted">No addons match your filters</span>
          </div>
        )}
      </div>
    </div>
  );
}
