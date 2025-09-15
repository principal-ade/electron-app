import { ipcRenderer } from 'electron';
import { type AgentSessionEventsAPI, AgentSessionEventsAPIEvent } from '../../shared/main-process-api-interfaces/AgentSessionEventsAPI';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";

// Event types for real-time updates
export type SessionEventType = 'session-created' | 'session-updated' | 'session-stopped' | 'event-processed';

export interface SessionEventUpdate {
  type: SessionEventType;
  sessionId: string;
  workingDirectory: string;
  event?: NormalizedAgentSessionEvent;
  timestamp: number;
}

// Extend the existing API with watching capabilities
class AgentSessionEventsAPIExtended implements AgentSessionEventsAPI {
  private eventListeners: Map<string, Set<(update: SessionEventUpdate) => void>> = new Map();
  
  constructor() {
    // Listen for real-time session events from main process
    ipcRenderer.on('session-event-update', (_event, update: SessionEventUpdate) => {
      this.notifyListeners(update);
    });
  }
  
  // Existing API methods
  subscribe = (provider?: string) => 
    ipcRenderer.invoke(AgentSessionEventsAPIEvent.SUBSCRIBE, provider);
  
  getRecentEvents = (provider?: string) => 
    ipcRenderer.invoke(AgentSessionEventsAPIEvent.GET_RECENT_EVENTS, provider);
  
  getSessionEvents = (sessionId: string) =>
    ipcRenderer.invoke(AgentSessionEventsAPIEvent.GET_SESSION_EVENTS, sessionId);
  
  clearEvents = (provider?: string) => 
    ipcRenderer.invoke(AgentSessionEventsAPIEvent.CLEAR_EVENTS, provider);
  
  reprocessAllEvents = () => 
    ipcRenderer.invoke(AgentSessionEventsAPIEvent.REPROCESS_ALL_EVENTS);
  
  reprocessSessionEvents = (sessionId: string) =>
    ipcRenderer.invoke(AgentSessionEventsAPIEvent.REPROCESS_SESSION_EVENTS, sessionId);
    
  processFallbackFile = (filePath: string, cli: string) =>
    ipcRenderer.invoke('agent-session-events:process-fallback-file', filePath, cli);
  
  // New watching methods
  
  /**
   * Watch for real-time session events for a directory
   */
  watchSessionEvents(
    directory: string,
    callback: (update: SessionEventUpdate) => void
  ): () => void {
    if (!this.eventListeners.has(directory)) {
      this.eventListeners.set(directory, new Set());
      // Tell main process we want real-time updates for this directory
      ipcRenderer.send('watch-session-events', directory);
    }
    
    this.eventListeners.get(directory)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(directory);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(directory);
          ipcRenderer.send('unwatch-session-events', directory);
        }
      }
    };
  }
  
  /**
   * Get live session statistics
   */
  async getSessionStats(sessionId: string): Promise<{
    fileReadCount: number;
    fileWriteCount: number;
    toolCallCount: number;
    webAccessCount: number;
    lastActivity: number;
    isActive: boolean;
    currentTool?: string;
    currentFile?: string;
  }> {
    return ipcRenderer.invoke('get-session-stats', sessionId);
  }
  
  private notifyListeners(update: SessionEventUpdate) {
    // Notify directory-specific listeners
    const listeners = this.eventListeners.get(update.workingDirectory);
    if (listeners) {
      listeners.forEach(callback => callback(update));
    }
    
    // Also notify listeners watching parent directories
    for (const [dir, dirListeners] of this.eventListeners) {
      if (update.workingDirectory.startsWith(dir) && dir !== update.workingDirectory) {
        dirListeners.forEach(callback => callback(update));
      }
    }
  }
}

export const agentSessionEventsAPI = new AgentSessionEventsAPIExtended();