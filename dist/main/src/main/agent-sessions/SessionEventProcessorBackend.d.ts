/**
 * Backend adapter for the centralized event processor
 */
import { SessionState } from '../../shared/event-processing/SessionEventProcessor';
import { AgentSessionRecord } from '../../shared/sessionTypes';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
/**
 * Convert stored session to processor state
 */
export declare function sessionRecordToState(record: AgentSessionRecord): SessionState;
/**
 * Apply processor state back to storage record
 */
export declare function updateRecordFromState(record: AgentSessionRecord, state: Partial<SessionState>): AgentSessionRecord;
/**
 * Process an event for a session in storage
 */
export declare function processEventForSession(getSession: (sessionId: string) => Promise<AgentSessionRecord | null>, saveSession: (session: AgentSessionRecord) => Promise<void>, event: NormalizedAgentSessionEvent): Promise<void>;
//# sourceMappingURL=SessionEventProcessorBackend.d.ts.map