import { create } from 'zustand';
import type { ProviderConfig, ChatSession, Message, CodeChange, LoopState, Feature, ErrorReport, ThemeId, ThemeConfig, Extension, SwarmAgent, SwarmJob, AppSettings, FileNode } from '../types';

interface SkillItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  enabled: boolean;
}

const defaultSkills: SkillItem[] = [
  { id: 'codegen', name: 'Code Generation', description: 'Generate code snippets and boilerplate', icon: 'code', category: 'core', enabled: true },
  { id: 'refactor', name: 'Refactoring', description: 'Restructure existing code safely', icon: 'scissors', category: 'core', enabled: true },
  { id: 'debug', name: 'Debugging', description: 'Find and fix bugs in code', icon: 'bug', category: 'core', enabled: true },
  { id: 'testgen', name: 'Test Generation', description: 'Write unit and integration tests', icon: 'check-circle', category: 'core', enabled: true },
  { id: 'docs', name: 'Documentation', description: 'Generate docs and comments', icon: 'book', category: 'core', enabled: true },
  { id: 'review', name: 'Code Review', description: 'Review code for quality issues', icon: 'eye', category: 'advanced', enabled: false },
  { id: 'chat', name: 'Chat Assistant', description: 'General-purpose conversational help', icon: 'message-square', category: 'advanced', enabled: true },
  { id: 'i18n', name: 'Translation', description: 'Translate between languages', icon: 'languages', category: 'advanced', enabled: false },
  { id: 'optimize', name: 'Optimization', description: 'Performance and memory optimization', icon: 'zap', category: 'advanced', enabled: false },
  { id: 'security', name: 'Security Scan', description: 'Scan for vulnerabilities', icon: 'shield', category: 'advanced', enabled: false },
  { id: 'git', name: 'Git Operations', description: 'Branch, commit, and diff helpers', icon: 'git-branch', category: 'advanced', enabled: false },
  { id: 'db', name: 'Database', description: 'SQL and schema generation', icon: 'database', category: 'advanced', enabled: false },
  { id: 'search', name: 'Semantic Search', description: 'Find similar code across projects', icon: 'search', category: 'advanced', enabled: false },
  { id: 'api', name: 'API Design', description: 'REST and GraphQL scaffolding', icon: 'globe', category: 'advanced', enabled: false },
  { id: 'docker', name: 'Containers', description: 'Dockerfile and compose generation', icon: 'container', category: 'advanced', enabled: false },
];

export const themes: Record<ThemeId, ThemeConfig> = {
  orion: {
    id: 'orion',
    name: 'Orion',
    bg: '#08080a',
    bgPanel: '#0f0f11',
    bgSurface: '#151518',
    bgHover: '#1b1b1e',
    bgActive: '#222225',
    border: '#1f1f23',
    borderStrong: '#2a2a2e',
    text: '#eaeaeb',
    textHeading: '#ffffff',
    textSecondary: '#9e9ea3',
    textMuted: '#55555a',
    textDim: '#333338',
    accent: '#ffffff',
    accentDim: '#b5b5ba',
    accentBg: '#1f1f23',
    success: '#ffffff',
    warning: '#909095',
    danger: '#ff4444',
    dangerBg: 'rgba(255,68,68,0.08)',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Blue',
    bg: '#0a0f1a',
    bgPanel: '#0f1624',
    bgSurface: '#131a2b',
    bgHover: '#1a2335',
    bgActive: '#222d44',
    border: '#1a2335',
    borderStrong: '#253049',
    text: '#d8dce6',
    textHeading: '#e8ecf1',
    textSecondary: '#8892b0',
    textMuted: '#4a5578',
    textDim: '#2d3548',
    accent: '#7dd3fc',
    accentDim: '#52b5e0',
    accentBg: '#132238',
    success: '#6ee7b7',
    warning: '#fbbf24',
    danger: '#f87171',
    dangerBg: 'rgba(248,113,113,0.08)',
  },
  solar: {
    id: 'solar',
    name: 'Solar Light',
    bg: '#faf8f5',
    bgPanel: '#f5f0e8',
    bgSurface: '#efe9dd',
    bgHover: '#e8e0d0',
    bgActive: '#ddd5c5',
    border: '#d8d0c0',
    borderStrong: '#c8c0b0',
    text: '#2a2520',
    textHeading: '#1a1510',
    textSecondary: '#6a6055',
    textMuted: '#a09585',
    textDim: '#c8c0b0',
    accent: '#c25e00',
    accentDim: '#a04d00',
    accentBg: '#f5ece0',
    success: '#2d7a46',
    warning: '#b8860b',
    danger: '#c62828',
    dangerBg: 'rgba(198,40,40,0.08)',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    bg: '#0a120a',
    bgPanel: '#0f1a0f',
    bgSurface: '#131f13',
    bgHover: '#1a2a1a',
    bgActive: '#223522',
    border: '#1a2a1a',
    borderStrong: '#253825',
    text: '#d8e8d8',
    textHeading: '#e8f5e8',
    textSecondary: '#88a888',
    textMuted: '#4a6a4a',
    textDim: '#2d402d',
    accent: '#86efac',
    accentDim: '#4ade80',
    accentBg: '#132813',
    success: '#6ee7b7',
    warning: '#fde047',
    danger: '#fca5a5',
    dangerBg: 'rgba(252,165,165,0.08)',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    bg: '#0a0f14',
    bgPanel: '#0f1820',
    bgSurface: '#131e28',
    bgHover: '#1a2a38',
    bgActive: '#223545',
    border: '#1a2a38',
    borderStrong: '#253545',
    text: '#d0dce6',
    textHeading: '#e0ecf5',
    textSecondary: '#80a0b8',
    textMuted: '#4a6a85',
    textDim: '#2d4055',
    accent: '#67e8f9',
    accentDim: '#22d3ee',
    accentBg: '#132838',
    success: '#6ee7b7',
    warning: '#fde68a',
    danger: '#fca5a5',
    dangerBg: 'rgba(252,165,165,0.08)',
  },
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk',
    bg: '#0a0414',
    bgPanel: '#120820',
    bgSurface: '#1a0e2e',
    bgHover: '#241440',
    bgActive: '#2e1a55',
    border: '#241440',
    borderStrong: '#321a60',
    text: '#e8d5ff',
    textHeading: '#f0e0ff',
    textSecondary: '#b088ff',
    textMuted: '#6a4a9a',
    textDim: '#3a2a5a',
    accent: '#f0abfc',
    accentDim: '#e879f9',
    accentBg: '#1a0e2e',
    success: '#86efac',
    warning: '#fde047',
    danger: '#fda4af',
    dangerBg: 'rgba(253,164,175,0.08)',
  },
};

