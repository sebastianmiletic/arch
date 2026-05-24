import type { LoopState } from './types.js';
export declare class AutonomousLoop {
    private state;
    private running;
    private wsBroadcast;
    constructor(wsBroadcast: (data: any) => void);
    start(task?: string): void;
    stop(): void;
    private loop;
    private executeStage;
    private stageAnalyze;
    private stagePlan;
    private stageBuild;
    private stageTest;
    private stageDebug;
    private stageImprove;
    private stageVerify;
    private stageCommit;
    private log;
    private broadcast;
    getState(): LoopState | null;
}
