export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: string;
  provider?: string;
  model?: string;
  tokens?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  providerId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeChange {
  id: string;
  filePath: string;
  changeType: 'add' | 'remove' | 'modify';
  lineStart: number;
  lineEnd: number;
  oldContent?: string;
  newContent?: string;
  timestamp: string;
  reason: string;
  status: 'pending' | 'applied' | 'reverted';
}

export type LoopStage = 'analyze' | 'plan' | 'build' | 'test' | 'debug' | 'improve' | 'verify' | 'commit';

export interface LoopLog {
  timestamp: string;
  stage: LoopStage;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface LoopState {
  id: string;
  iteration: number;
  stage: LoopStage;
  status: 'running' | 'paused' | 'error' | 'success';
  task: string;
  plan: string[];
  progress: number;
  logs: LoopLog[];
  startTime: string;
  endTime?: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  status: 'planned' | 'in_progress' | 'build' | 'test' | 'debug' | 'complete';
  priority: number;
  progress: number;
  component: string;
  createdAt: string;
}

export interface TestResult {
  id: string;
  featureId: string;
  name: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  duration: number;
  error?: string;
  timestamp: string;
}

export interface ErrorReport {
  id: string;
  type: string;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  timestamp: string;
  status: 'open' | 'investigating' | 'fixed' | 'verified';
  fix?: string;
  verifiedAt?: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size: number;
  modified: string;
  language?: string;
}

export interface AgentAction {
  id: string;
  agent: string;
  action: string;
  target: string;
  timestamp: string;
  status: 'started' | 'completed' | 'failed';
  details?: string;
}

export type ThemeId = 'orion' | 'midnight' | 'solar' | 'forest' | 'ocean' | 'cyber' | 'custom' | 'rose' | 'amber' | 'emerald' | 'violet' | 'coral' | 'slate' | 'zinc' | 'stone' | 'nord' | 'dracula' | 'monokai' | 'gruvbox' | 'tokyo' | 'one_dark' | 'pastel' | 'paper' | 'coffee' | 'neon' | 'matrix' | 'cherry' | 'peach' | 'mint' | 'lavender' | 'gold' | 'ice' | 'rust' | 'teal' | 'bubblegum' | 'high_contrast' | 'warm' | 'cool' | 'sunset' | 'dawn' | 'sky';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  bg: string;
  bgPanel: string;
  bgSurface: string;
  bgHover: string;
  bgActive: string;
  border: string;
  borderStrong: string;
  text: string;
  textHeading: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentDim: string;
  accentBg: string;
  success: string;
  warning: string;
  danger: string;
  dangerBg: string;
}

export interface Extension {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'model' | 'agent' | 'tool' | 'visualization';
  version: string;
  author: string;
  icon: string;
  dependencies: string[];
  config?: Record<string, any>;
  component: string; // which React component to render
}

export interface TestIssue {
  id: string;
  category: string;
  file?: string;
  line?: number;
  column?: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  fixSuggestion: string;
  scoreImpact: number;
}

export interface TestResult {
  mode: string;
  root: string;
  totalFiles: number;
  scannedFiles: number;
  scores: Record<string, number>;
  overallScore: number;
  issues: TestIssue[];
  duration: number;
}

export interface UITestLog {
  id: string;
  message: string;
  source?: string;
  line?: number;
  col?: number;
  stack?: string;
  timestamp: number;
  projectUrl: string;
}



export interface NamedProvider {
  id: string;
  name: string;          // user-given name, e.g. "My OpenAI Key"
  configId: string;      // provider type: openai, anthropic, ollama, etc.
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
}

export interface AppSettings {
  theme: ThemeId;
  fontSize: 'sm' | 'md' | 'lg';
  fontFamily: 'sans' | 'mono';
  animations: boolean;
  autoSave: boolean;
  sidebarWidth: number;
  chatWidth: number;
  minimizeToTray: boolean;
  startupBehavior: 'welcome' | 'last_project';
  telemetry: boolean;
  pinnedAddons: string[];
  transparency?: number;
}
