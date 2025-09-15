import { StaticNamespaces } from '../storage-providers/types';
import { getTypedStorageManagerInstance } from './initialization';
export const DEFAULT_ARCHIVE_CONFIG = {
    autoArchive: {
        enabled: true,
        inactivityThreshold: 24, // 24 hours
        completedSessionDelay: 5, // 5 seconds
        checkInterval: 60, // Check every hour
    },
    storage: {
        maxArchiveAge: 30, // 30 days
        maxSummaryAge: 7, // 7 days
        maxArchiveSize: 1000, // 1 GB
        compressArchives: true,
    },
    sessions: {
        archiveIncompleteSessions: true,
        minEventsToArchive: 5,
        keepRawEvents: true, // Changed to true by default to preserve data
        groupByRepository: false,
    },
    export: {
        defaultFormat: 'json',
        includeRawEvents: false,
        includeMetrics: true,
    },
};
export class ArchiveConfigurationService {
    configNamespace = StaticNamespaces.ARCHIVE_CONFIGURATION;
    configKey = 'settings';
    async getConfiguration() {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            const result = await storageManager.get(this.configKey, this.configNamespace);
            if (result.success && result.data) {
                // Merge with defaults to ensure all fields exist
                return this.mergeWithDefaults(result.data);
            }
            return DEFAULT_ARCHIVE_CONFIG;
        }
        catch (error) {
            console.error('[ArchiveConfig] Failed to get configuration:', error);
            return DEFAULT_ARCHIVE_CONFIG;
        }
    }
    async updateConfiguration(config) {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            const current = await this.getConfiguration();
            const updated = this.deepMerge(current, config);
            await storageManager.set(this.configKey, updated, this.configNamespace);
            console.log('[ArchiveConfig] Configuration updated:', updated);
            // Emit event for any listeners
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach((window) => {
                window.webContents.send('archive-config:updated', updated);
            });
        }
        catch (error) {
            console.error('[ArchiveConfig] Failed to update configuration:', error);
            throw error;
        }
    }
    mergeWithDefaults(config) {
        return this.deepMerge(DEFAULT_ARCHIVE_CONFIG, config);
    }
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== undefined) {
                if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                }
                else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    }
}
export const archiveConfigService = new ArchiveConfigurationService();
