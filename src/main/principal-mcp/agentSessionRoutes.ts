import { randomUUID } from 'crypto';
import path from 'path';
import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import type { Application, Request, Response } from 'express';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import type { OpenTerminalTabPayload } from '../../shared/main-process-api-interfaces/WindowAPI';
import type { OpenCodeSessionSummary } from '../../shared/main-process-api-interfaces/OpenCodeSessionHistoryAPI';
import type { ClaudeSessionSummary } from '../../shared/main-process-api-interfaces/ClaudeSessionHistoryAPI';
import type { CursorSessionSummary } from '../../shared/main-process-api-interfaces/CursorSessionHistoryAPI';
import type {
  CodingAgentId,
  TerminalStartupNotice,
} from '../../shared/agentSessionTypes';
import { openCodeSessionHistoryService } from '../opencode/OpenCodeSessionHistoryService';
import { claudeSessionHistoryService } from '../agent-history/ClaudeSessionHistoryService';
import { cursorSessionHistoryService } from '../agent-history/CursorSessionHistoryService';

export type CodingAgent = CodingAgentId;

export type AgentSessionSummary =
  | (OpenCodeSessionSummary & { agent: 'opencode'; resumable: true })
  | (ClaudeSessionSummary & { agent: 'claude'; resumable: true })
  | (CursorSessionSummary & { agent: 'cursor' });

export interface AgentSessionResumeTarget {
  directory: string;
  label: string;
  customLabel?: string;
  agent: CodingAgent;
  startupNotice: TerminalStartupNotice;
  command: string;
}

export interface AgentSessionProvider {
  list(
    repositoryDirectories: string[],
    query?: string,
    directory?: string,
  ): Promise<AgentSessionSummary[]>;
  prepareResume(
    directory: string,
    sessionId: string,
  ): Promise<AgentSessionResumeTarget>;
}

export interface AgentSessionRouteDependencies {
  getRepositoryDirectories(): Promise<string[]>;
  providers: Record<CodingAgent, AgentSessionProvider>;
  dispatch?(
    contents: WebContents,
    payload: OpenTerminalTabPayload,
  ): Promise<boolean>;
}

export function createAgentSessionProviders(): Record<
  CodingAgent,
  AgentSessionProvider
> {
  return {
    opencode: {
      async list(repositoryDirectories, query, directory) {
        const directories = directory ? [directory] : repositoryDirectories;
        if (directories.length === 0) return [];
        const sessions = directory
          ? query
            ? await openCodeSessionHistoryService.search(directory, query)
            : await openCodeSessionHistoryService.list(directory)
          : query
            ? await openCodeSessionHistoryService.searchProjects(
                directories,
                query,
              )
            : await openCodeSessionHistoryService.listProjects(directories);
        return sessions.map((session) => ({
          ...session,
          agent: 'opencode' as const,
          resumable: true as const,
        }));
      },
      async prepareResume(directory, sessionId) {
        const target = await openCodeSessionHistoryService.getResumeTarget(
          directory,
          sessionId,
        );
        return {
          directory: target.cwd,
          label: target.title,
          customLabel: target.title,
          agent: 'opencode',
          startupNotice: {
            message: 'Resuming OpenCode Session',
            subtitle: target.title,
          },
          command: `${target.executable} ${target.args.join(' ')}`,
        };
      },
    },
    claude: {
      async list(repositoryDirectories, query, directory) {
        const sessions = query
          ? await claudeSessionHistoryService.search(query)
          : await claudeSessionHistoryService.list();
        return sessions
          .filter(
            (session) =>
              isWithinRegisteredRepository(
                session.directory,
                repositoryDirectories,
              ) &&
              (!directory || isWithin(session.directory, directory)),
          )
          .map((session) => ({
            ...session,
            agent: 'claude' as const,
            resumable: true as const,
          }));
      },
      async prepareResume(directory, sessionId) {
        const session = await claudeSessionHistoryService.resume(
          directory,
          sessionId,
        );
        return {
          directory: session.directory,
          label: session.title,
          customLabel: session.title,
          agent: 'claude',
          startupNotice: {
            message: 'Resuming Claude Code Session',
            subtitle: session.title,
          },
          command: `claude --resume ${session.id}`,
        };
      },
    },
    cursor: {
      async list(repositoryDirectories, query, directory) {
        const sessions = query
          ? await cursorSessionHistoryService.search(query)
          : await cursorSessionHistoryService.list();
        return sessions
          .filter(
            (session) =>
              session.directory &&
              isWithinRegisteredRepository(
                session.directory,
                repositoryDirectories,
              ) &&
              (!directory || isWithin(session.directory, directory)),
          )
          .map((session) => ({ ...session, agent: 'cursor' as const }));
      },
      async prepareResume(directory, sessionId) {
        await cursorSessionHistoryService.resume(directory, sessionId);
        const session = (await cursorSessionHistoryService.list()).find(
          (candidate) =>
            candidate.id === sessionId && candidate.directory === directory,
        );
        if (!session) throw new Error('Cursor session was not found');
        return {
          directory: session.directory,
          label: session.title,
          customLabel: session.title,
          agent: 'cursor',
          startupNotice: {
            message: 'Resuming Cursor Session',
            subtitle: session.title,
          },
          command: `agent --resume=${sessionId}`,
        };
      },
    },
  };
}

