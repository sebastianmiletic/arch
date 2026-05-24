import { useEffect } from 'react';
import { useStore } from './stores/appStore';
import LeftPanel from './components/left/LeftPanel';
import CenterPanel from './components/center/CenterPanel';
import RightPanel from './components/right/RightPanel';
import { Settings, ShoppingBag } from 'lucide-react';

function ArchLogo({ size = 28, color = '#a855f7' }: { size?: number; color?: string }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const w = s * 0.55;
  const h = s * 0.55;

  // Diamond corners (flat top/bottom, pointed left/right)
  const diamond = [
    [cx - w, cy],
    [cx, cy - h],
    [cx + w, cy],
    [cx, cy + h],
  ];

  const d = `M ${diamond[0][0]} ${diamond[0][1]} L ${diamond[1][0]} ${diamond[1][1]} L ${diamond[2][0]} ${diamond[2][1]} L ${diamond[3][0]} ${diamond[3][1]} Z`;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} xmlns="http://www.w3.org/2000/svg">
      {/* Bottom layer — offset down, filled with accent */}
      <path
        d={d}
        fill={color}
        opacity={0.35}
        transform={`translate(0, ${s * 0.18})`}
      />
      {/* Middle layer — filled dark with accent stroke */}
      <path
        d={d}
        fill="#0a0a0f"
        stroke={color}
        strokeWidth={1.2}
        transform={`translate(0, ${s * 0.09})`}
      />
      {/* Top layer — stroke only */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
      {/* Inner accent ring */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={0.7}
        opacity={0.4}
        transform={`scale(0.75) translate(${cx * 0.33}, ${cy * 0.33})`}
      />
    </svg>
  );
}

export default function App() {
  const theme = useStore(s => s.theme);
  const applyThemeToDOM = useStore(s => s.applyThemeToDOM);
  const setCenterTab = useStore(s => s.setCenterTab);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme, applyThemeToDOM]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none">
      {/* macOS traffic light safe area + header */}
      <header className="h-11 flex items-center pl-20 pr-4 border-b border-border shrink-0 bg-bg-panel draggable">
        <div className="flex items-center gap-2.5 no-drag">
          <ArchLogo size={28} color={theme.accent} />
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
          <button
            onClick={() => setCenterTab('ExtensionStore')}
            className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-bg rounded-lg transition-colors"
            title="Extension Store"
          >
            <ShoppingBag size={14} />
          </button>
          <button
            onClick={() => setCenterTab('SettingsPanel')}
            className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-bg rounded-lg transition-colors"
            title="Settings"
          >
            <Settings size={14} />
          </button>
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
