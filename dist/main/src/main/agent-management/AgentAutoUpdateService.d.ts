import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentInstallStatus } from '../../shared/main-process-api-interfaces/AgentInstallationAPI';
export interface AgentUpdatePreferences {
    enabled: boolean;
    checkInterval: number;
    autoInstall: boolean;
    lastCheckTime?: number;
    notifyOnly: boolean;
}
export interface AgentUpdateStatus {
    agentType: SupportedAgent;
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion?: string;
    lastChecked: Date;
    error?: string;
}
interface UpdateCheckResult {
    agentType: SupportedAgent;
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion: string;
    installStatus: AgentInstallStatus;
}
export declare class AgentAutoUpdateService {
    private static instance;
    private updateCheckInterval;
    private agentServices;
    private defaultPreferences;
    private updateCheckPromises;
    private userPreferencesHandler;
    private updateInfoCache;
    private constructor();
    static getInstance(): AgentAutoUpdateService;
    /**
     * Initialize the auto-update service
     */
    initialize(): Promise<void>;
    /**
     * Start periodic update checks
     */
    private startPeriodicChecks;
    /**
     * Stop periodic update checks
     */
    private stopPeriodicChecks;
    /**
     * Check all agents for updates
     */
    checkAllForUpdates(): Promise<UpdateCheckResult[]>;
    /**
     * Check a specific agent for updates
     */
    private checkAgentForUpdate;
    /**
     * Perform the actual update check
     */
    private performUpdateCheck;
    /**
     * Handle available updates based on preferences
     */
    private handleAvailableUpdates;
    /**
     * Auto-install an update
     */
    private autoInstallUpdate;
    /**
     * Show update notification
     */
    private showUpdateNotification;
    /**
     * Show a system notification
     */
    private showNotification;
    /**
     * Broadcast update availability to all windows
     */
    private broadcastUpdateAvailable;
    /**
     * Store update info for UI access
     */
    private storeUpdateInfo;
    /**
     * Get stored update info
     */
    getStoredUpdateInfo(agentType: SupportedAgent): Promise<UpdateCheckResult | null>;
    /**
     * Clear stored update info
     */
    clearStoredUpdateInfo(agentType: SupportedAgent): Promise<void>;
    /**
     * Get update preferences
     */
    getUpdatePreferences(): Promise<AgentUpdatePreferences>;
    /**
     * Save update preferences
     */
    saveUpdatePreferences(preferences: Partial<AgentUpdatePreferences>): Promise<void>;
    /**
     * Save last check time
     */
    private saveLastCheckTime;
    /**
     * Manually trigger update check for a specific agent
     */
    checkForUpdate(agentType: SupportedAgent): Promise<UpdateCheckResult | null>;
    /**
     * Shutdown the service
     */
    shutdown(): void;
}
export {};
//# sourceMappingURL=AgentAutoUpdateService.d.ts.map