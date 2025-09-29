/**
 * Backend adapter for the centralized event processor
 */

import {
  sessionEventProcessor,
  SessionState,
} from '../../shared/event-processing/SessionEventProcessor';
import { AgentSessionRecord } from '../../shared/sessionTypes';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';

/**
 * Convert stored session to processor state
 */
export function sessionRecordToState(record: AgentSessionRecord): SessionState {
  return {
    sessionId: record.sessionId,
    workingDirectory: record.workingDirectory,
    firstAccess: record.firstAccess,
    lastActivity: record.lastActivity,
    eventCount: record.eventCount || 0,
    isActive: !record.lastStopTime,

    // These might be undefined in old sessions - initialize them
    fileAccessCount: record.fileAccesses
      ? Object.keys(record.fileAccesses).length
      : 0,
    fileWriteCount: record.fileWrites
      ? Object.keys(record.fileWrites).length
      : 0,
    fileAccesses: record.fileAccesses || {},
    fileWrites: record.fileWrites || {},

    toolCallCount: record.toolCalls?.length || 0,
    toolCalls: record.toolCalls,

    webAccessCount: record.webAccesses?.length || 0,
    webAccesses: record.webAccesses,

    // File path arrays for UI display and map visualization
    filesRead: Object.keys(record.fileAccesses || {}),
    filesWritten: Object.keys(record.fileWrites || {}),

    bashCommands: record.bashCommands || [],

    lastEvent: record.lastEvent,
    metadata: record.metadata,
    customName:
      typeof record.metadata?.customName === 'string'
        ? record.metadata.customName
        : undefined,
  };
}

/**
 * Apply processor state back to storage record
 */
export function updateRecordFromState(
  record: AgentSessionRecord,
  state: Partial<SessionState>,
): AgentSessionRecord {
  const updated = { ...record };

  // Update counts and arrays
  if (state.fileAccesses !== undefined) {
    updated.fileAccesses = state.fileAccesses as any; // Cast to match AgentSessionRecord type
  }
  if (state.fileWrites !== undefined) {
    updated.fileWrites = state.fileWrites as any; // Cast to match AgentSessionRecord type
  }
  if (state.toolCalls !== undefined) {
    updated.toolCalls = state.toolCalls as any; // Cast to match AgentSessionRecord type
  }
  if (state.webAccesses !== undefined) {
    updated.webAccesses = state.webAccesses as any; // Cast to match AgentSessionRecord type
  }
  if (state.bashCommands !== undefined) {
    updated.bashCommands = state.bashCommands;
  }

  // Update metadata
  if (state.lastActivity !== undefined) {
    updated.lastActivity = state.lastActivity;
  }
  if (state.eventCount !== undefined) {
    updated.eventCount = state.eventCount;
  }
  if (state.lastEvent !== undefined) {
    updated.lastEvent = state.lastEvent;
  }
  if (state.metadata !== undefined) {
    updated.metadata = { ...updated.metadata, ...state.metadata };
  }
  if (state.customName !== undefined) {
    if (!updated.metadata) updated.metadata = {};
    updated.metadata.customName = state.customName;
  }

  return updated;
}

/**
 * Process an event for a session in storage
 */
export async function processEventForSession(
  getSession: (sessionId: string) => Promise<AgentSessionRecord | null>,
  saveSession: (session: AgentSessionRecord) => Promise<void>,
  event: RepoNormalizedUniversalAgentSessionEvent,
): Promise<void> {
  if (!event.sessionId) return;

  // Get or create session
  let session = await getSession(event.sessionId);
  if (!session) {
    // Initialize new session
    const initialState = sessionEventProcessor.initializeSession(
      event.sessionId,
      event.workingDirectory || '',
    );

    session = {
      sessionId: event.sessionId,
      workingDirectory: event.workingDirectory || '',
      firstAccess: Date.now(),
      lastActivity: Date.now(),
      reviewedLastStop: false,
      fileAccesses: {},
      fileWrites: {},
      eventCount: 0,
    };
  }

  // Convert to processor state
  const currentState = sessionRecordToState(session);

  // Process the event
  const result = sessionEventProcessor.processEvent(event, currentState);

  // Apply updates back to record
  const updatedSession = updateRecordFromState(session, result.session);

  // Save updated session
  await saveSession(updatedSession);

  // Handle side effects if needed
  if (result.sideEffects) {
    // Log for now - can be extended to trigger actual side effects
    console.log('[SessionEventProcessor] Side effects:', result.sideEffects);
  }
}
