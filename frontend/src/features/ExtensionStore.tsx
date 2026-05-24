import { useState } from 'react';
import { useStore } from '../stores/appStore';
import { motion } from 'framer-motion';
import {
  ShoppingBag, Download, Trash2, Cpu, Zap, Layers, Settings,
  Search, RotateCw, Users, FlaskConical, GitCompare, BarChart3,
  Bug, GitBranch, Shield, BookOpen, Languages, ArrowRight,
  Package, X
} from 'lucide-react';

const iconMap: Record<string, any> = {
  'rotate-cw': RotateCw, search: Search, layers: Layers, cpu: Cpu,
  zap: Zap, 'flask-conical': FlaskConical, settings: Settings,
  'shopping-bag': ShoppingBag, 'git-compare': GitCompare, 'bar-chart': BarChart3,
  bug: Bug, 'git-branch': GitBranch, shield: Shield, 'book-open': BookOpen,
  languages: Languages, users: Users,
};

const categoryLabels: Record<string, string> = {
  core: 'Core', agent: 'Agents', model: 'Models', tool: 'Tools', visualization: 'Visualizers',
};

const categoryColors: Record<string, string> = {
  core: 'text-accent', agent: 'text-warning', model: 'text-success', tool: 'text-text-secondary', visualization: 'text-accent-dim',
};

export default function ExtensionStore() {
  const extensions = useStore(s => s.extensions);
  const installExtension = useStore(s => s.installExtension);
  const uninstallExtension = useStore(s => s.uninstallExtension);
  const [filter, setFilter] = useState<'installed' | 'available' | 'all'>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = extensions.filter(e => {
    if (filter === 'installed') return e.installed;
    if (filter === 'available') return !e.installed;
    return true;
  }).filter(e => {
    if (category && e.category !== category) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const installedCount = extensions.filter(e => e.installed).length;
  const categories = [...new Set(extensions.map(e => e.category))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center">
            <ShoppingBag size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-text-heading">Extension Store</h2>
            <p className="text-[11px] text-text-muted">{installedCount} installed · {extensions.length - installedCount} available</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-bg-surface border border-border rounded-lg px-3 py-1.5">
            <Search size={12} className="text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search extensions..."
              className="flex-1 bg-transparent text-[11px] text-text placeholder:text-text-dim focus:outline-none"
            />
            {search && <button onClick={() => setSearch('')} className="text-text-muted hover:text-text"><X size={12} /></button>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {(['all', 'installed', 'available'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                filter === f ? 'bg-accent text-bg' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => setCategory(null)}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
              !category ? 'bg-accent text-bg' : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            All Cats
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? null : cat)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
                category === cat ? 'bg-accent-bg text-accent border border-accent/20' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((ext, i) => {
            const Icon = iconMap[ext.icon] || Package;
            return (
              <motion.div
                key={ext.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`border rounded-xl p-3.5 transition-all duration-200 ${
                  ext.installed
                    ? 'border-accent/20 bg-accent-bg'
                    : 'border-border bg-bg-surface hover:border-border-strong'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    ext.installed ? 'bg-accent/10' : 'bg-bg-hover'
                  }`}>
                    <Icon size={18} className={ext.installed ? 'text-accent' : 'text-text-muted'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[12px] text-text truncate">{ext.name}</span>
                      {ext.installed && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/10 text-success uppercase">Installed</span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{ext.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] font-bold uppercase ${categoryColors[ext.category] || 'text-text-muted'}`}>
                        {categoryLabels[ext.category] || ext.category}
                      </span>
                      <span className="text-[9px] text-text-dim">v{ext.version}</span>
                      <span className="text-[9px] text-text-dim">by {ext.author}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  {ext.installed ? (
                    <button
                      onClick={() => uninstallExtension(ext.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-danger/20 text-danger rounded-lg hover:bg-danger-bg transition-colors"
                    >
                      <Trash2 size={11} /> Uninstall
                    </button>
                  ) : (
                    <button
                      onClick={() => installExtension(ext.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold bg-accent text-bg rounded-lg hover:opacity-90 transition-colors"
                    >
                      <Download size={11} /> Install
                    </button>
                  )}
                  <button className="ml-auto text-[10px] text-text-muted hover:text-text flex items-center gap-1 transition-colors">
                    Details <ArrowRight size={10} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Search size={24} className="text-text-dim" />
            <span className="text-[11px] text-text-muted">No extensions match your filters</span>
          </div>
        )}
      </div>
    </div>
  );
}