const AGENTS = new Set<CodingAgent>(['opencode', 'claude', 'cursor']);
const OPEN_TIMEOUT_MS = 5000;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isWithin(directory: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(directory));
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function isWithinRegisteredRepository(
  directory: string,
  repositoryDirectories: string[],
): boolean {
  return repositoryDirectories.some((root) => isWithin(directory, root));
}

function rejectBrowserOrigin(req: Request, res: Response): boolean {
  if (
    req.headers.origin !== undefined ||
    req.headers['sec-fetch-site'] !== undefined
  ) {
    res.status(403).json({
      success: false,
      error: 'browser-origin requests are not allowed',
    });
    return true;
  }
  return false;
}

function parseAgent(value: unknown): CodingAgent | undefined {
  return typeof value === 'string' && AGENTS.has(value as CodingAgent)
    ? (value as CodingAgent)
    : undefined;
}

function focusedMainContents(): WebContents | undefined {
  const focused = BrowserWindow.getFocusedWindow();
  if (!focused || focused.isDestroyed()) return undefined;
  const host = applicationWindows.get(focused.id);
  if (!host || host.metadata.primaryType !== PrimaryWindowType.MAIN) {
    return undefined;
  }
  return host.window.webContents;
}

/** Dispatch a terminal-tab intent and wait until the renderer has materialized the tab. */
export function dispatchAgentSessionTabOpen(
  contents: WebContents,
  payload: OpenTerminalTabPayload,
  timeoutMs = OPEN_TIMEOUT_MS,
): Promise<boolean> {
  const requestId = randomUUID();
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout;
    const finish = (opened: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ipcMain.removeListener(WindowEvent.OPEN_TERMINAL_TAB_ACK, onAck);
      contents.removeListener('destroyed', onDestroyed);
      resolve(opened);
    };
    const onAck = (
      event: Electron.IpcMainEvent,
      ack?: { requestId?: unknown; opened?: unknown },
    ) => {
      if (
        event.sender === contents &&
        event.senderFrame === contents.mainFrame &&
        ack?.requestId === requestId &&
        typeof ack.opened === 'boolean'
      ) {
        finish(ack.opened);
      }
    };
    const onDestroyed = () => finish(false);

    timer = setTimeout(() => finish(false), timeoutMs);
    ipcMain.on(WindowEvent.OPEN_TERMINAL_TAB_ACK, onAck);
    contents.once('destroyed', onDestroyed);
    try {
      contents.send(WindowEvent.OPEN_TERMINAL_TAB, { ...payload, requestId });
    } catch {
      finish(false);
    }
  });
}

