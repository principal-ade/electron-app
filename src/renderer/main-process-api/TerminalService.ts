/**
 * Terminal Service using TIPC
 *
 * This service uses TIPC for type-safe RPC to the main process,
 * matching the terminal-testing-app implementation.
 */

import {
  terminalClient,
  onTerminalData,
  onOwnershipLost,
  writeToTerminalPort,
  onPortReady,
  onSessionsChanged,
} from '../tipc/terminalClient';
import type {
  TerminalInfo,
  TerminalOwnershipStatus,
  TerminalOwnershipResult,
  RequestDataPortResult,
  TerminalSessionMetadata,
} from '../../shared/main-process-api-interfaces/TerminalService';

export class TerminalService {
  static async list(): Promise<TerminalInfo[]> {
    const sessions = await terminalClient.listTerminalSessions();
    // Map to TerminalInfo format
    return sessions.map((s) => ({
      id: s.id,
      directory: s.directory || s.cwd || '',
      context: s.context,
      agentSessionId: s.agentSessionId,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
      status: (s.status as 'active' | 'disconnected') || 'active',
      ownedByWindowId: s.ownedByWindowId,
      metadata: s.metadata,
    }));
  }

  static async create(
    dir: string,
    context?: string,
    metadata?: TerminalSessionMetadata,
  ): Promise<string> {
    return terminalClient.createTerminalSession({ cwd: dir, context, metadata });
  }

  static async getOrCreate(
    dir: string,
    context?: string,
    metadata?: TerminalSessionMetadata,
  ): Promise<string> {
    // For TIPC, we use createTerminalSession which handles creation
    // The session manager will reuse existing sessions based on context
    return terminalClient.createTerminalSession({ cwd: dir, context, metadata });
  }

  static async createWithCommand(
    dir: string,
    command: string,
    context?: string,
    metadata?: TerminalSessionMetadata,
  ): Promise<string> {
    return terminalClient.createTerminalSession({ cwd: dir, command, context, metadata });
  }

  static async destroy(id: string): Promise<void> {
    return terminalClient.destroyTerminalSession({ sessionId: id });
  }

  static write(id: string, data: string): void {
    writeToTerminalPort(id, data);
  }

  /**
   * Subscribe to terminal data for a specific session.
   * Uses preload's MessagePort abstraction (matches testing app).
   */
  static onDataForSession(
    sessionId: string,
    callback: (data: string) => void,
  ): () => void {
    return onTerminalData(sessionId, callback);
  }

  static async onExit(
    _callback: (exit: { sessionId: string; code: number }) => void,
  ): Promise<() => void> {
    // Exit events come through the MessagePort as EXIT type messages
    // For now, return a no-op since exit is handled by port onmessage
    return () => {};
  }

  static async resize(
    id: string,
    cols: number,
    rows: number,
    force?: boolean,
  ): Promise<void> {
    return terminalClient.resizeTerminal({ sessionId: id, cols, rows, force });
  }

  static async refresh(id: string): Promise<boolean> {
    const result = await terminalClient.refreshTerminal({ sessionId: id });
    return result.success;
  }

  static async checkOwnership(
    sessionId: string,
  ): Promise<TerminalOwnershipStatus> {
    return terminalClient.checkTerminalOwnership({ sessionId });
  }

  static async claimOwnership(
    sessionId: string,
    force?: boolean,
  ): Promise<TerminalOwnershipResult> {
    return terminalClient.claimTerminalOwnership({ sessionId, force });
  }

  static async releaseOwnership(
    sessionId: string,
  ): Promise<TerminalOwnershipResult> {
    return terminalClient.releaseTerminalOwnership({ sessionId });
  }

  /**
   * Subscribe to ownership lost events.
   * Uses preload's subscription (matches testing app).
   */
  static onOwnershipLost(
    callback: (data: { sessionId: string; newOwnerWindowId: number }) => void,
  ): () => void {
    return onOwnershipLost(callback);
  }

  /**
   * Request a MessagePort for receiving terminal data directly.
   * This creates a MessageChannel in the main process and sends the port.
   */
  static async requestDataPort(
    sessionId: string,
  ): Promise<RequestDataPortResult> {
    return terminalClient.requestTerminalDataPort({ sessionId });
  }

  /**
   * Listen for MessagePort delivery.
   * Allows components to receive the MessagePort directly for optimal performance.
   */
  static onPortReady(
    callback: (
      data: { sessionId: string; writable: boolean },
      port: MessagePort,
    ) => void,
  ): () => void {
    return onPortReady(callback);
  }

  /**
   * Subscribe to terminal sessions changed events.
   * Called when sessions are created or destroyed in any window.
   */
  static onSessionsChanged(
    callback: (sessions: TerminalInfo[]) => void,
  ): () => void {
    return onSessionsChanged((sessions) => {
      // Map to TerminalInfo format for consistency
      const mapped: TerminalInfo[] = sessions.map((s) => ({
        id: s.id,
        directory: s.directory || s.cwd || '',
        context: s.context,
        agentSessionId: s.agentSessionId,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        status: (s.status as 'active' | 'disconnected') || 'active',
        ownedByWindowId: s.ownedByWindowId,
        metadata: s.metadata,
      }));
      callback(mapped);
    });
  }
}
