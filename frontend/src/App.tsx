import { useEffect, useState } from 'react';
import { useStore } from './stores/appStore';
import LeftPanel from './components/left/LeftPanel';
import CenterPanel from './components/center/CenterPanel';
import RightPanel from './components/right/RightPanel';
import HomeScreen from './features/HomeScreen';
import SplashScreen from './components/SplashScreen';
import {
  Settings, Puzzle, Home,
  Search, Layers, Cpu, Zap, FlaskConical, GitBranch, Eye
} from 'lucide-react';

const iconMap: Record<string, any> = {
  search: Search, layers: Layers, cpu: Cpu, zap: Zap,
  'flask-conical': FlaskConical, 'git-branch': GitBranch,
  puzzle: Puzzle, eye: Eye, settings: Settings, home: Home,
};

function ArchLogo({ size = 28 }: { size?: number }) {
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

function VersionBadge() {
  const version = useStore(s => s.version);
  return <span className="text-text-dim">v{version.toFixed(2)}</span>;
}

export default function App() {
  const theme = useStore(s => s.theme);
  const applyThemeToDOM = useStore(s => s.applyThemeToDOM);
  const setCenterTab = useStore(s => s.setCenterTab);
  const centerTab = useStore(s => s.centerTab);
  const showHome = useStore(s => s.showHome);
  const setShowHome = useStore(s => s.setShowHome);
  const extensions = useStore(s => s.extensions);
  const [showSplash, setShowSplash] = useState(true);
  const [pinned, setPinned] = useState<string[]>(
    (() => {
      try { return JSON.parse(localStorage.getItem('arch_pinned_addons') || '[]'); }
      catch { return []; }
    })()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const next = JSON.parse(localStorage.getItem('arch_pinned_addons') || '[]');
        if (JSON.stringify(next) !== JSON.stringify(pinned)) setPinned(next);
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, [pinned]);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme, applyThemeToDOM]);

  const pinnedExts = pinned.map(id => extensions.find(e => e.id === id)).filter(Boolean) as typeof extensions;

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none">
      <header className="h-11 flex items-center pl-20 pr-4 border-b border-border shrink-0 bg-bg-panel draggable">
        <div className="flex items-center gap-2.5 no-drag">
          <ArchLogo size={28} />
          <span className="font-bold text-[14px] text-text-heading tracking-tight">Arch</span>
        </div>

        <div className="ml-4 flex items-center gap-1 no-drag">
          {pinnedExts.map(ext => {
            const Icon = iconMap[ext.icon] || Puzzle;
            const isActive = centerTab === ext.component;
            return (
              <button
                key={ext.id}
                onClick={() => setCenterTab(ext.component)}
                className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${
                  isActive ? 'bg-accent text-bg' : 'text-text-secondary hover:text-text hover:bg-bg-hover'
                }`}
              >
                <Icon size={11} />
                {ext.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3 text-[11px] text-text-muted no-drag">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-dot" />
            <span>Ready</span>
          </span>
          <span className="text-text-dim">|</span>
          <button onClick={() => setShowHome(true)} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-bg rounded-lg transition-colors" title="Home">
            <Home size={14} />
          </button>
          <button onClick={() => setCenterTab('ExtensionStore')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-bg rounded-lg transition-colors" title="Addon Library">
            <Puzzle size={14} />
          </button>
          <button onClick={() => setCenterTab('SettingsPanel')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-bg rounded-lg transition-colors" title="Settings">
            <Settings size={14} />
          </button>
          <VersionBadge />
        </div>
      </header>

      {showHome ? (
        <div className="flex-1 overflow-hidden">
          <HomeScreen />
        </div>
      ) : (
        <main className="flex-1 flex overflow-hidden">
          <LeftPanel />
          <CenterPanel />
          <RightPanel />
        </main>
      )}
    </div>
  );
}
