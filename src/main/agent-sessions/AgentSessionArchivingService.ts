import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { getTypedStorageManagerInstance } from '../stores/initialization';
import { StorageNamespaces } from '../storage-providers/all-namespaces';
import { SessionSummary } from '../storage-providers/typed-namespaces';
import { AgentEventNamespaces } from '../../shared/types/namespaces.types';
import { AgentSessionEvent } from '../../shared/main-process-api-interfaces';
import { NamespaceCategory } from '../../shared/main-process-api-interfaces/StoreAPI';
import { StaticNamespaces } from '../storage-providers/types';
import { ArchiveConfiguration } from '../storage-providers/typed-namespaces'; 

export interface StorageMetrics {
  archiveFiles: {
    count: number;
    totalSize: number;
    oldestFile?: Date;
    newestFile?: Date;
  };
  processedEvents: {
    sessionCount: number;
    totalSize: number;
  };
  rawEvents: {
    [agent: string]: {
      eventCount: number;
      totalSize: number;
    };
  };
  summaries: {
    count: number;
    totalSize: number;
  };
  totalStorageUsed: number;
}

export class AgentSessionArchivingService {
  private archiveDir: string;
  private readonly summariesNamespace = StaticNamespaces.SESSION_SUMMARIES;
  private readonly processedEventsNamespace = StaticNamespaces.AGENT_SESSIONS; // Fixed: Use correct namespace
  private maxSummaryAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  private maxArchiveAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  constructor() {
    // Store archives in userData/archived-sessions
    this.archiveDir = path.join(app.getPath('userData'), 'archived-sessions');
    this.ensureArchiveDirectory();
  }