export function registerAgentSessionRoutes(
  app: Application,
  deps: AgentSessionRouteDependencies,
): void {
  const dispatch = deps.dispatch ?? dispatchAgentSessionTabOpen;

  app.get('/api/agent-sessions', async (req, res) => {
    if (rejectBrowserOrigin(req, res)) return;
    const agent = parseAgent(req.query.agent);
    if (!agent) {
      res.status(400).json({
        success: false,
        error: 'agent must be one of opencode, claude, or cursor',
      });
      return;
    }
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const directory =
      typeof req.query.directory === 'string' ? req.query.directory : undefined;
    if (directory && !path.isAbsolute(directory)) {
      res.status(400).json({
        success: false,
        error: 'directory must be an absolute path',
      });
      return;
    }

    try {
      const repositoryDirectories = (
        await deps.getRepositoryDirectories()
      ).filter((value) => typeof value === 'string' && path.isAbsolute(value));
      if (
        directory &&
        !isWithinRegisteredRepository(directory, repositoryDirectories)
      ) {
        res.status(400).json({
          success: false,
          error: 'directory must be inside a registered repository',
        });
        return;
      }
      const sessions = await deps.providers[agent].list(
        repositoryDirectories,
        query,
        directory,
      );
      res.json({ success: true, agent, sessions });
    } catch (error) {
      console.error('[agentSessionRoutes] list failed', error);
      res.status(500).json({
        success: false,
        error: 'failed to list agent sessions',
      });
    }
  });

  app.post('/api/agent-sessions/open', async (req, res) => {
    if (rejectBrowserOrigin(req, res)) return;
    const body = isObject(req.body) ? req.body : null;
    if (
      !body ||
      Object.keys(body).some(
        (key) => !['agent', 'sessionId', 'directory'].includes(key),
      )
    ) {
      res.status(400).json({
        success: false,
        error: 'body must contain only agent, sessionId, and directory',
      });
      return;
    }
    const agent = parseAgent(body.agent);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const directory = typeof body.directory === 'string' ? body.directory : '';
    if (!agent || !sessionId || !path.isAbsolute(directory)) {
      res.status(400).json({
        success: false,
        error: 'agent, sessionId, and an absolute directory are required',
      });
      return;
    }

    let repositoryDirectories: string[];
    let target: AgentSessionResumeTarget;
    try {
      repositoryDirectories = (await deps.getRepositoryDirectories()).filter(
        (value) => typeof value === 'string' && path.isAbsolute(value),
      );
      if (!isWithinRegisteredRepository(directory, repositoryDirectories)) {
        res.status(400).json({
          success: false,
          error: 'directory must be inside a registered repository',
        });
        return;
      }
      target = await deps.providers[agent].prepareResume(directory, sessionId);
      if (
        !path.isAbsolute(target.directory) ||
        !isWithinRegisteredRepository(target.directory, repositoryDirectories)
      ) {
        res.status(404).json({
          success: false,
          error: 'session does not belong to a registered repository',
        });
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('not found')) {
        res
          .status(404)
          .json({ success: false, error: 'agent session not found' });
      } else if (message.includes('cannot be resumed')) {
        res.status(409).json({ success: false, error: message });
      } else {
        console.error('[agentSessionRoutes] resume preparation failed', error);
        res.status(500).json({
          success: false,
          error: 'failed to prepare agent session resume',
        });
      }
      return;
    }

    const contents = focusedMainContents();
    if (!contents) {
      res.json({
        success: true,
        opened: false,
        sessionId,
        reason: 'no-focused-agent-session-host',
      });
      return;
    }
    try {
      const opened = await dispatch(contents, target);
      res.json({
        success: true,
        opened,
        sessionId,
        ...(opened ? {} : { reason: 'terminal-tab-open-timeout' }),
      });
    } catch (error) {
      console.error('[agentSessionRoutes] tab dispatch failed', error);
      res.status(500).json({
        success: false,
        error: 'failed to dispatch agent session tab',
      });
    }
  });
}
