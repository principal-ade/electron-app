import { getTypedStorageManagerInstance } from './initialization';
import { agentSessionArchivingService } from '../agent-sessions/AgentSessionArchivingService';
import { archiveConfigService } from './ArchiveConfiguration';
import { StaticNamespaces } from '../storage-providers/types';
export class AgentSessionAutoArchivingService {
    checkIntervalTimer = null;
    config = null;
    async initialize() {
        try {
            // Load configuration
            this.config = await archiveConfigService.getConfiguration();
            // Start auto-archiving if enabled
            if (this.config.autoArchive.enabled) {
                this.startAutoArchiving();
            }
            console.log('[AgentSessionAutoArchiving] Initialized with config:', this.config);
        }
        catch (error) {
            console.error('[AgentSessionAutoArchiving] Failed to initialize:', error);
        }
    }
    startAutoArchiving() {
        if (this.checkIntervalTimer) {
            clearInterval(this.checkIntervalTimer);
        }
        if (!this.config)
            return;
        const intervalMs = this.config.autoArchive.checkInterval * 60 * 1000;
        // Run immediately on start
        this.checkForInactiveSessions();
        // Then run periodically
        this.checkIntervalTimer = setInterval(() => {
            this.checkForInactiveSessions();
        }, intervalMs);
        console.log(`[AgentSessionAutoArchiving] Auto-archiving started, checking every ${this.config.autoArchive.checkInterval} minutes`);
    }
    async checkForInactiveSessions() {
        try {
            if (!this.config)
                return;
            const storageManager = await getTypedStorageManagerInstance();
            // Get all sessions from processed events
            const keysResult = await storageManager.keys(StaticNamespaces.AGENT_SESSIONS);
            if (!keysResult) {
                return;
            }
            const now = Date.now();
            const inactivityThresholdMs = this.config.autoArchive.inactivityThreshold * 60 * 60 * 1000;
            let archivedCount = 0;
            for (const sessionId of keysResult) {
                try {
                    const sessionResult = await storageManager.get(sessionId, StaticNamespaces.AGENT_SESSIONS);
                    if (!sessionResult.success || !sessionResult.data) {
                        continue;
                    }
                    const session = sessionResult.data;
                    const timeSinceLastUpdate = now - session.lastUpdateTime;
                    // Check if session should be archived
                    const shouldArchive = this.shouldArchiveSession(session, timeSinceLastUpdate);
                    if (shouldArchive) {
                        console.log(`[AgentSessionAutoArchiving] Archiving inactive session ${sessionId} (inactive for ${Math.round(timeSinceLastUpdate / 1000 / 60)} minutes)`);
                        // Archive session (raw events are always included)
                        await agentSessionArchivingService.archiveSession(sessionId);
                        archivedCount++;
                    }
                }
                catch (error) {
                    console.error(`[AgentSessionAutoArchiving] Failed to check session ${sessionId}:`, error);
                }
            }
            if (archivedCount > 0) {
                console.log(`[AgentSessionAutoArchiving] Archived ${archivedCount} inactive sessions`);
                // Notify UI
                const { BrowserWindow } = require('electron');
                BrowserWindow.getAllWindows().forEach((window) => {
                    window.webContents.send('archive:sessions-archived', { count: archivedCount });
                });
            }
        }
        catch (error) {
            console.error('[AgentSessionAutoArchiving] Failed to check for inactive sessions:', error);
        }
    }
    shouldArchiveSession(session, timeSinceLastUpdate) {
        if (!this.config)
            return false;
        const inactivityThresholdMs = this.config.autoArchive.inactivityThreshold * 60 * 60 * 1000;
        // Check if session is inactive for too long
        if (timeSinceLastUpdate < inactivityThresholdMs) {
            return false;
        }
        // Check if session has a Stop event (is complete)
        const hasStopEvent = session.segments?.some((segment) => segment.events?.some((event) => event.type === 'session-stop'));
        // If session is complete, always archive
        if (hasStopEvent) {
            return true;
        }
        // If archiving incomplete sessions is disabled, don't archive
        if (!this.config.sessions.archiveIncompleteSessions) {
            return false;
        }
        // Check minimum event count
        const totalEvents = session.totalEvents || 0;
        if (totalEvents < this.config.sessions.minEventsToArchive) {
            return false;
        }
        return true;
    }
    async archiveAllInactiveSessions() {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            const keysResult = await storageManager.keys(StaticNamespaces.AGENT_SESSIONS);
            if (!keysResult) {
                return 0;
            }
            let archivedCount = 0;
            for (const sessionId of keysResult) {
                try {
                    // Archive session (raw events are always included)
                    await agentSessionArchivingService.archiveSession(sessionId);
                    archivedCount++;
                }
                catch (error) {
                    console.error(`[AgentSessionAutoArchiving] Failed to archive session ${sessionId}:`, error);
                }
            }
            return archivedCount;
        }
        catch (error) {
            console.error('[AgentSessionAutoArchiving] Failed to archive all sessions:', error);
            return 0;
        }
    }
    async updateConfiguration(config) {
        await archiveConfigService.updateConfiguration(config);
        this.config = await archiveConfigService.getConfiguration();
        // Restart auto-archiving if settings changed
        if (this.config.autoArchive.enabled) {
            this.startAutoArchiving();
        }
        else {
            this.stopAutoArchiving();
        }
    }
    stopAutoArchiving() {
        if (this.checkIntervalTimer) {
            clearInterval(this.checkIntervalTimer);
            this.checkIntervalTimer = null;
            console.log('[AgentSessionAutoArchiving] Auto-archiving stopped');
        }
    }
    async getArchiveStatistics() {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            // Count active sessions
            const processedKeys = await storageManager.keys(StaticNamespaces.AGENT_SESSIONS);
            const activeSessionCount = processedKeys ? processedKeys.length || 0 : 0;
            // Count archived sessions
            const summaryKeys = await storageManager.keys(StaticNamespaces.SESSION_SUMMARIES);
            const archivedSessionCount = summaryKeys ? summaryKeys.length || 0 : 0;
            // Get storage metrics
            const metrics = await agentSessionArchivingService.getStorageMetrics();
            return {
                activeSessionCount,
                archivedSessionCount,
                totalStorageUsed: metrics.totalStorageUsed,
                oldestArchive: metrics.archiveFiles.oldestFile,
                newestArchive: metrics.archiveFiles.newestFile,
            };
        }
        catch (error) {
            console.error('[AgentSessionAutoArchiving] Failed to get statistics:', error);
            return {
                activeSessionCount: 0,
                archivedSessionCount: 0,
                totalStorageUsed: 0,
            };
        }
    }
    destroy() {
        this.stopAutoArchiving();
    }
}
export const agentSessionAutoArchivingService = new AgentSessionAutoArchivingService();