const defaultExtensions: Extension[] = [
  { id: 'loop', name: 'Autonomous Loop', description: '8-stage iterative development cycle', category: 'core', installed: true, version: '1.0.0', author: 'Arch', icon: 'rotate-cw', dependencies: [], component: 'LoopView' },
  { id: 'search', name: 'Codebase Search', description: 'Search across all project files and content', category: 'core', installed: true, version: '1.0.0', author: 'Arch', icon: 'search', dependencies: [], component: 'CodebaseSearch' },
  { id: 'arch', name: 'Architecture 2D', description: 'Detailed 2D dependency graph of the entire stack', category: 'visualization', installed: true, version: '1.0.0', author: 'Arch', icon: 'layers', dependencies: [], component: 'ArchitectureViz' },
  { id: 'swarm', name: 'Swarm Engine', description: 'Multi-provider multi-model agent orchestration', category: 'agent', installed: true, version: '1.0.0', author: 'Arch', icon: 'users', dependencies: [], component: 'SwarmPanel' },
  { id: 'models', name: 'Model Arena', description: 'Compare responses from multiple providers side-by-side', category: 'model', installed: true, version: '1.0.0', author: 'Arch', icon: 'cpu', dependencies: [], component: 'ModelComparison' },
  { id: 'skills', name: 'Skills Registry', description: '15 toggleable capabilities from codegen to docker', category: 'tool', installed: true, version: '1.0.0', author: 'Arch', icon: 'zap', dependencies: [], component: 'SkillsPanel' },
  { id: 'tests', name: 'Test Runner', description: 'Simulated test suite with pass/fail metrics and retry', category: 'tool', installed: true, version: '1.0.0', author: 'Arch', icon: 'flask-conical', dependencies: [], component: 'TestingDashboard' },
  { id: 'settings', name: 'Settings', description: 'Themes, typography, layout, behavior', category: 'core', installed: true, version: '1.0.0', author: 'Arch', icon: 'settings', dependencies: [], component: 'SettingsPanel' },
  { id: 'store', name: 'Extension Store', description: 'Marketplace for installing new extensions', category: 'core', installed: true, version: '1.0.0', author: 'Arch', icon: 'shopping-bag', dependencies: [], component: 'ExtensionStore' },
  { id: 'diff', name: 'Diff Viewer', description: 'Side-by-side code diff with inline highlighting', category: 'tool', installed: false, version: '0.9.0', author: 'Arch', icon: 'git-compare', dependencies: [], component: '' },
  { id: 'profiler', name: 'Code Profiler', description: 'Performance analysis and hot-path detection', category: 'tool', installed: false, version: '0.8.0', author: 'Arch', icon: 'bar-chart', dependencies: [], component: '' },
  { id: 'debugger', name: 'AI Debugger', description: 'Interactive step-through debugging with AI explanations', category: 'agent', installed: false, version: '0.7.0', author: 'Arch', icon: 'bug', dependencies: [], component: '' },
  { id: 'diagrams', name: 'Diagram Generator', description: 'Mermaid/PlantUML diagram generation from code', category: 'visualization', installed: false, version: '0.6.0', author: 'Arch', icon: 'git-branch', dependencies: [], component: '' },
  { id: 'security', name: 'Security Scanner', description: 'Vulnerability detection in dependencies and code', category: 'tool', installed: false, version: '0.5.0', author: 'Arch', icon: 'shield', dependencies: [], component: '' },
  { id: 'docs', name: 'Doc Generator', description: 'Auto-generate API docs and README from code', category: 'tool', installed: false, version: '0.5.0', author: 'Arch', icon: 'book-open', dependencies: [], component: '' },
  { id: 'translator', name: 'Code Translator', description: 'Translate between programming languages', category: 'model', installed: false, version: '0.4.0', author: 'Arch', icon: 'languages', dependencies: [], component: '' },
];

