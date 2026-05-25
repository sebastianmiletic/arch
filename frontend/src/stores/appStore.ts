import { create } from 'zustand';
import type { ProviderConfig, ChatSession, Message, CodeChange, LoopState, Feature, ErrorReport, ThemeId, ThemeConfig, Extension, AppSettings, FileNode } from '../types';

interface SkillItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category?: string;
  enabled: boolean;
}

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
  custom: {
    id: 'custom',
    name: 'Custom',
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
    accent: '#a855f7',
    accentDim: '#7c3aed',
    accentBg: 'rgba(168,85,247,0.12)',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    dangerBg: 'rgba(239,68,68,0.08)',
  },
};

const defaultExtensions: Extension[] = [
  { id: 'search', name: 'Search', description: 'Search across all project files and content', category: 'core', installed: false, version: '1.0.0', author: 'Arch', icon: 'search', dependencies: [], component: 'CodebaseSearch' },
  { id: 'models', name: 'Models', description: 'Compare responses from multiple AI providers side-by-side', category: 'model', installed: false, version: '1.0.0', author: 'Arch', icon: 'cpu', dependencies: [], component: 'ModelComparison' },
  { id: 'tests', name: 'Tests', description: 'Run comprehensive tests across the entire codebase', category: 'tool', installed: true, version: '1.0.0', author: 'Arch', icon: 'flask-conical', dependencies: [], component: 'TestingDashboard' },
  { id: 'arch', name: 'Arch', description: '2D dependency graph of the entire stack', category: 'visualization', installed: true, version: '1.0.0', author: 'Arch', icon: 'layers', dependencies: [], component: 'ArchitectureViz' },
  { id: 'uitester', name: 'UI Tester', description: 'Preview your app, capture runtime errors, fix them with AI', category: 'tool', installed: true, version: '1.0.0', author: 'Arch', icon: 'eye', dependencies: [], component: 'UITester' },
  // AVAILABLE IN ADDON LIBRARY (uninstalled by default)
  { id: 'skills', name: 'Skills', description: 'Toggleable AI capabilities and tools', category: 'tool', installed: false, version: '1.0.0', author: 'Arch', icon: 'zap', dependencies: [], component: 'SkillsPanel' },
  { id: 'github', name: 'GitHub', description: 'Browse repos, commits, and file trees', category: 'tool', installed: false, version: '1.0.0', author: 'Arch', icon: 'git-branch', dependencies: [], component: 'GitHubViewer' },
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
  pinnedAddons: [],
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
  skills: SkillItem[];
  setSkills: (s: SkillItem[]) => void;
  toggleSkill: (id: string) => void;
  centerTab: string;
  setCenterTab: (t: string) => void;
  leftTab: string;
  setLeftTab: (t: string) => void;
  rightTab: string;
  setRightTab: (t: string) => void;
  version: number;
  setVersion: (v: number) => void;
  projectRoot: string | null;
  setProjectRoot: (r: string | null) => void;
  customTheme: ThemeConfig;
  setCustomTheme: (t: Partial<ThemeConfig>) => void;
  showHome: boolean;
  setShowHome: (v: boolean) => void;
}

export const useStore = create<AppStore>((set, get) => ({
  theme: themes.orion,
  setTheme: (id) => {
    const t = id === 'custom' ? get().customTheme : themes[id];
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
  skills: [{ id: 'filesystem', name: 'Filesystem', description: 'Read, create, edit, and refactor files', icon: 'folder', category: 'Code', enabled: true }],
  setSkills: (skills) => set({ skills }),
  toggleSkill: (id) => set((state) => ({
    skills: state.skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s),
  })),
  centerTab: 'CodebaseSearch',
  setCenterTab: (centerTab) => set({ centerTab }),
  leftTab: 'files',
  setLeftTab: (leftTab) => set({ leftTab }),
  rightTab: 'chat',
  setRightTab: (rightTab) => set({ rightTab }),
  projectRoot: null,
  setProjectRoot: (projectRoot) => set({ projectRoot }),
  customTheme: themes.custom,
  setCustomTheme: (updates) => set((state) => {
    const next = { ...state.customTheme, ...updates };
    if (state.settings.theme === 'custom') {
      state.applyThemeToDOM(next);
      return { customTheme: next, theme: next };
    }
    return { customTheme: next };
  }),
  showHome: true,
  setShowHome: (showHome) => set({ showHome }),
  version: 1.0,
  setVersion: (v) => set({ version: v }),
}));
