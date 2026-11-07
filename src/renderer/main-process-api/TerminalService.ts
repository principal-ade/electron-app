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
  onTerminalEvent,
  onActivitySync,
  onProgramStatus,
  onCwdChange,
} from '../tipc/terminalClient';
import type {
  TerminalInfo,
  TerminalOwnershipStatus,
  TerminalOwnershipResult,
  RequestDataPortResult,
  TerminalSessionMetadata,
  TerminalDaemonUpdateEvent,
} from '../../shared/main-process-api-interfaces/TerminalService';
import type {
  TerminalActivityState,
  UpdateActivityInput,
  TerminalSessionInfo,
  DaemonStatusResponse,
  ProgramStatusRecord,
} from '../tipc/terminalClient';
import type {
  DaemonControlResult,
  GetTerminalBufferInput,
  GetTerminalBufferResult,
} from '../../shared/tipc/terminalRouterTypes';

export type {
  DaemonStatusResponse,
  ProgramStatusRecord,
  TerminalActivityState,
  TerminalSessionInfo,
  UpdateActivityInput,
} from '../tipc/terminalClient';

export class TerminalService {
  static listSessions(): Promise<TerminalSessionInfo[]> {
    return terminalClient.listTerminalSessions();
  }

  static getActivityState(): Promise<TerminalActivityState[]> {
    return terminalClient.getActivityState();
  }

  static onActivitySync(
    callback: (activities: TerminalActivityState[]) => void,
  ): () => void {
    return onActivitySync(callback);
  }

  static getDaemonStatus(): Promise<DaemonStatusResponse> {
    return terminalClient.getDaemonStatus();
  }

  static startDaemon(): Promise<DaemonControlResult> {
    return terminalClient.startDaemon();
  }

  static stopDaemon(): Promise<DaemonControlResult> {
    return terminalClient.stopDaemon();
  }

  static getAllProgramStatus(): Promise<Record<string, ProgramStatusRecord[]>> {
    return terminalClient.getAllProgramStatus();
  }

  static onProgramStatus(
    callback: (event: {
      sessionId: string;
      records: ProgramStatusRecord[];
    }) => void,
  ): () => void {
    return onProgramStatus(callback);
  }

  static onCwdChange(
    callback: (event: { sessionId: string; cwd: string }) => void,
  ): () => void {
    return onCwdChange(callback);
  }

  static getTerminalBuffer(
    input: GetTerminalBufferInput,
  ): Promise<GetTerminalBufferResult> {
    return terminalClient.getTerminalBuffer(input);
  }

  static updateActivity(input: UpdateActivityInput): Promise<void> {
    return terminalClient.updateActivity(input);
  }

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
      cols: s.cols,
      rows: s.rows,
      status: (s.status as 'active' | 'disconnected') || 'active',
      ownedByWindowId: s.ownedByWindowId,
      metadata: s.metadata,
    }));
  }

  static async getOrCreate(
    dir: string,
    context?: string,
    metadata?: TerminalSessionMetadata,
  ): Promise<string> {
    // For TIPC, we use createTerminalSession which handles creation
    // The session manager will reuse existing sessions based on context
    return terminalClient.createTerminalSession({
      cwd: dir,
      context,
      metadata,
    });
  }

  static async createWithCommand(
    dir: string,
    command: string,
    context?: string,
    metadata?: TerminalSessionMetadata,
  ): Promise<string> {
    return terminalClient.createTerminalSession({
      cwd: dir,
      command,
      context,
      metadata,
    });
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
   * Subscribe to sessions restored from the PTY daemon after an app restart.
   * Fired once per reconnect, after the daemon reports the sessions it kept
   * alive — later than the initial session list, so callers re-list.
   */
  static onSessionsRestored(
    callback: (payload: { sessions: unknown[] }) => void,
  ): () => void {
    return onTerminalEvent('terminal:sessionsRestored', callback);
  }

  /**
   * Subscribe to progress of replacing an outdated PTY daemon. Fired once per
   * phase ('updating', then 'updated' or 'failed').
   */
  static onDaemonUpdate(
    callback: (event: TerminalDaemonUpdateEvent) => void,
  ): () => void {
    return onTerminalEvent('terminal:daemon-update', callback);
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
        cols: s.cols,
        rows: s.rows,
        status: (s.status as 'active' | 'disconnected') || 'active',
        ownedByWindowId: s.ownedByWindowId,
        metadata: s.metadata,
      }));
      callback(mapped);
    });
  }
}
