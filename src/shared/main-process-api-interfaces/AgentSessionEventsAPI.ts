import { SupportedAgent } from "@principal-ai/agent-monitoring";

export interface AgentSessionEvent {
  provider: SupportedAgent;
  timestamp: number;
  sessionId?: string;
  workingDirectory?: string;
  eventType?: string;
  data: unknown; // Raw event data from various providers
}

export interface AgentSessionEventsSubscribeResult {
  success: boolean;
  port?: number;
}

export interface AgentSessionEventsClearResult {
  success: boolean;
}

export enum AgentSessionEventsAPIEvent {
  SUBSCRIBE = 'agent-session-events:subscribe',
  GET_RECENT_EVENTS = 'agent-session-events:get-recent-events',
  GET_SESSION_EVENTS = 'agent-session-events:get-session-events',
  CLEAR_EVENTS = 'agent-session-events:clear-events',
  REPROCESS_ALL_EVENTS = 'agent-session-events:reprocess-all',
  REPROCESS_SESSION_EVENTS = 'agent-session-events:reprocess-session',
}

export interface AgentSessionEventsAPI {
  /**
   * Subscribe to events from CLI providers
   * @param provider - Optional provider name to filter events ('claude' | 'gemini' | 'opencode')
   * @returns Promise with success status and port number
   */
  subscribe: (provider?: string) => Promise<AgentSessionEventsSubscribeResult>;

  /**
   * Get recent events from CLI providers
   * @param provider - Optional provider name to filter events
   * @returns Promise with array of CLI provider events
   */
  getRecentEvents: (provider?: string) => Promise<AgentSessionEvent[]>;

  /**
   * Get events for a specific session
   * @param sessionId - The session ID to get events for
   * @returns Promise with array of events for that session
   */
  getSessionEvents: (sessionId: string) => Promise<AgentSessionEvent[]>;

  /**
   * Clear stored events
   * @param provider - Optional provider name to clear events for, or all if not specified
   * @returns Promise with success status
   */
  clearEvents: (provider?: string) => Promise<AgentSessionEventsClearResult>;

  /**
   * Reprocess all raw events to regenerate processed events
   * @returns Promise with success status
   */
  reprocessAllEvents: () => Promise<{ success: boolean; processedCount?: number; error?: string }>;
  
  /**
   * Reprocess raw events for a specific session
   * @param sessionId - The session ID to reprocess events for
   * @returns Promise with success status and count
   */
  reprocessSessionEvents: (sessionId: string) => Promise<{ success: boolean; processedCount?: number; error?: string }>;
  
  /**
   * Process a specific hook fallback file
   * @param filePath - Path to the fallback file
   * @param cli - The CLI agent name (claude, gemini, opencode)
   * @returns Promise with success status and counts
   */
  processFallbackFile: (filePath: string, cli: string) => Promise<{ 
    success: boolean; 
    processedCount?: number; 
    storedCount?: number;
    error?: string;
  }>;
}