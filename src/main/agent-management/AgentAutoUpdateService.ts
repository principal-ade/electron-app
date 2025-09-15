import { app, BrowserWindow, Notification } from 'electron';
import { SupportedAgent, getAgentInfo } from "@principal-ai/agent-monitoring";
import { BaseAgentInstallationService } from './BaseAgentInstallationService';
import { GeminiInstallationService } from './GeminiInstallationService';
import { OpenCodeInstallationService } from './OpenCodeInstallationService';
import { getTypedStorageManager } from '../storage-providers';
import { AgentInstallStatus } from '../../shared/main-process-api-interfaces/AgentInstallationAPI';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';

export interface AgentUpdatePreferences {
  enabled: boolean;
  checkInterval: number; // in hours
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

export class AgentAutoUpdateService {
  private static instance: AgentAutoUpdateService;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private agentServices: Map<SupportedAgent, BaseAgentInstallationService>;
  private defaultPreferences: AgentUpdatePreferences = {
    enabled: true,
    checkInterval: 24, // hours
    autoInstall: false,
    notifyOnly: true,
  };
  private updateCheckPromises: Map<SupportedAgent, Promise<UpdateCheckResult | null>> = new Map();
  private userPreferencesHandler: UserPreferencesHandler | null = null;
  private updateInfoCache: Map<SupportedAgent, UpdateCheckResult> = new Map();

  private constructor() {
    this.agentServices = new Map<SupportedAgent, BaseAgentInstallationService>([
      [SupportedAgent.GEMINI, GeminiInstallationService.getInstance() as BaseAgentInstallationService],
      [SupportedAgent.OPENCODE, OpenCodeInstallationService.getInstance() as BaseAgentInstallationService],
    ]);
  }

  static getInstance(): AgentAutoUpdateService {
    if (!AgentAutoUpdateService.instance) {
      AgentAutoUpdateService.instance = new AgentAutoUpdateService();
    }
    return AgentAutoUpdateService.instance;
  }

  /**
   * Initialize the auto-update service
   */
  async initialize(): Promise<void> {
    console.log('[AgentAutoUpdate] Initializing auto-update service...');
    
    // Initialize UserPreferencesHandler
    try {
      const typedStore = await getTypedStorageManager();
      this.userPreferencesHandler = new UserPreferencesHandler(typedStore);
    } catch (error) {
      console.error('[AgentAutoUpdate] Failed to initialize UserPreferencesHandler:', error);
      return;
    }
    
    // Load preferences
    const preferences = await this.getUpdatePreferences();
    
    if (!preferences.enabled) {
      console.log('[AgentAutoUpdate] Auto-update is disabled');
      return;
    }

    // Schedule initial check after a delay to not block app startup
    setTimeout(() => {
      this.checkAllForUpdates();
    }, 30000); // 30 seconds after startup

    // Setup periodic checks
    this.startPeriodicChecks(preferences.checkInterval);
  }

  /**
   * Start periodic update checks
   */
  private startPeriodicChecks(intervalHours: number): void {
    this.stopPeriodicChecks();
    
    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.updateCheckInterval = setInterval(() => {
      this.checkAllForUpdates();
    }, intervalMs);
    
    console.log(`[AgentAutoUpdate] Scheduled update checks every ${intervalHours} hours`);
  }

