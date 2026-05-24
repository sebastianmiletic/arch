import { useEffect } from 'react';
import { useStore } from './stores/appStore';
import LeftPanel from './components/left/LeftPanel';
import CenterPanel from './components/center/CenterPanel';
import RightPanel from './components/right/RightPanel';
import { Terminal } from 'lucide-react';

export default function App() {
  const theme = useStore(s => s.theme);
  const applyThemeToDOM = useStore(s => s.applyThemeToDOM);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme, applyThemeToDOM]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none">
      {/* macOS traffic light safe area + header */}
      <header className="h-11 flex items-center pl-20 pr-4 border-b border-border shrink-0 bg-bg-panel draggable">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg border border-border flex items-center justify-center" style={{ background: theme.accentBg }}>
            <Terminal size={16} style={{ color: theme.accent }} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-[13px] text-text-heading tracking-tight">Arch</span>
            <span className="text-[9px] text-text-muted font-medium tracking-wider uppercase">Code Studio</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-text-muted no-drag">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-dot" />
            <span>Ready</span>
          </span>
          <span className="text-text-dim">|</span>
          <span className="text-text-dim">v1.0.0</span>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <LeftPanel />
        <CenterPanel />
        <RightPanel />
      </main>
    </div>
  );
}
