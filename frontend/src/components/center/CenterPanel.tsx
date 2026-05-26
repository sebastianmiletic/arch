import { lazy, Suspense, useEffect } from 'react';
import { useStore } from '../../stores/appStore';
import {
  Search, Layers, Cpu, TestTube, Puzzle, Eye,
  Zap, GitBranch, FlaskConical, Settings, ShoppingBag,
  GitCompare, BarChart3, Bug, Shield, BookOpen, Globe, Package, Wrench,
  ArrowUpRight, RotateCw, PanelsTopLeft, Download, ExternalLink, FileCode
} from 'lucide-react';

const CodebaseSearch = lazy(() => import('../../features/CodebaseSearch'));
const ArchitectureViz = lazy(() => import('../../features/ArchitectureViz'));
const ModelComparison = lazy(() => import('../../features/ModelComparison'));
const TestingDashboard = lazy(() => import('../../features/TestingDashboard'));
const SettingsPanel = lazy(() => import('../../features/SettingsPanel'));
const SkillsPanel = lazy(() => import('../../features/SkillsPanel'));
const ExtensionStore = lazy(() => import('../../features/ExtensionStore'));
const UITester = lazy(() => import('../../features/UITester'));
const GitHubViewer = lazy(() => import('../../features/GitHubViewer'));
const CodeViewer = lazy(() => import('../../features/CodeViewer'));
const CodeView = lazy(() => import('../../features/CodeView'));

const iconMap: Record<string, any> = {
  'search': Search,
  'layers': Layers,
  'cpu': Cpu,
  'flask-conical': FlaskConical,
  'zap': Zap,
  'git-branch': GitBranch,
  'puzzle': Puzzle,
  'eye': Eye,
  'settings': Settings,
  'shopping-bag': ShoppingBag,
  'git-compare': GitCompare,
  'bar-chart': BarChart3,
  'bug': Bug,
  'shield': Shield,
  'book-open': BookOpen,
  'globe': Globe,
  'package': Package,
  'wrench': Wrench,
  'arrow': ArrowUpRight,
  'rotate': RotateCw,
  'panels': PanelsTopLeft,
  'download': Download,
  'external': ExternalLink,
  'test': TestTube,
  'file-code': FileCode,
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
  GitHubViewer: GitHubViewer,
  CodeViewer: CodeViewer,
  CodeView: CodeView,
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
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);

  // Show pinned extensions in the tab bar — deduplicate on first render
  const rawPinnedIds = settings.pinnedAddons || [];
  const pinnedIds = [...new Set(rawPinnedIds)]; // remove duplicates
  const tabs = pinnedIds.map(id => extensions.find(e => e.id === id)).filter(Boolean) as typeof extensions;

  useEffect(() => {
    if (rawPinnedIds.length !== pinnedIds.length) {
      setSettings({ pinnedAddons: pinnedIds });
    }
  }, []); // only on mount

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
