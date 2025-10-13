/**
 * UI-specific session data types
 * These types extend the API types with additional fields needed for UI display
 */

import { AgentSessionRecord } from '../../shared/sessionTypes';
import { EventActivityType } from '../../shared/sessionEnums';

/**
 * Generic UI session data for active sessions
 * Extends the base session record with UI-specific fields
 */
export interface UIAgentSessionData extends Partial<AgentSessionRecord> {
  // Required core fields
  sessionId: string;
  directory: string;
  workingDirectory: string;
  lastActivity: number;
  firstAccess: number;
  isActive: boolean;

  // Optional metadata
  customName?: string;
  metadata?: Record<string, unknown>;

  // Last action/event tracking
  lastAction?: {
    tool: string;
    filename: string;
    timestamp: number;
    filePath?: string;
    normalizedPath?: string;
  };
  lastEvent: {
    type: EventActivityType;
    fileName?: string;
    timestamp: number;
  };

  // Statistics
  fileAccessCount?: number;
  fileWriteCount?: number;
  toolCallCount?: number;
  webAccessCount?: number;
  eventCount?: number;
}

/**
 * Enhanced session data with computed UI status
 * Used when we need to display session status in the UI
 */
export interface EnhancedUIAgentSessionData extends UIAgentSessionData {
  status: 'active' | 'idle' | 'waiting' | 'inactive' | 'stopped';
  statusColor: string;
  statusText: string;
}
