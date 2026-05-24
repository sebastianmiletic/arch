import type { FileNode } from './types.js';
export declare function getFileTree(root: string): FileNode;
export declare function getProjectStats(root: string): {
    fileCount: number;
    lineCount: number;
    languageBreakdown: Record<string, number>;
    gitCommits: number;
    lastModified: string;
};
