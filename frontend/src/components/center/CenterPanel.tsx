import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useStore } from '../../stores/appStore';
import { loopApi, featuresApi } from '../../services/api';
import { wsListen, startLoop, stopLoop } from '../../services/ws';
import { motion } from 'framer-motion';
import { RotateCw, Layers, Search, Cpu, TestTube, Sparkles, Settings, Users, ShoppingBag, Play, Pause } from 'lucide-react';

// Lazy-load all center-panel feature components
const CodebaseSearch = lazy(() => import('../../features/CodebaseSearch'));
const ArchitectureViz = lazy(() => import('../../features/ArchitectureViz'));
const ModelComparison = lazy(() => import('../../features/ModelComparison'));
const TestingDashboard = lazy(() => import('../../features/TestingDashboard'));
const SkillsPanel = lazy(() => import('../../features/SkillsPanel'));
const SettingsPanel = lazy(() => import('../../features/SettingsPanel'));
const SwarmPanel = lazy(() => import('../../features/SwarmPanel'));
const ExtensionStore = lazy(() => import('../../features/ExtensionStore'));

const iconMap: Record<string, any> = {
  'rotate-cw': RotateCw,
  search: Search,
  layers: Layers,
  cpu: Cpu,
  'flask-conical': TestTube,
  zap: Sparkles,
  settings: Settings,
  users: Users,
  'shopping-bag': ShoppingBag,
};

const componentMap: Record<string, any> = {
  LoopView: LoopView,
  CodebaseSearch: CodebaseSearch,
  ArchitectureViz: ArchitectureViz,
  ModelComparison: ModelComparison,
  SkillsPanel: SkillsPanel,
  TestingDashboard: TestingDashboard,
  SettingsPanel: SettingsPanel,
  SwarmPanel: SwarmPanel,
  ExtensionStore: ExtensionStore,
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
  const installed = extensions.filter(e => e.installed);

  const ActiveComponent = componentMap[centerTab] || null;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-bg">
      <div className="flex items-center h-9 px-2 gap-0.5 border-b border-border bg-bg-panel shrink-0 overflow-x-auto">
        {installed.map(t => {
          const Icon = iconMap[t.icon] || Settings;
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

function LoopView() {
  const loop = useStore(s => s.loop);
  const setLoop = useStore(s => s.setLoop);
  const setFeatures = useStore(s => s.setFeatures);
  const [running, setRunning] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loopApi.get().then(s => setLoop(s || null));
    featuresApi.list().then(setFeatures);
  }, []);

  useEffect(() => {
    const un = wsListen(msg => {
      if (msg.type === 'loop') setLoop(msg.data);
    });
    return un;
  }, [setLoop]);

  useEffect(() => {
    if (loop?.status === 'running') setRunning(true);
    else if (loop?.status === 'paused') setRunning(false);
  }, [loop]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [loop?.logs?.length]);

  const stages: { id: string; label: string }[] = [
    { id: 'analyze', label: 'Analyze' },
    { id: 'plan', label: 'Plan' },
    { id: 'build', label: 'Build' },
    { id: 'test', label: 'Test' },
    { id: 'debug', label: 'Debug' },
    { id: 'improve', label: 'Improve' },
    { id: 'verify', label: 'Verify' },
    { id: 'commit', label: 'Commit' },
  ];

  const currentStageIndex = stages.findIndex(s => s.id === loop?.stage);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (running) {
                stopLoop();
                setRunning(false);
              } else {
                startLoop(taskInput || 'Autonomous self-improvement');
                setRunning(true);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-lg transition-all duration-200 ${
              running
                ? 'bg-danger-bg text-danger hover:bg-danger/10 border border-danger/20'
                : 'bg-accent text-bg hover:opacity-90 shadow-lg shadow-accent/20'
            }`}
          >
            {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Start Loop</>}
          </button>

          {loop && (
            <div className="flex-1">
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-text-muted">Iteration</span>
                <span className="font-mono text-accent font-bold">#{loop.iteration}</span>
                <span className="text-text-muted">Stage</span>
                <span className="font-mono text-text-heading uppercase font-bold">{loop.stage}</span>
                <span className="text-text-muted">Status</span>
                <span className={`font-semibold ${
                  loop.status === 'running' ? 'text-success' :
                  loop.status === 'error' ? 'text-danger' :
                  loop.status === 'success' ? 'text-accent' : 'text-text-muted'
                }`}>
                  {loop.status}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar progress={loop.progress} />
              </div>
            </div>
          )}
        </div>

        {loop && (
          <div className="flex items-center gap-1">
            {stages.map((s, i) => (
              <div
                key={s.id}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  i < currentStageIndex ? 'bg-accent/40' :
                  i === currentStageIndex ? 'bg-accent animate-pulse' :
                  'bg-bg-surface'
                }`}
                title={s.label}
              />
            ))}
          </div>
        )}

        <input
          value={taskInput}
          onChange={e => setTaskInput(e.target.value)}
          placeholder="Enter task description..."
          className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2 text-[11px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[11px]">
        {(loop?.logs || []).map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-2 group"
          >
            <span className={`shrink-0 w-12 text-right text-[10px] font-bold ${levelColor(log.level)}`}>
              {log.stage.slice(0, 4).toUpperCase()}
            </span>
            <span className={`${levelColor(log.level)}`}>{log.message}</span>
            <span className="ml-auto text-[10px] text-text-dim opacity-0 group-hover:opacity-100 transition-opacity">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </motion.div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1.5 w-full bg-bg-surface rounded-full overflow-hidden">
      <div
        className="h-full bg-accent transition-all duration-500 rounded-full"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function levelColor(level: string) {
  if (level === 'error') return 'text-danger';
  if (level === 'success') return 'text-accent';
  if (level === 'warn') return 'text-warning';
  return 'text-text-muted';
}
