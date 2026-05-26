import { useEffect, useState } from 'react';
import { useStore } from './stores/appStore';
import LeftPanel from './components/left/LeftPanel';
import CenterPanel from './components/center/CenterPanel';
import RightPanel from './components/right/RightPanel';
import HomeScreen from './features/HomeScreen';
import SplashScreen from './components/SplashScreen';
import { Settings, Puzzle, Home } from 'lucide-react';

function ArchLogo({ size = 28 }: { size?: number }) {
  return (
    <img src="/logo.png" width={size} height={size} alt="Arch" className="shrink-0" draggable={false} />
  );
}

function VersionBadge() {
  const version = useStore(s => s.version);
  return <span className="text-text-dim">v{version.toFixed(2)}</span>;
}

// ─── Panel switching map for AI tool actions ───
const PANEL_MAP: Record<string, { centerTab?: string; leftTab?: string; rightTab?: string }> = {
  uitester:     { centerTab: 'UITester' },
  codeview:     { centerTab: 'CodeView' },
  testing:      { centerTab: 'TestingDashboard' },
  search:       { centerTab: 'CodebaseSearch' },
  github:       { centerTab: 'GitHubViewer' },
  arch:         { centerTab: 'ArchitectureViz' },
  settings:     { centerTab: 'SettingsPanel' },
  skills:       { centerTab: 'SkillsPanel' },
  models:       { centerTab: 'ModelComparison' },
  extensions:   { centerTab: 'ExtensionStore' },
};

export default function App() {
  const theme = useStore(s => s.theme);
  const applyThemeToDOM = useStore(s => s.applyThemeToDOM);
  const setCenterTab = useStore(s => s.setCenterTab);
  const setShowHome = useStore(s => s.setShowHome);
  const showHome = useStore(s => s.showHome);
  const settings = useStore(s => s.settings);
  const [showSplash, setShowSplash] = useState(true);
  const transparency = settings.transparency ?? 1;

  // ─── Listen for AI auto-action events via WebSocket ───
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Auto-switch panel when AI says so
        if (msg.type === 'app:switchPanel' && msg.panel) {
          const mapping = PANEL_MAP[msg.panel];
          if (mapping?.centerTab) {
            setShowHome(false);
            setCenterTab(mapping.centerTab);
          }
        }

        // Auto-open URL in UI tester
        if (msg.type === 'app:openUrlInTester' && msg.url) {
          setShowHome(false);
          setCenterTab('UITester');
          // Store the URL for UITester to pick up:
          (window as any).__appTesterUrl = msg.url;
        }

        // Auto-preview project
        if (msg.type === 'app:previewProject') {
          setShowHome(false);
          setCenterTab('UITester');
          if (msg.command) {
            (window as any).__appPreviewCommand = msg.command;
          }
          if (msg.file) {
            (window as any).__appPreviewFile = msg.file;
          }
        }

        // Auto-launch server
        if (msg.type === 'app:launchServer') {
          setShowHome(false);
          setCenterTab('UITester');
          (window as any).__appServerUrl = msg.url;
        }

        // Auto-open file when AI edits it (if autoFollowAI is on)
        if (msg.type === 'change' && msg.data?.filePath) {
          const follow = (window as any).__autoFollowAI ?? true;
          if (follow) {
            setShowHome(false);
            setCenterTab('CodeViewer');
            const st = useStore.getState();
            st.setSelectedFile(msg.data.filePath);
            st.setFileContent(msg.data.fileContent || msg.data.newContent || '');
          }
        }

        // Generic action
        if (msg.type === 'app:action' && msg.action) {
          console.log('App action received:', msg.action);
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => ws.close();
  }, [setCenterTab, setShowHome]);

  useEffect(() => {
    applyThemeToDOM(theme, transparency);
  }, [theme, applyThemeToDOM, transparency]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ opacity: transparency }}>
      <header className="h-11 flex items-center pl-20 pr-4 border-b border-border shrink-0 bg-bg-panel draggable">
        <div className="flex items-center gap-2.5 no-drag">
          <ArchLogo size={28} />
          <span className="font-bold text-[14px] text-text-heading tracking-tight">Arch</span>
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