  /**
   * Ensure the archive directory exists
   */
  private async ensureArchiveDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.archiveDir, { recursive: true });
    } catch (error) {
      console.error('[AgentSessionArchiving] Failed to create archive directory:', error);
    }
  }

  /**
   * Archive a completed session
   * @param sessionId - The session to archive
   * @param options - Optional settings for archiving
   */
  async archiveSession(
    sessionId: string, 
    options: { 
      skipCleanup?: boolean;  // Skip deletion of raw events (useful for testing)
      skipProcessedDelete?: boolean;  // Skip deletion from processed events
    } = {}
  ): Promise<void> {
    const archiveStartTime = Date.now();
    try {
      console.log(`[AgentSessionArchiving] Starting archive of session ${sessionId}`);
      
      const storageManager = await getTypedStorageManagerInstance();
      
      // Get the full session data from processed events
      const sessionResult = await storageManager.get(sessionId, this.processedEventsNamespace);
      if (!sessionResult.success || !sessionResult.data) {
        console.warn(`[AgentSessionArchiving] Session ${sessionId} not found in processed events`);
        return;
      }
      
      const sessionData = sessionResult.data;
      
      // Create summary for quick access
      const summary: SessionSummary = {
        sessionId,
        provider: sessionData.provider,
        workingDirectory: this.extractWorkingDirectory(sessionData),
        startTime: sessionData.startTime,
        endTime: sessionData.lastUpdateTime,
        lastUpdateTime: sessionData.lastUpdateTime,
        totalEvents: sessionData.totalEvents,
        fileAccessCount: this.countFileAccesses(sessionData),
        fileWriteCount: this.countFileWrites(sessionData),
        toolCallCount: this.countToolCalls(sessionData),
        repositoriesAccessed: sessionData.repositoriesAccessed?.map(repo => repo.remoteUrl) || [],
        isActive: false
      };
      
      // Create session-specific directory
      const sessionDirName = this.generateSessionDirName(sessionId, summary.startTime);
      const sessionDir = path.join(this.archiveDir, sessionDirName);
      
      // If re-archiving, clean up the old archive first
      if (await this.fileExists(sessionDir)) {
        console.log(`[AgentSessionArchiving] Archive already exists at ${sessionDir}, cleaning up for re-archive...`);
        await this.removeDirectory(sessionDir);
      }
      
      await fs.mkdir(sessionDir, { recursive: true });
      
      // OPTIMIZATION: Collect raw events FIRST (before writing files)
      // This allows us to know the event count for metadata
      const rawEvents = await this.collectRawEvents(sessionId, sessionData.provider);
      const archivedRawEvents = rawEvents.length > 0;
      
      if (!archivedRawEvents) {
        console.warn(`[AgentSessionArchiving] No raw events found for session ${sessionId} - this may indicate a problem`);
      }
      
      // Prepare metadata
      const metadata = {
        ...summary,
        archiveVersion: '2.0',
        archivedAt: Date.now(),
        includesRawEvents: archivedRawEvents,
        rawEventCount: rawEvents.length,
        files: {
          session: 'session.json',
          rawEvents: archivedRawEvents ? 'raw-events.json' : null,
          metadata: 'metadata.json'
        }
      };
      
      // OPTIMIZATION: Write all files in parallel
      const writePromises: Promise<void>[] = [];
      
      // Write processed session data
      const processedPath = path.join(sessionDir, 'session.json');
      writePromises.push(
        this.writeJsonFile(processedPath, sessionData)
          .then(() => console.log(`[AgentSessionArchiving] Archived processed session to ${processedPath}`))
      );
      
      // Write raw events if present
      if (archivedRawEvents) {
        const rawEventsPath = path.join(sessionDir, 'raw-events.json');
        // For large datasets, use streaming or chunked writing
        if (rawEvents.length > 1000) {
          writePromises.push(
            this.writeJsonFileStreaming(rawEventsPath, rawEvents)
              .then(() => console.log(`[AgentSessionArchiving] Archived ${rawEvents.length} raw events to ${rawEventsPath}`))
          );
        } else {
          writePromises.push(
            this.writeJsonFile(rawEventsPath, rawEvents)
              .then(() => console.log(`[AgentSessionArchiving] Archived ${rawEvents.length} raw events to ${rawEventsPath}`))
          );
        }
      }
      
      // Write metadata file
      const metadataPath = path.join(sessionDir, 'metadata.json');
      writePromises.push(
        this.writeJsonFile(metadataPath, metadata)
          .then(() => console.log(`[AgentSessionArchiving] Archived metadata to ${metadataPath}`))
      );
      
      // Wait for all writes to complete
      await Promise.all(writePromises);
      
      // Update summary with archive path (now a directory)
      summary.archivePath = sessionDir;
      
      // Store summary in session-summaries namespace
      await storageManager.set(sessionId, summary, this.summariesNamespace);
      
      // Remove from processed events to save space (unless skipped for testing)
      if (!options.skipProcessedDelete) {
        await storageManager.delete(sessionId, this.processedEventsNamespace);
        console.log(`[AgentSessionArchiving] Removed session ${sessionId} from processed events`);
      } else {
        console.log(`[AgentSessionArchiving] Skipped deletion of processed events (test mode)`);
      }
      
      // Clean up raw events from the events store after archiving (unless skipped for testing)
      // This is important to free up space in the active store
      if (rawEvents.length > 0 && !options.skipCleanup) {
        await this.cleanupRawEvents(sessionId, sessionData.provider);
        console.log(`[AgentSessionArchiving] Cleaned up ${rawEvents.length} raw events from events store`);
      } else if (options.skipCleanup) {
        console.log(`[AgentSessionArchiving] Skipped cleanup of ${rawEvents.length} raw events (test mode)`);
      }
      
      const totalElapsed = Date.now() - archiveStartTime;
      console.log(`[AgentSessionArchiving] Session ${sessionId} archived successfully to ${sessionDir} in ${totalElapsed}ms`);
      
    } catch (error) {
      const totalElapsed = Date.now() - archiveStartTime;
      console.error(`[AgentSessionArchiving] Failed to archive session ${sessionId} after ${totalElapsed}ms:`, error);
      throw error;
    }
  }

  /**
   * Get recent session summaries
   */
  async getRecentSummaries(): Promise<SessionSummary[]> {
    const storageManager = await getTypedStorageManagerInstance();
    const keysResult = await storageManager.keys(this.summariesNamespace);
    
    
    const summaries: SessionSummary[] = [];
    const now = Date.now();
    
    for (const key of keysResult) {
      const result = await storageManager.get(key, this.summariesNamespace);
      if (result.success && result.data) {
        const summary = result.data;
        
        // Only include summaries from the last week
        if (now - summary.lastUpdateTime <= this.maxSummaryAge) {
          summaries.push(summary);
        }
      }
    }
    
    // Sort by last update time, newest first
    return summaries.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
  }

  /**
   * Load a full session from archive
   */
  async loadArchivedSession(sessionId: string): Promise<{ session?: any; metadata?: any; rawEvents?: AgentSessionEvent[] } | null> {
    try {
      console.log(`[AgentSessionArchiving] Loading archived session ${sessionId}`);
      
      // First check if we have a summary with archive path
      const store = await getTypedStorageManagerInstance();
      const summaryResult = await store.get(sessionId, this.summariesNamespace);
      
      let archivePath: string | null = null;
      
      if (summaryResult.success && summaryResult.data && summaryResult.data.archivePath) {
        archivePath = summaryResult.data.archivePath;
      } else {
        // If no summary, search archive directory for session directory
        const dirs = await fs.readdir(this.archiveDir);
        
        const sessionDir = dirs.find(d => d.startsWith(`${sessionId}_`));
        if (sessionDir) {
          archivePath = path.join(this.archiveDir, sessionDir);
          console.log(`[AgentSessionArchiving] Found session directory: ${sessionDir}`);
        } else {
          console.log(`[AgentSessionArchiving] No directory found starting with ${sessionId}_`);
        }
      }
      
      if (!archivePath) {
        console.log(`[AgentSessionArchiving] No archive found for session ${sessionId}`);
        return null;
      }
      
      // Check if it's a directory (new format) or file (old format)
      const stats = await fs.stat(archivePath);
      
      if (stats.isDirectory()) {
        // New directory-based format
        const result: { session?: any; metadata?: any; rawEvents?: AgentSessionEvent[] } = {};
        
        // Load metadata
        const metadataPath = path.join(archivePath, 'metadata.json');
        if (await this.fileExists(metadataPath)) {
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          result.metadata = JSON.parse(metadataContent);
        }
        
        // Load session data
        const sessionPath = path.join(archivePath, 'session.json');
        if (await this.fileExists(sessionPath)) {
          const sessionContent = await fs.readFile(sessionPath, 'utf-8');
          result.session = JSON.parse(sessionContent);
        }
        
        // ALWAYS load raw events - they're part of the complete archive
        const rawEventsPath = path.join(archivePath, 'raw-events.json');
        if (await this.fileExists(rawEventsPath)) {
          const rawEventsContent = await fs.readFile(rawEventsPath, 'utf-8');
          result.rawEvents = JSON.parse(rawEventsContent);
          console.log(`[AgentSessionArchiving] Loaded ${result.rawEvents?.length} raw events from archive`);
        } else {
          console.warn(`[AgentSessionArchiving] No raw events file found at ${rawEventsPath}`);
        }
        
        console.log(`[AgentSessionArchiving] Successfully loaded archived session ${sessionId} from directory`);
        // Always return the full result object which includes session, metadata, and rawEvents
        return result;
      } else {
        // Old single-file format (backward compatibility)
        console.log(`[AgentSessionArchiving] Loading old format archive from file: ${archivePath}`);
        const content = await fs.readFile(archivePath, 'utf-8');
        const parsed = JSON.parse(content);
        console.log(`[AgentSessionArchiving] Successfully loaded archived session ${sessionId} from file`);
        return parsed;
      }
      
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to load archived session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Clean up old archives and summaries
   */
  async cleanupOldArchives(): Promise<void> {
    try {
      const now = Date.now();
      
      // Clean up old archive directories and files
      const entries = await fs.readdir(this.archiveDir);
      let deletedCount = 0;
      
      for (const entry of entries) {
        const entryPath = path.join(this.archiveDir, entry);
        const stats = await fs.stat(entryPath);
        
        if (now - stats.mtime.getTime() > this.maxArchiveAge) {
          if (stats.isDirectory()) {
            // Remove entire session directory
            await this.removeDirectory(entryPath);
            deletedCount++;
          } else if (entry.endsWith('.json')) {
            // Remove old single-file archives (backward compatibility)
            await fs.unlink(entryPath);
            deletedCount++;
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(`[AgentSessionArchiving] Cleaned up ${deletedCount} old archives`);
      }
      
      // Clean up old summaries
      const storageManager = await getTypedStorageManagerInstance();
      const keysResult = await storageManager.keys(this.summariesNamespace);
      
      if (keysResult) {
        let deletedSummaries = 0;
        
        for (const key of keysResult) {
          const result = await storageManager.get(key, this.summariesNamespace);
          if (result.success && result.data) {
            if (now - result.data.lastUpdateTime > this.maxSummaryAge) {
              await storageManager.delete(key, this.summariesNamespace);
              deletedSummaries++;
            }
          }
        }
        
        if (deletedSummaries > 0) {
          console.log(`[AgentSessionArchiving] Cleaned up ${deletedSummaries} old summaries`);
        }
      }
      
    } catch (error) {
      console.error('[AgentSessionArchiving] Failed to cleanup old archives:', error);
    }
  }

  /**
   * Generate session directory name
   */
  private generateSessionDirName(sessionId: string, startTime: number): string {
    const timestamp = new Date(startTime).toISOString().replace(/[:.]/g, '-').split('T')[0];
    return `${sessionId}_${timestamp}`;
  }
  
  /**
   * Collect raw events for a session - OPTIMIZED VERSION
   */
  private async collectRawEvents(sessionId: string, provider: string): Promise<AgentSessionEvent[]> {
    const storageManager = await getTypedStorageManagerInstance();
    const rawEvents: AgentSessionEvent[] = [];
    
    console.log(`[AgentSessionArchiving] Collecting raw events for session ${sessionId}, provider: ${provider}`);
    const startTime = Date.now();
    
    try {
      // OPTIMIZATION 1: Use the centralized index instead of scanning all keys
      const indexesResult = await storageManager.get('indexes', StaticNamespaces.AGENT_EVENT_INDEXES);
      if (indexesResult.success && indexesResult.data) {
        const allIndexes = indexesResult.data;
        
        // Find the appropriate namespace for this provider
        const namespaces = await storageManager.getNamespaces();
        let targetNamespace: StorageNamespaces | null = null;
        
        for (const [namespaceName, config] of namespaces) {
          if (config.category === NamespaceCategory.AGENT_SESSION_EVENTS && 
              namespaceName.includes(provider) && 
              !namespaceName.includes('processed')) {
            targetNamespace = namespaceName;
            break;
          }
        }
        
        if (!targetNamespace) {
          console.warn(`[AgentSessionArchiving] No raw events namespace found for provider '${provider}'`);
          return [];
        }
        
        // Get event keys from the index for this namespace
        const eventKeys = (allIndexes as any)[targetNamespace] || [];
        
        if (eventKeys.length === 0) {
          console.log(`[AgentSessionArchiving] No events in index for namespace ${targetNamespace}`);
          return [];
        }
        
        // OPTIMIZATION 2: Filter keys by sessionId BEFORE fetching
        // Key format is: event-{sessionId}-{timestamp}-{eventType}-{hash}
        const sessionEventKeys = eventKeys.filter((key: string) => {
          const parts = key.split('-');
          return parts.length >= 2 && parts[1] === sessionId;
        });
        
        if (sessionEventKeys.length === 0) {
          console.log(`[AgentSessionArchiving] No events found for session ${sessionId} in index`);
          return [];
        }
        
        console.log(`[AgentSessionArchiving] Found ${sessionEventKeys.length} events for session in index, batch fetching...`);
        
        // OPTIMIZATION 3: Batch fetch only the events we need
        const eventsResult = await storageManager.getMultiple(sessionEventKeys, targetNamespace);
        if (eventsResult.success && eventsResult.data) {
          for (const [key, event] of Object.entries(eventsResult.data)) {
            if (event) {
              rawEvents.push(event as AgentSessionEvent);
            }
          }
        }
        
      } else {
        // Fallback to old method if no index exists
        console.warn(`[AgentSessionArchiving] No index found, falling back to full scan`);
        return this.collectRawEventsLegacy(sessionId, provider);
      }
      
      // Sort by timestamp
      rawEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      const elapsed = Date.now() - startTime;
      console.log(`[AgentSessionArchiving] Collected ${rawEvents.length} raw events in ${elapsed}ms`);
      
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to collect raw events for session ${sessionId}:`, error);
    }
    
    return rawEvents;
  }

  /**
   * Legacy method for collecting raw events (fallback)
   */
  private async collectRawEventsLegacy(sessionId: string, provider: string): Promise<AgentSessionEvent[]> {
    const storageManager = await getTypedStorageManagerInstance();
    const rawEvents: AgentSessionEvent[] = [];
    
    try {
      // Find the appropriate raw events namespace
      const namespaces = await storageManager.getNamespaces();
      const rawNamespaces: StorageNamespaces[] = [];
      
      for (const [namespaceName, config] of namespaces) {
        if (config.category === NamespaceCategory.AGENT_SESSION_EVENTS && 
            namespaceName.includes(provider) && 
            !namespaceName.includes('processed')) {
          rawNamespaces.push(namespaceName);
        }
      }
      
      if (rawNamespaces.length === 0) {
        return [];
      }
      
      // Check all matching namespaces
      for (const rawNamespace of rawNamespaces) {
        const keys = await storageManager.keys(rawNamespace);
        if (keys.length === 0) continue;
        
        // Filter keys by sessionId
        const sessionKeys = keys.filter(key => key.includes(sessionId));
        
        if (sessionKeys.length > 0) {
          const eventsResult = await storageManager.getMultiple(sessionKeys, rawNamespace);
          if (eventsResult.success && eventsResult.data) {
            for (const [key, event] of Object.entries(eventsResult.data)) {
              rawEvents.push(event as AgentSessionEvent);
            }
          }
        }
      }
      
      // Sort by timestamp
      rawEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
    } catch (error) {
      console.error(`[AgentSessionArchiving] Legacy collection failed:`, error);
    }
    
    return rawEvents;
  }
  
  /**
   * Clean up raw events after archiving - OPTIMIZED VERSION
   */
  private async cleanupRawEvents(sessionId: string, provider: string): Promise<void> {
    const storageManager = await getTypedStorageManagerInstance();
    let totalDeleted = 0;
    const allDeletedKeys: Map<string, string[]> = new Map();
    const startTime = Date.now();
    
    try {
      // OPTIMIZATION: Use the centralized index to find keys to delete
      const indexesResult = await storageManager.get('indexes', StaticNamespaces.AGENT_EVENT_INDEXES);
      if (!indexesResult.success || !indexesResult.data) {
        console.warn(`[AgentSessionArchiving] No index found for cleanup, skipping`);
        return;
      }
      
      const allIndexes = indexesResult.data;
      
      // Find the appropriate namespace for this provider
      const namespaces = await storageManager.getNamespaces();
      let targetNamespace: StorageNamespaces | null = null;
      
      for (const [namespaceName, config] of namespaces) {
        if (config.category === NamespaceCategory.AGENT_SESSION_EVENTS && 
            namespaceName.includes(provider) && 
            !namespaceName.includes('processed')) {
          targetNamespace = namespaceName;
          break;
        }
      }
      
      if (!targetNamespace) {
        console.warn(`[AgentSessionArchiving] No raw events namespace found for cleanup (provider: ${provider})`);
        return;
      }
      
      // Get event keys from the index
      const eventKeys = (allIndexes as any)[targetNamespace] || [];
      if (eventKeys.length === 0) {
        console.log(`[AgentSessionArchiving] No events in index to clean up`);
        return;
      }
      
      // Filter for session-specific keys (format: event-{sessionId}-{timestamp}-{eventType}-{hash})
      const keysToDelete = eventKeys.filter((key: string) => {
        const parts = key.split('-');
        return parts.length >= 2 && parts[1] === sessionId;
      });
      
      if (keysToDelete.length === 0) {
        console.log(`[AgentSessionArchiving] No events found for session ${sessionId} to clean up`);
        return;
      }
      
      console.log(`[AgentSessionArchiving] Batch deleting ${keysToDelete.length} events from ${targetNamespace}`);
      
      // Batch delete all keys at once
      const deleteResult = await storageManager.deleteMultiple(keysToDelete, targetNamespace);
      
      if (deleteResult.success) {
        const { deleted, failed } = deleteResult.data as { deleted: string[]; failed: string[] };
        console.log(`[AgentSessionArchiving] Deleted ${deleted.length} events, ${failed.length} failed`);
        totalDeleted = deleted.length;
        
        // Track successfully deleted keys for index cleanup
        if (deleted.length > 0) {
          allDeletedKeys.set(targetNamespace, deleted);
        }
        
        if (failed.length > 0) {
          console.warn(`[AgentSessionArchiving] Failed to delete ${failed.length} events:`, failed.slice(0, 5));
        }
      }
      
      // Clean up the centralized index after successful deletions
      if (allDeletedKeys.size > 0) {
        await this.cleanupEventIndexes(allDeletedKeys);
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[AgentSessionArchiving] Cleaned up ${totalDeleted} raw events in ${elapsed}ms`);
      
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to cleanup raw events for session ${sessionId}:`, error);
    }
  }
  
  /**
   * Clean up event indexes after deleting events
   */
  private async cleanupEventIndexes(deletedKeysMap: Map<string, string[]>): Promise<void> {
    try {
      const storageManager = await getTypedStorageManagerInstance();
      
      // Get the current indexes from AGENT_EVENT_INDEXES
      const indexesResult = await storageManager.get('indexes', StaticNamespaces.AGENT_EVENT_INDEXES);
      if (!indexesResult.success || !indexesResult.data) {
        console.log('[AgentSessionArchiving] No indexes found to clean up');
        return;
      }
      
      const allIndexes = indexesResult.data;
      let indexesUpdated = false;
      
      // Process each namespace that had deletions
      for (const [namespace, deletedKeys] of deletedKeysMap) {
        // Type guard to ensure namespace is a valid key of AgentEventIndexes
        if (namespace !== AgentEventNamespaces.CLAUDE && 
            namespace !== AgentEventNamespaces.GEMINI && 
            namespace !== AgentEventNamespaces.OPENCODE) {
          continue;
        }
        
        const currentIndex = allIndexes[namespace];
        if (!currentIndex) {
          continue;
        }
        
        const deletedKeysSet = new Set(deletedKeys);
        
        // Filter out the deleted keys from the index
        const updatedIndex = currentIndex.filter(key => !deletedKeysSet.has(key));
        
        if (updatedIndex.length !== currentIndex.length) {
          console.log(`[AgentSessionArchiving] Removing ${currentIndex.length - updatedIndex.length} stale entries from ${namespace} index`);
          allIndexes[namespace] = updatedIndex;
          indexesUpdated = true;
        }
      }
      
      // Save the updated indexes if any changes were made
      if (indexesUpdated) {
        await storageManager.set('indexes', allIndexes, StaticNamespaces.AGENT_EVENT_INDEXES);
        console.log('[AgentSessionArchiving] Updated AGENT_EVENT_INDEXES after cleanup');
      }
      
    } catch (error) {
      console.error('[AgentSessionArchiving] Failed to cleanup event indexes:', error);
      // Don't throw - this is a cleanup optimization, not critical for archiving
    }
  }
  
  /**
   * Get archive configuration
   */
  private async getArchiveConfig(): Promise<ArchiveConfiguration> {
    try {
      const { archiveConfigService } = await import('../stores/ArchiveConfiguration');
      return await archiveConfigService.getConfiguration();
    } catch (error) {
      // Return default config if service not available
      console.error('[AgentSessionArchiving] Failed to get archive config:', error);
      throw error;
    }
  }
  
  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write JSON file with optimized formatting
   */
  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    try {
      // Use compact formatting for better performance
      const jsonString = JSON.stringify(data, null, 1);
      await fs.writeFile(filePath, jsonString, 'utf-8');
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to write JSON file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Write large JSON files using streaming approach to avoid memory issues
   */
  private async writeJsonFileStreaming(filePath: string, data: any[]): Promise<void> {
    try {
      const writeStream = require('fs').createWriteStream(filePath, { encoding: 'utf-8' });
      
      return new Promise((resolve, reject) => {
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        
        // Write array opening
        writeStream.write('[\n');
        
        // Write items in chunks to avoid memory pressure
        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          
          for (let j = 0; j < chunk.length; j++) {
            const item = chunk[j];
            const isLast = (i + j) === (data.length - 1);
            
            // Write item with minimal formatting
            writeStream.write(' ' + JSON.stringify(item));
            if (!isLast) {
              writeStream.write(',');
            }
            writeStream.write('\n');
          }
        }
        
        // Write array closing
        writeStream.write(']');
        writeStream.end();
      });
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to write streaming JSON file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract working directory from session data  
   */
  private extractWorkingDirectory(sessionData: any): string {
    // ProcessedSessionData has workingDirectory directly
    if (sessionData.workingDirectory) {
      return sessionData.workingDirectory;
    }
    // Fallback for old format with segments
    if (sessionData.segments) {
      for (const segment of sessionData.segments || []) {
        for (const event of segment.events || []) {
          if (event.workingDirectory) {
            return event.workingDirectory;
          }
        }
      }
    }
    return '';
  }

  /**
   * Count file accesses in session
   */
  private countFileAccesses(sessionData: any): number {
    let count = 0;
    // ProcessedSessionData has events array
    if (sessionData.events) {
      for (const event of sessionData.events) {
        if (event.type === 'file_read' || event.type === 'file_access') {
          count++;
        }
      }
    }
    // Fallback for old format with segments
    if (sessionData.segments) {
      for (const segment of sessionData.segments || []) {
        count += segment.counters?.fileAccesses || 0;
      }
    }
    return count;
  }

  /**
   * Count file writes in session
   */
  private countFileWrites(sessionData: any): number {
    let count = 0;
    // ProcessedSessionData has events array
    if (sessionData.events) {
      for (const event of sessionData.events) {
        if (event.type === 'file_write' || event.type === 'file_edit') {
          count++;
        }
      }
    }
    // Fallback for old format with segments
    if (sessionData.segments) {
      for (const segment of sessionData.segments || []) {
        count += segment.counters?.fileWrites || 0;
      }
    }
    return count;
  }

  /**
   * Count tool calls in session
   */
  private countToolCalls(sessionData: any): number {
    let count = 0;
    // ProcessedSessionData has events array
    if (sessionData.events) {
      for (const event of sessionData.events) {
        if (event.type === 'tool_use' || event.type === 'tool_call') {
          count++;
        }
      }
    }
    // Fallback for old format with segments
    if (sessionData.segments) {
      for (const segment of sessionData.segments || []) {
        count += segment.counters?.toolCalls || 0;
      }
    }
    return count;
  }

  /**
   * Get storage metrics for all session data
   */
  async getStorageMetrics(): Promise<StorageMetrics> {
    const metrics: StorageMetrics = {
      archiveFiles: {
        count: 0,
        totalSize: 0
      },
      processedEvents: {
        sessionCount: 0,
        totalSize: 0
      },
      rawEvents: {},
      summaries: {
        count: 0,
        totalSize: 0
      },
      totalStorageUsed: 0
    };

    try {
      // Get archive metrics (both directories and legacy files)
      const entries = await fs.readdir(this.archiveDir);
      let oldestTime = Infinity;
      let newestTime = 0;

      for (const entry of entries) {
        const entryPath = path.join(this.archiveDir, entry);
        const stats = await fs.stat(entryPath);
        
        if (stats.isDirectory()) {
          // Directory-based archive
          metrics.archiveFiles.count++;
          const dirSize = await this.getDirectorySize(entryPath);
          metrics.archiveFiles.totalSize += dirSize;
        } else if (entry.endsWith('.json')) {
          // Legacy single-file archive
          metrics.archiveFiles.count++;
          metrics.archiveFiles.totalSize += stats.size;
        } else {
          continue;
        }
        
        if (stats.mtime.getTime() < oldestTime) {
          oldestTime = stats.mtime.getTime();
          metrics.archiveFiles.oldestFile = stats.mtime;
        }
        if (stats.mtime.getTime() > newestTime) {
          newestTime = stats.mtime.getTime();
          metrics.archiveFiles.newestFile = stats.mtime;
        }
      }

      const storageManager = await getTypedStorageManagerInstance();

      // Get processed events metrics
      const processedKeys = await storageManager.keys(this.processedEventsNamespace);
      if (processedKeys) {
        metrics.processedEvents.sessionCount = processedKeys.length;
        // Estimate size based on average session size
        metrics.processedEvents.totalSize = processedKeys.length * 50000; // 50KB average
      }

      // Get summary metrics
      const summaryKeys = await storageManager.keys(this.summariesNamespace);
      if (summaryKeys) {
        metrics.summaries.count = summaryKeys.length;
        metrics.summaries.totalSize = summaryKeys.length * 1000; // 1KB average per summary
      }

      // Get raw events metrics per agent
      const namespaces = await storageManager.getNamespaces();
      for (const [namespaceName, config] of namespaces) {
        if (config.category === NamespaceCategory.AGENT_SESSION_EVENTS && 
            !namespaceName.includes('processed')) {
          const keysResult = await storageManager.keys(namespaceName);
          if (keysResult) {
            const eventCount = keysResult.filter((k: string) => k.startsWith('event-')).length;
            metrics.rawEvents[namespaceName] = {
              eventCount,
              totalSize: eventCount * 2000 // 2KB average per event
            };
          }
        }
      }

      // Calculate total
      metrics.totalStorageUsed = 
        metrics.archiveFiles.totalSize +
        metrics.processedEvents.totalSize +
        metrics.summaries.totalSize +
        Object.values(metrics.rawEvents).reduce((sum, agent) => sum + agent.totalSize, 0);

    } catch (error) {
      console.error('[AgentSessionArchiving] Failed to calculate storage metrics:', error);
    }

    return metrics;
  }

  /**
   * Cleanup sessions by age or directory
   */
  async cleanupSessions(options: {
    olderThanDays?: number;
    directory?: string;
    includeArchives?: boolean;
    includeProcessed?: boolean;
    includeRaw?: boolean;
  }): Promise<{ deletedCount: number; freedSpace: number }> {
    let deletedCount = 0;
    let freedSpace = 0;

    try {
      const now = Date.now();
      const ageThreshold = options.olderThanDays ? 
        options.olderThanDays * 24 * 60 * 60 * 1000 : 0;

      // Cleanup archives
      if (options.includeArchives !== false) {
        const entries = await fs.readdir(this.archiveDir);
        
        for (const entry of entries) {
          const entryPath = path.join(this.archiveDir, entry);
          const stats = await fs.stat(entryPath);
          
          let shouldDelete = false;
          
          // Check age
          if (ageThreshold && (now - stats.mtime.getTime() > ageThreshold)) {
            shouldDelete = true;
          }
          
          // Check directory if specified
          if (options.directory && shouldDelete) {
            let sessionWorkDir: string | null = null;
            
            if (stats.isDirectory()) {
              // Read metadata for directory-based archives
              const metadataPath = path.join(entryPath, 'metadata.json');
              if (await this.fileExists(metadataPath)) {
                const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                const metadata = JSON.parse(metadataContent);
                sessionWorkDir = metadata.workingDirectory;
              }
            } else if (entry.endsWith('.json')) {
              // Old single-file format
              const content = await fs.readFile(entryPath, 'utf-8');
              const data = JSON.parse(content);
              sessionWorkDir = this.extractWorkingDirectory(data);
            }
            
            if (sessionWorkDir !== options.directory) {
              shouldDelete = false;
            }
          }
          
          if (shouldDelete) {
            if (stats.isDirectory()) {
              const dirSize = await this.getDirectorySize(entryPath);
              await this.removeDirectory(entryPath);
              freedSpace += dirSize;
            } else {
              await fs.unlink(entryPath);
              freedSpace += stats.size;
            }
            deletedCount++;
          }
        }
      }

      const storageManager = await getTypedStorageManagerInstance();

      // Cleanup processed events
      if (options.includeProcessed) {
        const processedKeys = await storageManager.keys(this.processedEventsNamespace);
        if (processedKeys) {
          for (const key of processedKeys) {
            await storageManager.delete(key, this.processedEventsNamespace);
            deletedCount++;
            freedSpace += 50000; // Estimated
          }
        }
      }

      // Cleanup summaries
      const summaryKeys = await storageManager.keys(this.summariesNamespace);
      if (summaryKeys) {
        for (const key of summaryKeys) {
          const summary = await storageManager.get(key, this.summariesNamespace);
          if (summary.success && summary.data) {
            let shouldDelete = false;
            
            if (ageThreshold && (now - summary.data.lastUpdateTime > ageThreshold)) {
              shouldDelete = true;
            }
            
            if (options.directory && summary.data.workingDirectory !== options.directory) {
              shouldDelete = false;
            }
            
            if (shouldDelete) {
              await storageManager.delete(key, this.summariesNamespace);
              deletedCount++;
              freedSpace += 1000; // Estimated
            }
          }
        }
      }

    } catch (error) {
      console.error('[AgentSessionArchiving] Cleanup failed:', error);
    }

    return { deletedCount, freedSpace };
  }

  /**
   * Remove a directory recursively
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath);
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const stats = await fs.stat(entryPath);
        if (stats.isDirectory()) {
          await this.removeDirectory(entryPath);
        } else {
          await fs.unlink(entryPath);
        }
      }
      await fs.rmdir(dirPath);
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to remove directory ${dirPath}:`, error);
    }
  }
  
  /**
   * Get total size of a directory
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    try {
      const entries = await fs.readdir(dirPath);
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const stats = await fs.stat(entryPath);
        if (stats.isDirectory()) {
          totalSize += await this.getDirectorySize(entryPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to calculate directory size ${dirPath}:`, error);
    }
    return totalSize;
  }

  /**
   * List all archived sessions
   */
  async listArchivedSessions(): Promise<any[]> {
    const archivedSessions: any[] = [];
    
    try {
      await this.ensureArchiveDirectory();
      
      // Check if directory exists and has files
      try {
        const files = await fs.readdir(this.archiveDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const sessionId = file.replace('.json', '');
            const filePath = path.join(this.archiveDir, file);
            
            try {
              const stats = await fs.stat(filePath);
              const content = await fs.readFile(filePath, 'utf-8');
              const sessionData = JSON.parse(content);
              
              archivedSessions.push({
                sessionId,
                directory: sessionData.workingDirectory || sessionData.directory || '',
                archivedAt: stats.mtime.getTime(),
                reason: sessionData.archiveReason || 'Manual archive',
                eventCount: sessionData.totalEvents || sessionData.events?.length || 0,
                fileCount: Object.keys(sessionData.fileAccesses || {}).length,
                metadata: sessionData.metadata
              });
            } catch (error) {
              console.error(`[AgentSessionArchiving] Failed to read archived session ${sessionId}:`, error);
            }
          }
        }
        
        // Sort by archive date (newest first)
        archivedSessions.sort((a, b) => b.archivedAt - a.archivedAt);
      } catch (error) {
        // Directory doesn't exist or is empty - this is OK
        console.log('[AgentSessionArchiving] Archive directory is empty or not accessible');
      }
    } catch (error) {
      console.error('[AgentSessionArchiving] Failed to list archived sessions:', error);
    }
    
    return archivedSessions;
  }

  /**
   * Delete an archived session
   */
  async deleteArchivedSession(sessionId: string): Promise<void> {
    try {
      const archivePath = path.join(this.archiveDir, `${sessionId}.json`);
      
      // Check if file exists
      if (await this.fileExists(archivePath)) {
        await fs.unlink(archivePath);
        console.log(`[AgentSessionArchiving] Deleted archived session ${sessionId}`);
      } else {
        throw new Error(`Archived session ${sessionId} not found`);
      }
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to delete archived session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Restore an archived session to active (move from archive back to active storage)
   */
  async restoreArchivedSession(sessionId: string): Promise<void> {
    try {
      // Load the archived session
      const archivedData = await this.loadArchivedSession(sessionId);
      
      if (!archivedData || !archivedData.session) {
        throw new Error(`Archived session ${sessionId} not found`);
      }
      
      // Get storage manager
      const storageManager = await getTypedStorageManagerInstance();
      
      // Restore to processed events storage
      const provider = archivedData.session.provider || 'claude-ai';
      await storageManager.set(
        this.processedEventsNamespace,
        `${provider}:${sessionId}`,
        archivedData.session
      );
      
      // Restore raw events if they exist
      if (archivedData.rawEvents && archivedData.rawEvents.length > 0) {
        // Find the appropriate namespace for this provider
        const namespaces = await storageManager.getNamespaces();
        let targetNamespace: string | undefined;
        
        for (const [namespaceName, config] of namespaces) {
          if (config.category === NamespaceCategory.AGENT_SESSION_EVENTS && 
              namespaceName.includes(provider) && 
              !namespaceName.includes('processed')) {
            targetNamespace = namespaceName;
            break;
          }
        }
        
        if (targetNamespace) {
          // Get existing events for this session
          const existingResult = await storageManager.get(sessionId, targetNamespace as StorageNamespaces);
          const existingEvents = existingResult.success && Array.isArray(existingResult.data) ? existingResult.data : [];
          
          // Combine with restored events
          const allEvents = [...existingEvents, ...archivedData.rawEvents];
          
          // Save all events
          await storageManager.set(sessionId, allEvents, targetNamespace as StorageNamespaces);
        }
      }
      
      // Delete the archived file
      await this.deleteArchivedSession(sessionId);
      
      console.log(`[AgentSessionArchiving] Restored session ${sessionId} from archive`);
    } catch (error) {
      console.error(`[AgentSessionArchiving] Failed to restore archived session ${sessionId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const agentSessionArchivingService = new AgentSessionArchivingService();