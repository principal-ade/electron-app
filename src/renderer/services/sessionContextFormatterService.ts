import { AgentSessionRecord } from '../../shared/sessionTypes';

export interface SessionContextInfo {
  sessionId: string;
  sessionName: string;
  fileAccesses: string[];
  fileWrites: string[];
  summary?: string;
}

export class SessionContextFormatterService {
  /**
   * Formats session information into a system prompt for AI conversations
   */
  static formatSessionContextPrompt(
    session: AgentSessionRecord,
    workingDirectory: string,
  ): string {
    const sessionName =
      session.metadata?.customName ||
      `Session ${session.sessionId.substring(0, 8)}`;

    const fileAccesses = Object.keys(session.fileAccesses || {});
    const fileWrites = Object.keys(session.fileWrites || {});

    let prompt = `You are currently in a conversation with context from an agent session.\n\n`;
    prompt += `**Session Context:**\n`;
    prompt += `- Session: ${sessionName}\n`;
    prompt += `- Working Directory: ${workingDirectory}\n`;
    prompt += `- Session ID: ${session.sessionId}\n\n`;

    // Analysis removed - deprecated feature

    if (fileAccesses.length > 0) {
      prompt += `**Files Accessed in this Session:**\n`;
      fileAccesses.forEach((file) => {
        // Make paths relative to working directory for brevity
        const relativePath = file.startsWith(workingDirectory)
          ? file.substring(workingDirectory.length + 1)
          : file;
        prompt += `- ${relativePath}\n`;
      });
      prompt += '\n';
    }

    if (fileWrites.length > 0) {
      prompt += `**Files Modified in this Session:**\n`;
      fileWrites.forEach((file) => {
        const relativePath = file.startsWith(workingDirectory)
          ? file.substring(workingDirectory.length + 1)
          : file;
        const writes = session.fileWrites[file];
        const operations = writes
          .map((w) => w.operation)
          .filter((op, idx, arr) => arr.indexOf(op) === idx);
        prompt += `- ${relativePath} (${operations.join(', ')})\n`;
      });
      prompt += '\n';
    }

    prompt += `The user wants to discuss this session. You have access to the files and context from this session. `;
    prompt += `Please provide helpful insights and answer questions about the work done in this session.`;

    return prompt;
  }

  /**
   * Formats multiple sessions into a combined context prompt
   */
  static formatMultipleSessionsContext(
    sessions: AgentSessionRecord[],
    workingDirectory: string,
  ): string {
    if (sessions.length === 0) {
      return '';
    }

    let prompt = `You are currently in a conversation with context from ${sessions.length} agent sessions.\n\n`;
    prompt += `**Working Directory:** ${workingDirectory}\n\n`;

    sessions.forEach((session, index) => {
      const sessionName =
        session.metadata?.customName ||
        `Session ${session.sessionId.substring(0, 8)}`;

      prompt += `**Session ${index + 1}: ${sessionName}**\n`;

      // Analysis removed - deprecated feature

      const fileAccesses = Object.keys(session.fileAccesses || {}).length;
      const fileWrites = Object.keys(session.fileWrites || {}).length;

      prompt += `- Files accessed: ${fileAccesses}\n`;
      prompt += `- Files modified: ${fileWrites}\n\n`;
    });

    prompt += `The user wants to discuss these sessions. You have access to the context from all selected sessions. `;
    prompt += `Please provide helpful insights and answer questions about the work done across these sessions.`;

    return prompt;
  }

  /**
   * Formats a general workspace context prompt (no specific session)
   */
  static formatGeneralWorkspacePrompt(workingDirectory: string): string {
    const projectName = workingDirectory.split('/').pop() || 'the project';

    return (
      `You are having a general conversation about the codebase in ${projectName}.\n\n` +
      `**Working Directory:** ${workingDirectory}\n\n` +
      `This is a general conversation without any specific session context. ` +
      `You can help with questions about the codebase structure, architecture, or general development topics.`
    );
  }

  /**
   * Creates a user-friendly message to show the context state
   */
  static getUserContextMessage(
    hasSession: boolean,
    sessionName?: string,
    additionalContext?: { files?: number; sessions?: number },
  ): string {
    if (!hasSession) {
      return '💬 General conversation mode - Ask anything about your codebase';
    }

    let message = `📎 Session context loaded: ${sessionName}`;

    if (additionalContext) {
      const parts = [];
      if (additionalContext.sessions && additionalContext.sessions > 1) {
        parts.push(`${additionalContext.sessions} sessions`);
      }
      if (additionalContext.files && additionalContext.files > 0) {
        parts.push(`${additionalContext.files} files`);
      }

      if (parts.length > 0) {
        message += ` (${parts.join(', ')})`;
      }
    }

    return message;
  }
}
