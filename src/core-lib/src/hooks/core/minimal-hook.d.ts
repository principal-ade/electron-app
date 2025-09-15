#!/usr/bin/env node
/**
 * Minimal Hook - Zero Config Pass-Through
 * Tries HTTP to agent session events bridge, falls back to file storage
 */
import { SupportedAgent } from '../../agents';
export declare class MinimalHook {
    private fallbackFile;
    private errorFile;
    private bridgeRoute;
    constructor(agent: SupportedAgent);
    private getWritableDirectory;
    run(): Promise<void>;
    private readStdin;
    private sendHttp;
    private saveToFile;
    private logError;
}
//# sourceMappingURL=minimal-hook.d.ts.map