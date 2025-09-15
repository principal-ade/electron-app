import type { CommandOptions, CommandResult, DialogOptions, DialogResult, UpdateCheckResult } from '../../shared/main-process-api-interfaces/SystemAPI';
export declare class SystemService {
    static getPlatform(): Promise<string>;
    static getSystemInfo(): Promise<{
        totalMemory: number;
        freeMemory: number;
        totalDisk: number;
        freeDisk: number;
        platform: string;
        arch: string;
        cpus: number;
        osVersion: string;
    } | null>;
    static executeCommand(options: CommandOptions): Promise<CommandResult>;
    static openDialog(options: DialogOptions): Promise<DialogResult>;
    static checkForUpdateManually(): Promise<UpdateCheckResult>;
    static restartApp(): Promise<void>;
}
//# sourceMappingURL=SystemService.d.ts.map