const defaultSwarmAgents: SwarmAgent[] = [
  { id: 'debug-agent', name: 'Debugger', role: 'debug', providerId: 'ollama', model: 'codellama', temperature: 0.2, systemPrompt: 'You are a senior debugging specialist. Analyze code, find bugs, and explain fixes in detail. Always show the corrected code.', active: true, color: '#ff6b6b' },
  { id: 'refactor-agent', name: 'Refactorer', role: 'refactor', providerId: 'ollama', model: 'llama3.2', temperature: 0.3, systemPrompt: 'You are a code refactoring expert. Improve code structure, naming, and patterns while preserving behavior. Show before/after.', active: true, color: '#4ecdc4' },
  { id: 'test-agent', name: 'Test Writer', role: 'test', providerId: 'ollama', model: 'llama3.1', temperature: 0.4, systemPrompt: 'You are a test engineer. Write comprehensive unit and integration tests. Cover edge cases and use mocking where needed.', active: true, color: '#ffe66d' },
  { id: 'doc-agent', name: 'Documenter', role: 'docs', providerId: 'ollama', model: 'llama3.2', temperature: 0.5, systemPrompt: 'You are a technical writer. Write clear documentation, comments, and README sections. Explain complex logic simply.', active: false, color: '#a8e6cf' },
  { id: 'security-agent', name: 'Security', role: 'security', providerId: 'ollama', model: 'llama3.1', temperature: 0.2, systemPrompt: 'You are a security auditor. Scan code for vulnerabilities, injection risks, and unsafe patterns. Suggest hardening measures.', active: false, color: '#ff8b94' },
  { id: 'optimize-agent', name: 'Optimizer', role: 'optimize', providerId: 'ollama', model: 'codellama', temperature: 0.3, systemPrompt: 'You are a performance engineer. Find bottlenecks, suggest algorithmic improvements, and optimize memory usage. Show benchmarks.', active: false, color: '#c7ceea' },
];

const defaultSettings: AppSettings = {
  theme: 'orion',
  fontSize: 'md',
  fontFamily: 'sans',
  animations: true,
  autoSave: true,
  sidebarWidth: 280,
  chatWidth: 340,
  minimizeToTray: false,
  startupBehavior: 'welcome',
  telemetry: false,
};

export interface AppStore {
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;
  applyThemeToDOM: (theme: ThemeConfig) => void;
  providers: ProviderConfig[];
  setProviders: (p: ProviderConfig[]) => void;
  activeProviderId: string | null;
  setActiveProviderId: (id: string | null) => void;
  sessions: ChatSession[];
  setSessions: (s: ChatSession[]) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  addMessage: (sessionId: string, msg: Message) => void;
  changes: CodeChange[];
  setChanges: (c: CodeChange[]) => void;
  addChangeItem: (c: CodeChange) => void;
  loop: LoopState | null;
  setLoop: (l: LoopState | null) => void;
  features: Feature[];
  setFeatures: (f: Feature[]) => void;
  errors: ErrorReport[];
  setErrors: (e: ErrorReport[]) => void;
  agentActions: any[];
  setAgentActions: (a: any[]) => void;
  selectedFile: string | null;
  setSelectedFile: (p: string | null) => void;
  fileContent: string | null;
  setFileContent: (c: string | null) => void;
  fileTree: FileNode | null;
  setFileTree: (t: FileNode | null) => void;
  extensions: Extension[];
  setExtensions: (e: Extension[]) => void;
  installExtension: (id: string) => void;
  uninstallExtension: (id: string) => void;
  swarmAgents: SwarmAgent[];
  setSwarmAgents: (a: SwarmAgent[]) => void;
  swarmJobs: SwarmJob[];
  setSwarmJobs: (j: SwarmJob[]) => void;
  addSwarmJob: (j: SwarmJob) => void;
  skills: SkillItem[];
  toggleSkill: (id: string) => void;
  centerTab: string;
  setCenterTab: (t: string) => void;
  leftTab: string;
  setLeftTab: (t: string) => void;
  rightTab: string;
  setRightTab: (t: string) => void;
}

