export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    provider?: string;
    model?: string;
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
    changeType: 'add' | 'remove' | 'modify' | 'rename';
    lineStart: number;
    lineEnd: number;
    oldContent?: string;
    newContent?: string;
    timestamp: string;
    reason: string;
    status: 'pending' | 'applied' | 'reverted';
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
export type LoopStage = 'analyze' | 'plan' | 'build' | 'test' | 'debug' | 'improve' | 'verify' | 'commit';
export interface LoopLog {
    timestamp: string;
    stage: LoopStage;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
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
    type: 'console' | 'runtime' | 'build' | 'api' | 'memory' | 'render' | 'test';
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
export interface VerifyResult {
    id: string;
    featureId?: string;
    timestamp: string;
    status: 'passed' | 'failed' | 'retrying';
    screenshots: string[];
    logs: string[];
    error?: string;
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
