import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers } from 'lucide-react';

interface NodeData {
  id: string;
  label: string;
  description: string;
  type: 'component' | 'service' | 'store' | 'api' | 'db' | 'middleware' | 'config';
  position: [number, number, number];
  connections: string[];
  color: string;
  tech?: string[];
  metrics?: { calls?: number; latency?: number; errors?: number };
}

const archNodes: NodeData[] = [
  { id: 'app', label: 'App.tsx', description: 'Root React shell, router outlet, error boundary', type: 'component', position: [0, 5, 0], connections: ['header', 'layout', 'router'], color: '#ffffff', tech: ['React 19', 'TypeScript', 'Vite'], metrics: { calls: 1, latency: 2 } },
  { id: 'header', label: 'Header Bar', description: 'Window chrome, status, branding, traffic-light-safe drag area', type: 'component', position: [-3, 7, 0], connections: ['app'], color: '#e8e8ec', tech: ['Tailwind v4'], metrics: { calls: 120 } },
  { id: 'layout', label: 'Layout Engine', description: 'Three-column flex layout with resize handles', type: 'component', position: [3, 7, 0], connections: ['app'], color: '#e8e8ec', tech: ['CSS Grid', 'Flexbox'], metrics: { calls: 800 } },
  { id: 'router', label: 'Tab Router', description: 'State-driven tab switching, lazy loading for features', type: 'component', position: [0, 7, 0], connections: ['app'], color: '#e8e8ec', tech: ['Zustand'], metrics: { calls: 2000 } },
  { id: 'leftpanel', label: 'LeftPanel', description: 'File tree, changes feed, action log', type: 'component', position: [-6, 3, 0], connections: ['app', 'filetree', 'changes', 'actions', 'store'], color: '#d4d4d8', tech: ['Lucide', 'Framer Motion'], metrics: { calls: 3400 } },
  { id: 'centerpanel', label: 'CenterPanel', description: 'Workspace tabs: Loop, Search, Arch, Models, Skills, Tests, Settings', type: 'component', position: [0, 3, 0], connections: ['app', 'loop', 'search', 'archviz', 'models', 'skills', 'tests', 'settings', 'store'], color: '#c8c8cc', tech: ['React', 'Three.js'], metrics: { calls: 5600 } },
  { id: 'rightpanel', label: 'RightPanel', description: 'Console sessions, provider settings', type: 'component', position: [6, 3, 0], connections: ['app', 'chat', 'providers', 'store'], color: '#d4d4d8', tech: ['PrismJS', 'Marked'], metrics: { calls: 2100 } },
  { id: 'filetree', label: 'FileTree', description: 'Recursive FS scanner with depth cap, search filter, language color coding', type: 'service', position: [-8, 1, 2], connections: ['leftpanel', 'fsutils', 'db'], color: '#a0a0a8', tech: ['Node FS', 'RegExp'], metrics: { calls: 120, latency: 180 } },
  { id: 'changes', label: 'ChangeFeed', description: 'WebSocket-driven code change log with diff preview', type: 'service', position: [-6, 1, 2], connections: ['leftpanel', 'wsclient', 'db'], color: '#a0a0a8', tech: ['WebSocket', 'Diff Match Patch'], metrics: { calls: 45, latency: 12 } },
  { id: 'actions', label: 'ActionLog', description: 'Agent action history with status and timestamps', type: 'service', position: [-4, 1, 2], connections: ['leftpanel', 'db'], color: '#a0a0a8', tech: ['SQLite'], metrics: { calls: 89 } },
  { id: 'loop', label: 'AutonomousLoop', description: '8-stage iterative loop: analyze, plan, build, test, debug, improve, verify, commit', type: 'service', position: [-4, 1, -2], connections: ['centerpanel', 'wsclient', 'db', 'providers'], color: '#94949c', tech: ['State Machine', 'WebSocket'], metrics: { calls: 12, latency: 4200 } },
  { id: 'search', label: 'CodebaseSearch', description: 'File name + content search across project, regex support, 50-file content limit', type: 'service', position: [-2, 1, -2], connections: ['centerpanel', 'filetree', 'fsutils'], color: '#94949c', tech: ['Fetch', 'RegExp'], metrics: { calls: 67, latency: 340 } },
  { id: 'archviz', label: 'ArchViz Engine', description: '2D dependency graph renderer with layered architecture view', type: 'service', position: [0, 1, -2], connections: ['centerpanel'], color: '#94949c', tech: ['Framer Motion'], metrics: { calls: 8, latency: 1200 } },
  { id: 'models', label: 'ModelArena', description: 'Parallel provider comparison with latency + token metrics', type: 'service', position: [2, 1, -2], connections: ['centerpanel', 'providers', 'chatapi'], color: '#94949c', tech: ['Async Queue'], metrics: { calls: 23, latency: 8900 } },
  { id: 'skills', label: 'SkillRegistry', description: '15 toggleable capabilities from codegen to docker', type: 'service', position: [4, 1, -2], connections: ['centerpanel', 'db'], color: '#94949c', tech: ['Feature Flags'], metrics: { calls: 156 } },
  { id: 'tests', label: 'TestRunner', description: 'Simulated test suite with pass/fail/pending stats, category filters, retry', type: 'service', position: [6, 1, -2], connections: ['centerpanel', 'db'], color: '#94949c', tech: ['Mock Data'], metrics: { calls: 34, latency: 560 } },
  { id: 'settings', label: 'SettingsPanel', description: '6 themes, typography, layout widths, behavior toggles, reset', type: 'service', position: [8, 1, -2], connections: ['centerpanel', 'store'], color: '#94949c', tech: ['CSS Variables'], metrics: { calls: 201 } },
  { id: 'chat', label: 'Console', description: 'Session-based messaging with markdown, syntax highlighting, copy, provider metadata', type: 'service', position: [8, 1, 2], connections: ['rightpanel', 'chatapi', 'db'], color: '#a0a0a8', tech: ['Marked', 'Prism', 'Framer'], metrics: { calls: 420, latency: 1200 } },
  { id: 'providers', label: 'ProviderManager', description: '7 provider configs: Ollama, OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA NIM, Local. Enable/toggle/test.', type: 'api', position: [10, 1, 2], connections: ['rightpanel', 'chatapi', 'loop', 'models', 'apigateway'], color: '#808088', tech: ['REST', 'Ollama SDK'], metrics: { calls: 89, latency: 45 } },
  { id: 'store', label: 'Zustand Store', description: 'Global state: theme, sessions, providers, loop, files, settings. 12 slices, persisted.', type: 'store', position: [0, -1, 4], connections: ['app', 'leftpanel', 'centerpanel', 'rightpanel', 'settings'], color: '#b0b0b8', tech: ['Zustand v5', 'Immer'], metrics: { calls: 15000, latency: 0.5 } },
  { id: 'fsutils', label: 'FS Scanner', description: 'File tree builder with max depth 4, max 200 files, skip list: node_modules, .git, dist', type: 'service', position: [-8, -1, -4], connections: ['filetree', 'search', 'apigateway'], color: '#787880', tech: ['Node FS', 'Path'], metrics: { calls: 12, latency: 280 } },
  { id: 'chatapi', label: 'Chat Service', description: 'Message routing to active provider with history context and error fallback', type: 'service', position: [8, -1, 4], connections: ['chat', 'providers', 'models', 'apigateway'], color: '#787880', tech: ['OpenAI SDK Pattern'], metrics: { calls: 156, latency: 2300 } },
  { id: 'wsclient', label: 'WS Client', description: 'WebSocket connection to localhost:3001, auto-reconnect, loop state streaming', type: 'middleware', position: [-6, -1, 4], connections: ['loop', 'changes', 'apigateway'], color: '#787880', tech: ['ws library'], metrics: { calls: 1, latency: 30 } },
  { id: 'apigateway', label: 'Express Gateway', description: 'Express 5 HTTP server on :3000. CORS, JSON 2MB limit, static file serving from public/', type: 'api', position: [0, -3, -6], connections: ['providers', 'chatapi', 'db', 'fsutils', 'wsclient', 'routes'], color: '#686870', tech: ['Express 5', 'CORS'], metrics: { calls: 3400, latency: 12 } },
  { id: 'routes', label: 'Route Registry', description: '25 REST endpoints: providers, sessions, chat, changes, loop, features, errors, files, actions', type: 'api', position: [-4, -3, -6], connections: ['apigateway', 'db'], color: '#686870', tech: ['Express Router'], metrics: { calls: 3400 } },
  { id: 'wsserver', label: 'WebSocket Server', description: 'ws server on :3001. Handles loop:start, loop:stop, change, ping. Broadcasts to all clients.', type: 'api', position: [4, -3, -6], connections: ['apigateway', 'loop'], color: '#686870', tech: ['ws', 'UUID'], metrics: { calls: 1, latency: 5 } },
  { id: 'db', label: 'SQLite Engine', description: 'better-sqlite3 with 11 tables, WAL mode. 94KB studio.db file in server directory.', type: 'db', position: [0, -5, -8], connections: ['apigateway', 'changes', 'actions', 'loop', 'tests', 'chat', 'filetree'], color: '#505058', tech: ['better-sqlite3'], metrics: { calls: 8900, latency: 2, errors: 0 } },
];

