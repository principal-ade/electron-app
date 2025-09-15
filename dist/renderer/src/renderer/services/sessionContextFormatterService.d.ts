import { AgentSessionRecord } from '../../shared/sessionTypes';
export interface SessionContextInfo {
    sessionId: string;
    sessionName: string;
    fileAccesses: string[];
    fileWrites: string[];
    summary?: string;
}
export declare class SessionContextFormatterService {
    /**
     * Formats session information into a system prompt for AI conversations
     */
    static formatSessionContextPrompt(session: AgentSessionRecord, workingDirectory: string): string;
    /**
     * Formats multiple sessions into a combined context prompt
     */
    static formatMultipleSessionsContext(sessions: AgentSessionRecord[], workingDirectory: string): string;
    /**
     * Formats a general workspace context prompt (no specific session)
     */
    static formatGeneralWorkspacePrompt(workingDirectory: string): string;
    /**
     * Creates a user-friendly message to show the context state
     */
    static getUserContextMessage(hasSession: boolean, sessionName?: string, additionalContext?: {
        files?: number;
        sessions?: number;
    }): string;
}
//# sourceMappingURL=sessionContextFormatterService.d.ts.map