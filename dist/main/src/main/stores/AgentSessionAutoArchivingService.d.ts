import { ArchiveConfiguration } from '../storage-providers/typed-namespaces';
export declare class AgentSessionAutoArchivingService {
    private checkIntervalTimer;
    private config;
    initialize(): Promise<void>;
    private startAutoArchiving;
    private checkForInactiveSessions;
    private shouldArchiveSession;
    archiveAllInactiveSessions(): Promise<number>;
    updateConfiguration(config: Partial<ArchiveConfiguration>): Promise<void>;
    private stopAutoArchiving;
    getArchiveStatistics(): Promise<{
        activeSessionCount: number;
        archivedSessionCount: number;
        totalStorageUsed: number;
        oldestArchive?: Date;
        newestArchive?: Date;
    }>;
    destroy(): void;
}
export declare const agentSessionAutoArchivingService: AgentSessionAutoArchivingService;
//# sourceMappingURL=AgentSessionAutoArchivingService.d.ts.map