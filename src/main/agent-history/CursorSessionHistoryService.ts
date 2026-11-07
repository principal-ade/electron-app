import path from 'path';
import os from 'os';
import {
  getSession,
  isDatabaseNotFoundError,
  listSessionSummaries,
  searchSessions,
  type ResolvedSessionSummary,
  type SearchResult,
  type Session,
  type SessionSummary,
} from 'cursor-history';
import type { CursorSessionSummary } from '../../shared/main-process-api-interfaces/CursorSessionHistoryAPI';

const SESSION_LIMIT = 100;
const CURSOR_CLI_SESSION_SOURCE = new Set([
  'store-db',
  'store-transcript',
  'merged',
]);
const SAFE_CURSOR_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{5,200}$/;

function isResolvedSummary(
  summary: SessionSummary,
): summary is ResolvedSessionSummary {
  return summary.resolutionState !== 'ambiguous';
}

function absoluteWorkspace(directory: string | undefined): string {
  if (!directory || directory === 'unknown') return '';
  if (directory === '~') return os.homedir();
  if (directory.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), directory.slice(2));
  }
  return path.isAbsolute(directory) ? directory : '';
}

function summaryOf(summary: ResolvedSessionSummary): CursorSessionSummary {
  const directory = absoluteWorkspace(
    summary.canonicalWorkspacePath ?? summary.workspace,
  );
  const source = summary.resolvedSource;
  return {
    id: summary.id,
    title:
      summary.title?.trim() ||
      summary.preview.trim() ||
      'Untitled Cursor session',
    directory,
    createdAt: Date.parse(summary.timestamp) || 0,
    updatedAt: Date.parse(summary.metadata.lastModified) || 0,
    // Cursor's CLI resume handles Store/Agent sessions. Composer IDE chats do
    // not have a documented CLI resume path, so keep them browsable but honest.
    resumable: CURSOR_CLI_SESSION_SOURCE.has(source) && !!directory,
  };
}

function summaryOfSession(session: Session): CursorSessionSummary {
  const directory = absoluteWorkspace(
    session.canonicalWorkspacePath ?? session.workspace,
  );
  const firstPrompt = session.messages.find(
    (message) => message.role === 'user',
  )?.content;
  const resumable = session.resolvedSource
    ? CURSOR_CLI_SESSION_SOURCE.has(session.resolvedSource)
    : [
        'store',
        'transcript',
        'store-complete',
        'store-partial',
        'merged',
      ].includes(session.source ?? '');
  return {
    id: session.id,
    title: firstPrompt?.trim() || 'Cursor session',
    directory,
    createdAt: Date.parse(session.timestamp) || 0,
    updatedAt: Date.parse(session.metadata?.lastModified ?? '') || 0,
    resumable: resumable && !!directory,
  };
}

function searchSummaryOf(result: SearchResult): CursorSessionSummary {
  const session = result.session;
  const source = session.resolvedSource;
  const directory = absoluteWorkspace(
    session.canonicalWorkspacePath ?? session.workspace,
  );
  const firstPrompt = session.messages
    .find((message) => message.role === 'user')
    ?.content.split(/\r?\n/, 1)[0]
    ?.trim();
  const title = firstPrompt || result.match.split(/\r?\n/, 1)[0]?.trim();
  return {
    id: session.id,
    title: title || 'Cursor session',
    directory,
    createdAt: Date.parse(session.timestamp) || 0,
    updatedAt: Date.parse(session.metadata?.lastModified ?? '') || 0,
    resumable: !!source && CURSOR_CLI_SESSION_SOURCE.has(source) && !!directory,
  };
}

export class CursorSessionHistoryService {
  private async summaries(): Promise<CursorSessionSummary[]> {
    try {
      const result = await listSessionSummaries({
        limit: SESSION_LIMIT,
        offset: 0,
        sqliteDriver: 'node:sqlite',
      });
      return result.data
        .filter(isResolvedSummary)
        .map(summaryOf)
        .sort(
          (a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title),
        );
    } catch (error) {
      if (isDatabaseNotFoundError(error)) return [];
      throw error;
    }
  }

  async list(): Promise<CursorSessionSummary[]> {
    return this.summaries();
  }

  async search(query: string): Promise<CursorSessionSummary[]> {
    const term = query.trim();
    if (!term) return this.list();
    try {
      const results = await searchSessions(term, {
        limit: SESSION_LIMIT,
        context: 0,
        sqliteDriver: 'node:sqlite',
      });
      return results
        .map(searchSummaryOf)
        .sort(
          (a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title),
        );
    } catch (error) {
      if (isDatabaseNotFoundError(error)) return [];
      throw error;
    }
  }

  async resume(directory: string, sessionId: string): Promise<void> {
    if (!SAFE_CURSOR_SESSION_ID.test(sessionId)) {
      throw new Error('Invalid Cursor session ID');
    }
    const session = summaryOfSession(
      await getSession(sessionId, {
        sqliteDriver: 'node:sqlite',
      }),
    );
    if (session.directory !== directory) {
      throw new Error('Cursor session was not found in this workspace');
    }
    if (!session.resumable) {
      throw new Error('This Cursor IDE session cannot be resumed from the CLI');
    }
  }
}

export const cursorSessionHistoryService = new CursorSessionHistoryService();