export const useStore = create<AppStore>((set, get) => ({
  theme: themes.orion,
  setTheme: (id) => {
    const t = themes[id];
    set({ theme: t });
    get().applyThemeToDOM(t);
  },
  settings: defaultSettings,
  setSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),
  applyThemeToDOM: (theme: ThemeConfig) => {
    const root = document.documentElement;
    root.style.setProperty('--color-bg', theme.bg);
    root.style.setProperty('--color-bg-panel', theme.bgPanel);
    root.style.setProperty('--color-bg-surface', theme.bgSurface);
    root.style.setProperty('--color-bg-hover', theme.bgHover);
    root.style.setProperty('--color-bg-active', theme.bgActive);
    root.style.setProperty('--color-border', theme.border);
    root.style.setProperty('--color-border-strong', theme.borderStrong);
    root.style.setProperty('--color-text', theme.text);
    root.style.setProperty('--color-text-heading', theme.textHeading);
    root.style.setProperty('--color-text-secondary', theme.textSecondary);
    root.style.setProperty('--color-text-muted', theme.textMuted);
    root.style.setProperty('--color-text-dim', theme.textDim);
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-accent-dim', theme.accentDim);
    root.style.setProperty('--color-accent-bg', theme.accentBg);
    root.style.setProperty('--color-success', theme.success);
    root.style.setProperty('--color-warning', theme.warning);
    root.style.setProperty('--color-danger', theme.danger);
    root.style.setProperty('--color-danger-bg', theme.dangerBg);
  },
  providers: [],
  setProviders: (providers) => set({ providers }),
  activeProviderId: null,
  setActiveProviderId: (activeProviderId) => set({ activeProviderId }),
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  activeSessionId: null,
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  addMessage: (sessionId, msg) => set((state) => ({
    sessions: state.sessions.map((s) => s.id === sessionId ? { ...s, messages: [...s.messages, msg], updatedAt: new Date().toISOString() } : s),
  })),
  changes: [],
  setChanges: (changes) => set({ changes }),
  addChangeItem: (change) => set((state) => ({ changes: [change, ...state.changes] })),
  loop: null,
  setLoop: (loop) => set({ loop }),
  features: [],
  setFeatures: (features) => set({ features }),
  errors: [],
  setErrors: (errors) => set({ errors }),
  agentActions: [],
  setAgentActions: (agentActions) => set({ agentActions }),
  selectedFile: null,
  setSelectedFile: (selectedFile) => set({ selectedFile }),
  fileContent: null,
  setFileContent: (fileContent) => set({ fileContent }),
  fileTree: null,
  setFileTree: (fileTree) => set({ fileTree }),
  extensions: defaultExtensions,
  setExtensions: (extensions) => set({ extensions }),
  installExtension: (id) => set((state) => ({
    extensions: state.extensions.map((e) => e.id === id ? { ...e, installed: true } : e),
  })),
  uninstallExtension: (id) => set((state) => ({
    extensions: state.extensions.map((e) => e.id === id ? { ...e, installed: false } : e),
  })),
  swarmAgents: defaultSwarmAgents,
  setSwarmAgents: (swarmAgents) => set({ swarmAgents }),
  swarmJobs: [],
  setSwarmJobs: (swarmJobs) => set({ swarmJobs }),
  addSwarmJob: (job: SwarmJob) => set((state) => {
    const exists = state.swarmJobs.findIndex(j => j.id === job.id);
    if (exists >= 0) {
      const jobs = [...state.swarmJobs];
      jobs[exists] = job;
      return { swarmJobs: jobs };
    }
    return { swarmJobs: [job, ...state.swarmJobs] };
  }),
  skills: defaultSkills,
  toggleSkill: (id) => set((state) => ({
    skills: state.skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s),
  })),
  centerTab: 'LoopView',
  setCenterTab: (centerTab) => set({ centerTab }),
  leftTab: 'files',
  setLeftTab: (leftTab) => set({ leftTab }),
  rightTab: 'chat',
  setRightTab: (rightTab) => set({ rightTab }),
}));
