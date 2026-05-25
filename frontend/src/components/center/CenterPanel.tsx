import { lazy, Suspense } from 'react';
import { useStore } from '../../stores/appStore';
import { Search, Layers, Cpu, TestTube, Puzzle, Eye } from 'lucide-react';

// Lazy-load all center-panel feature components
const CodebaseSearch = lazy(() => import('../../features/CodebaseSearch'));
const ArchitectureViz = lazy(() => import('../../features/ArchitectureViz'));
const ModelComparison = lazy(() => import('../../features/ModelComparison'));
const TestingDashboard = lazy(() => import('../../features/TestingDashboard'));
const SettingsPanel = lazy(() => import('../../features/SettingsPanel'));
const SkillsPanel = lazy(() => import('../../features/SkillsPanel'));
const ExtensionStore = lazy(() => import('../../features/ExtensionStore'));
const UITester = lazy(() => import('../../features/UITester'));

const iconMap: Record<string, any> = {
  'search': Search,
  'layers': Layers,
  'cpu': Cpu,
  'flask-conical': TestTube,
  'zap': Puzzle,
  'git-branch': Puzzle,
  'puzzle': Puzzle,
  'eye': Eye,
};

const componentMap: Record<string, any> = {
  CodebaseSearch: CodebaseSearch,
  ArchitectureViz: ArchitectureViz,
  ModelComparison: ModelComparison,
  TestingDashboard: TestingDashboard,
  SettingsPanel: SettingsPanel,
  SkillsPanel: SkillsPanel,
  ExtensionStore: ExtensionStore,
  UITester: UITester,
};

function Loader() {
  return (
    <div className="flex-1 flex items-center justify-center text-text-muted">
      <div className="w-6 h-6 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
    </div>
  );
}

export default function CenterPanel() {
  const centerTab = useStore(s => s.centerTab);
  const setCenterTab = useStore(s => s.setCenterTab);
  const extensions = useStore(s => s.extensions);

  // Show all installed extensions in the tab bar
  const tabs = extensions.filter(e => e.installed);

  const ActiveComponent = componentMap[centerTab] || null;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-bg">
      <div className="flex items-center h-9 px-2 gap-0.5 border-b border-border bg-bg-panel shrink-0 overflow-x-auto">
        {tabs.map(t => {
          const Icon = iconMap[t.icon] || Puzzle;
          return (
            <button
              key={t.id}
              onClick={() => setCenterTab(t.component)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-150 shrink-0 ${
                centerTab === t.component
                  ? 'bg-bg-surface text-text shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-bg-hover'
              }`}
            >
              <Icon size={12} />
              {t.name}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<Loader />}>
          {ActiveComponent ? <ActiveComponent /> : <div className="flex-1 flex items-center justify-center text-text-muted text-[12px]">Select an extension</div>}
        </Suspense>
      </div>
    </div>
  );
}
