/**
 * Service layer for Agent Session Events functionality
 * ALL window.mainProcess.agentSessionEvents calls MUST be encapsulated here
 */

import type { 
  AgentSessionEvent, 
  AgentSessionEventsSubscribeResult,
  AgentSessionEventsClearResult 
} from '../../shared/main-process-api-interfaces/AgentSessionEventsAPI';

export class AgentSessionEventsService {
  /**
   * Subscribe to session events
   */
  static async subscribe(provider?: string): Promise<AgentSessionEventsSubscribeResult> {
    return window.mainProcess.agentSessionEvents.subscribe(provider);
  }

  /**
   * Clear stored events
   */
  static async clearEvents(provider?: string): Promise<AgentSessionEventsClearResult> {
    return window.mainProcess.agentSessionEvents.clearEvents(provider);
  }

  /**
   * Get session events
   */
  static async getSessionEvents(sessionId: string): Promise<AgentSessionEvent[]> {
    return window.mainProcess.agentSessionEvents.getSessionEvents(sessionId);
  }

  /**
   * Reprocess session events
   */
  static async reprocessSessionEvents(sessionId: string): Promise<{ success: boolean; processedCount?: number; error?: string }> {
    return window.mainProcess.agentSessionEvents.reprocessSessionEvents(sessionId);
  }

  /**
   * Reprocess all events
   */
  static async reprocessAllEvents(): Promise<{ success: boolean; processedCount?: number; error?: string }> {
    return window.mainProcess.agentSessionEvents.reprocessAllEvents();
  }

  /**
   * Get recent events from CLI providers
   */
  static async getRecentEvents(provider?: string): Promise<AgentSessionEvent[]> {
    return window.mainProcess.agentSessionEvents.getRecentEvents(provider);
  }

  /**
   * Process a fallback file
   */
  static async processFallbackFile(filePath: string, cli: string): Promise<{
    success: boolean;
    storedCount?: number;
    processedCount?: number;
    error?: string;
  }> {
    return window.mainProcess.agentSessionEvents.processFallbackFile(filePath, cli);
  }
}