  /**
   * Stop periodic update checks
   */
  private stopPeriodicChecks(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  /**
   * Check all agents for updates
   */
  async checkAllForUpdates(): Promise<UpdateCheckResult[]> {
    console.log('[AgentAutoUpdate] Checking all agents for updates...');
    
    const updatePromises = Array.from(this.agentServices.entries()).map(
      ([agentType, service]) => this.checkAgentForUpdate(agentType, service)
    );

    const results = await Promise.all(updatePromises);
    const updates = results.filter((r): r is UpdateCheckResult => r !== null && r.hasUpdate);

    if (updates.length > 0) {
      await this.handleAvailableUpdates(updates);
    }

    // Save last check time
    await this.saveLastCheckTime();

    return results.filter((r): r is UpdateCheckResult => r !== null);
  }

  /**
   * Check a specific agent for updates
   */
  private async checkAgentForUpdate(
    agentType: SupportedAgent,
    service: BaseAgentInstallationService
  ): Promise<UpdateCheckResult | null> {
    // Check if we're already checking this agent
    const existingPromise = this.updateCheckPromises.get(agentType);
    if (existingPromise) {
      return existingPromise;
    }

    const checkPromise = this.performUpdateCheck(agentType, service);
    this.updateCheckPromises.set(agentType, checkPromise);

    try {
      const result = await checkPromise;
      return result;
    } finally {
      this.updateCheckPromises.delete(agentType);
    }
  }

  /**
   * Perform the actual update check
   */
  private async performUpdateCheck(
    agentType: SupportedAgent,
    service: BaseAgentInstallationService
  ): Promise<UpdateCheckResult | null> {
    try {
      // First check if the agent is installed and is our version
      const installStatus = await service.checkInstallation();
      
      if (!installStatus.installed || !installStatus.isOurVersion) {
        console.log(`[AgentAutoUpdate] ${agentType} is not installed or not our version, skipping update check`);
        return null;
      }

      // Check for updates
      const updateInfo = await service.checkForUpdates();
      
      console.log(`[AgentAutoUpdate] ${agentType} update check result:`, updateInfo);

      return {
        agentType,
        hasUpdate: updateInfo.hasUpdate,
        currentVersion: updateInfo.currentVersion,
        latestVersion: updateInfo.latestVersion,
        installStatus,
      };
    } catch (error) {
      console.error(`[AgentAutoUpdate] Error checking ${agentType} for updates:`, error);
      return null;
    }
  }

  /**
   * Handle available updates based on preferences
   */
  private async handleAvailableUpdates(updates: UpdateCheckResult[]): Promise<void> {
    const preferences = await this.getUpdatePreferences();
    
    for (const update of updates) {
      const agentInfo = getAgentInfo(update.agentType);
      
      if (preferences.autoInstall && !preferences.notifyOnly) {
        // Auto-install the update
        await this.autoInstallUpdate(update);
      } else {
        // Show notification
        this.showUpdateNotification(update, agentInfo.displayName);
      }

      // Store update info for UI to display
      await this.storeUpdateInfo(update);
    }
  }

  /**
   * Auto-install an update
   */
  private async autoInstallUpdate(update: UpdateCheckResult): Promise<void> {
    console.log(`[AgentAutoUpdate] Auto-installing update for ${update.agentType}...`);
    
    try {
      const service = this.agentServices.get(update.agentType);
      if (!service) {
        throw new Error(`No service found for ${update.agentType}`);
      }

      await service.update();
      
      const agentInfo = getAgentInfo(update.agentType);
      this.showNotification(
        `${agentInfo.displayName} Updated`,
        `Successfully updated from v${update.currentVersion} to v${update.latestVersion}`,
        'success'
      );
    } catch (error) {
      console.error(`[AgentAutoUpdate] Failed to auto-install update for ${update.agentType}:`, error);
      
      const agentInfo = getAgentInfo(update.agentType);
      this.showNotification(
        `${agentInfo.displayName} Update Failed`,
        `Failed to update to v${update.latestVersion}. Please update manually.`,
        'error'
      );
    }
  }

  /**
   * Show update notification
   */
  private showUpdateNotification(update: UpdateCheckResult, displayName: string): void {
    const message = `Version ${update.latestVersion} is available (current: ${update.currentVersion})`;
    
    this.showNotification(
      `${displayName} Update Available`,
      message,
      'info'
    );

    // Send to all windows for UI update
    this.broadcastUpdateAvailable(update);
  }

  /**
   * Show a system notification
   */
  private showNotification(title: string, body: string, type: 'info' | 'success' | 'error'): void {
    if (!Notification.isSupported()) {
      console.log(`[AgentAutoUpdate] Notification (${type}): ${title} - ${body}`);
      return;
    }

    const notification = new Notification({
      title,
      body,
      icon: app.isPackaged 
        ? undefined 
        : undefined, // Could add app icon here
    });

    notification.show();
  }

  /**
   * Broadcast update availability to all windows
   */
  private broadcastUpdateAvailable(update: UpdateCheckResult): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('agent-update-available', update);
    });
  }

  /**
   * Store update info for UI access
   */
  private async storeUpdateInfo(update: UpdateCheckResult): Promise<void> {
    // Store in memory cache for this session
    this.updateInfoCache.set(update.agentType, update);
  }

  /**
   * Get stored update info
   */
  async getStoredUpdateInfo(agentType: SupportedAgent): Promise<UpdateCheckResult | null> {
    // Return from memory cache
    return this.updateInfoCache.get(agentType) || null;
  }

  /**
   * Clear stored update info
   */
  async clearStoredUpdateInfo(agentType: SupportedAgent): Promise<void> {
    // Clear from memory cache
    this.updateInfoCache.delete(agentType);
  }

  /**
   * Get update preferences
   */
  async getUpdatePreferences(): Promise<AgentUpdatePreferences> {
    if (!this.userPreferencesHandler) {
      return this.defaultPreferences;
    }

    try {
      const userPrefs = await this.userPreferencesHandler.getUserPreferences();
      return userPrefs.agentAutoUpdate || this.defaultPreferences;
    } catch (error) {
      console.error('[AgentAutoUpdate] Failed to load preferences:', error);
      return this.defaultPreferences;
    }
  }

  /**
   * Save update preferences
   */
  async saveUpdatePreferences(preferences: Partial<AgentUpdatePreferences>): Promise<void> {
    if (!this.userPreferencesHandler) {
      console.error('[AgentAutoUpdate] UserPreferencesHandler not initialized');
      return;
    }

    try {
      const current = await this.getUpdatePreferences();
      const updated = { ...current, ...preferences };
      
      await this.userPreferencesHandler.updateUserPreferences({
        agentAutoUpdate: updated
      });
      
      // Restart periodic checks if interval changed
      if (preferences.checkInterval && preferences.checkInterval !== current.checkInterval) {
        this.startPeriodicChecks(preferences.checkInterval);
      }
      
      // Stop checks if disabled
      if (preferences.enabled === false) {
        this.stopPeriodicChecks();
      } else if (preferences.enabled === true && !current.enabled) {
        this.startPeriodicChecks(updated.checkInterval);
      }
    } catch (error) {
      console.error('[AgentAutoUpdate] Failed to save preferences:', error);
    }
  }

  /**
   * Save last check time
   */
  private async saveLastCheckTime(): Promise<void> {
    try {
      const prefs = await this.getUpdatePreferences();
      await this.saveUpdatePreferences({ ...prefs, lastCheckTime: Date.now() });
    } catch (error) {
      console.error('[AgentAutoUpdate] Failed to save last check time:', error);
    }
  }

  /**
   * Manually trigger update check for a specific agent
   */
  async checkForUpdate(agentType: SupportedAgent): Promise<UpdateCheckResult | null> {
    const service = this.agentServices.get(agentType);
    if (!service) {
      console.error(`[AgentAutoUpdate] No service found for ${agentType}`);
      return null;
    }

    return this.checkAgentForUpdate(agentType, service);
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    console.log('[AgentAutoUpdate] Shutting down auto-update service');
    this.stopPeriodicChecks();
  }
}