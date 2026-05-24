import { useEffect } from 'react';
import { useStore } from './stores/appStore';
import LeftPanel from './components/left/LeftPanel';
import CenterPanel from './components/center/CenterPanel';
import RightPanel from './components/right/RightPanel';

function ArchLogo({ size = 28, color = '#a855f7' }: { size?: number; color?: string }) {
  const s = size;
  const half = s / 2;
  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform={`translate(${half},${half}) rotate(45)`}>
        {/* Bottom purple layer (base) */}
        <rect
          x={-half * 0.55}
          y={-half * 0.15}
          width={half * 1.1}
          height={half * 1.1}
          rx={half * 0.18}
          fill={color}
          opacity={0.9}
        />
        {/* Middle dark layer */}
        <rect
          x={-half * 0.55}
          y={-half * 0.55}
          width={half * 1.1}
          height={half * 1.1}
          rx={half * 0.18}
          fill="#0a0a0f"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.95}
        />
        {/* Top stroke layer */}
        <rect
          x={-half * 0.55}
          y={-half * 0.9}
          width={half * 1.1}
          height={half * 1.1}
          rx={half * 0.18}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
        {/* Inner accent */}
        <rect
          x={-half * 0.45}
          y={-half * 0.8}
          width={half * 0.9}
          height={half * 0.9}
          rx={half * 0.14}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          opacity={0.4}
        />
      </g>
    </svg>
  );
}

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