function TwoDNode({ node, isSelected, onClick }: { node: NodeData; isSelected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const typeIcons: Record<string, string> = {
    component: '◆', service: '▪', store: '●', api: '◐', db: '▰', middleware: '▸', config: '▫',
  };
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative cursor-pointer transition-all duration-200 ${isSelected ? 'z-20' : 'z-10'}`}
    >
      <div className={`px-3 py-2 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-all ${
        isSelected
          ? 'border-accent bg-accent-bg text-accent shadow-lg shadow-accent/10'
          : hovered
            ? 'border-border-strong bg-bg-hover text-text'
            : 'border-border bg-bg-surface text-text-secondary'
      }`}
      >
        <span className="mr-1.5 opacity-60">{typeIcons[node.type] || '•'}</span>
        {node.label}
      </div>
      {hovered && (
        <div className="absolute top-full left-0 mt-1 bg-bg-panel border border-border rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap z-30">
          <div className="text-[10px] text-text-muted">{node.description}</div>
        </div>
      )}
    </div>
  );
}

function NodeDetail({ node, onClose, onNavigate }: { node: NodeData; onClose: () => void; onNavigate: (id: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-3 right-3 w-72 bg-bg-panel/95 backdrop-blur border border-border rounded-xl p-4 shadow-xl z-40 max-h-[90%] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm text-text-heading">{node.label}</span>
        <button onClick={onClose} className="text-text-muted hover:text-text">×</button>
      </div>
      <p className="text-[11px] text-text-secondary mb-3 leading-relaxed">{node.description}</p>
      <div className="space-y-3">
        <div>
          <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Type</div>
          <span className="text-[11px] px-2 py-1 rounded bg-accent-bg text-accent capitalize">{node.type}</span>
        </div>
        {node.metrics && (
          <div>
            <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Metrics</div>
            <div className="grid grid-cols-2 gap-2">
              {node.metrics.calls && (
                <div className="bg-bg-surface rounded-lg p-2 border border-border">
                  <div className="text-[9px] text-text-muted">Calls</div>
                  <div className="text-[13px] font-bold text-text">{node.metrics.calls.toLocaleString()}</div>
                </div>
              )}
              {node.metrics.latency && (
                <div className="bg-bg-surface rounded-lg p-2 border border-border">
                  <div className="text-[9px] text-text-muted">Latency</div>
                  <div className="text-[13px] font-bold text-text">{node.metrics.latency}ms</div>
                </div>
              )}
              {node.metrics.errors !== undefined && (
                <div className="bg-bg-surface rounded-lg p-2 border border-border">
                  <div className="text-[9px] text-text-muted">Errors</div>
                  <div className="text-[13px] font-bold text-danger">{node.metrics.errors}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {node.tech && (
          <div>
            <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Technologies</div>
            <div className="flex flex-wrap gap-1">
              {node.tech.map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-bg-surface text-text-secondary border border-border">{t}</span>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Connections</div>
          <div className="space-y-0.5">
            {node.connections.map(id => {
              const conn = archNodes.find(n => n.id === id);
              return conn ? (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  className="block w-full text-left text-[11px] text-text-secondary hover:text-accent transition-colors py-1 px-2 rounded hover:bg-bg-hover"
                >
                  <span className="opacity-50 mr-1">→</span> {conn.label}
                </button>
              ) : null;
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ArchitectureViz() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);

  const selectedData = selectedNode ? (archNodes.find(n => n.id === selectedNode) || null) : null;

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of archNodes) counts[n.type] = (counts[n.type] || 0) + 1;
    return counts;
  }, []);

  const layers = [
    { label: 'Presentation', nodes: archNodes.filter(n => ['header', 'layout', 'router'].includes(n.id)) },
    { label: 'App Shell', nodes: archNodes.filter(n => n.id === 'app') },
    { label: 'Panels', nodes: archNodes.filter(n => ['leftpanel', 'centerpanel', 'rightpanel'].includes(n.id)) },
    { label: 'Features', nodes: archNodes.filter(n => ['filetree', 'changes', 'actions', 'loop', 'search', 'archviz', 'models', 'skills', 'tests', 'settings', 'chat', 'providers'].includes(n.id)) },
    { label: 'Shared', nodes: archNodes.filter(n => ['store', 'fsutils', 'chatapi', 'wsclient'].includes(n.id)) },
    { label: 'Backend', nodes: archNodes.filter(n => ['apigateway', 'routes', 'wsserver'].includes(n.id)) },
    { label: 'Data', nodes: archNodes.filter(n => n.id === 'db') },
  ];

  const typeLegend = [
    { type: 'component', label: 'UI Component', color: '#ffffff' },
    { type: 'service', label: 'Service', color: '#a0a0a8' },
    { type: 'store', label: 'Store', color: '#b0b0b8' },
    { type: 'api', label: 'API / Endpoint', color: '#808088' },
    { type: 'db', label: 'Database', color: '#505058' },
    { type: 'middleware', label: 'Middleware', color: '#787880' },
  ];

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">Architecture Visualizer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted px-2 py-1 rounded bg-bg-surface">
            {archNodes.length} nodes · {archNodes.reduce((a, n) => a + n.connections.length, 0)} edges
          </span>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveType(activeType ? null : '')}
          className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider transition-all ${
            !activeType ? 'bg-accent text-bg' : 'text-text-muted hover:bg-bg-hover'
          }`}
        >
          All
        </button>
        {typeLegend.map(t => (
          <button
            key={t.type}
            onClick={() => setActiveType(activeType === t.type ? null : t.type)}
            className={`flex items-center gap-1.5 text-[9px] px-2 py-1 rounded font-semibold uppercase tracking-wider transition-all ${
              activeType === t.type ? 'bg-accent-bg text-accent border border-accent/20' : 'text-text-muted hover:bg-bg-hover'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
            {t.label} ({typeCounts[t.type] || 0})
          </button>
        ))}
      </div>

      {/* 2D Layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-8 min-w-[800px]">
          {layers.map((layer) => (
            <div key={layer.label} className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted px-2">{layer.label}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {layer.nodes.map(node => (
                  <TwoDNode
                    key={node.id}
                    node={node}
                    isSelected={selectedNode === node.id}
                    onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedData && (
          <NodeDetail
            node={selectedData}
            onClose={() => setSelectedNode(null)}
            onNavigate={setSelectedNode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
