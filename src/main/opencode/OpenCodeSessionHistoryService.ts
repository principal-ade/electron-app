import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { getProcessPath } from '../utils/processPath';
import type {
  OpenCodeResumeTarget,
  OpenCodeSessionSummary,
} from '../../shared/main-process-api-interfaces/OpenCodeSessionHistoryAPI';

const SESSION_LIMIT = 100;
const EXPORT_CONCURRENCY = 4;
const COMMAND_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const SAFE_SESSION_ID = /^ses_[A-Za-z0-9_-]{6,200}$/;

type RunOpenCode = (args: string[], cwd: string) => Promise<string>;

interface ListedSession {
  id?: unknown;
  title?: unknown;
  directory?: unknown;
  created?: unknown;
  updated?: unknown;
}

function runOpenCode(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'opencode',
      args,
      {
        cwd,
        env: { ...process.env, PATH: getProcessPath() },
        encoding: 'utf8',
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
      },
      (error, stdout, stderr) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new Error('OpenCode CLI was not found on PATH'));
            return;
          }
          const detail = stderr.trim();
          reject(
            new Error(detail || `OpenCode command failed: ${error.message}`),
          );
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function timestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeSessions(
  output: string,
  directory: string,
): OpenCodeSessionSummary[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error('OpenCode returned an invalid session list');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('OpenCode returned an unexpected session list');
  }

  return (parsed as ListedSession[])
    .filter(
      (session): session is ListedSession & { id: string } =>
        typeof session.id === 'string' && SAFE_SESSION_ID.test(session.id),
    )
    .map((session) => ({
      id: session.id,
      title:
        typeof session.title === 'string' && session.title.trim()
          ? session.title.trim()
          : 'Untitled session',
      directory:
        typeof session.directory === 'string' &&
        path.isAbsolute(session.directory)
          ? session.directory
          : directory,
      createdAt: timestamp(session.created),
      updatedAt: timestamp(session.updated),
    }));
}

async function assertProjectDirectory(directory: string): Promise<void> {
  if (!path.isAbsolute(directory)) {
    throw new Error('Project directory must be an absolute path');
  }
  if (!(await isProjectDirectory(directory))) {
    throw new Error('Project directory does not exist');
  }
}

async function isProjectDirectory(directory: string): Promise<boolean> {
  try {
    return (await fs.stat(directory)).isDirectory();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw new Error(`Cannot access project directory: ${directory}`);
  }
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (next < values.length) {
        const index = next++;
        results[index] = await mapper(values[index]);
      }
    }),
  );
  return results;
}

export class OpenCodeSessionHistoryService {
  constructor(private readonly run: RunOpenCode = runOpenCode) {}

  async list(directory: string): Promise<OpenCodeSessionSummary[]> {
    await assertProjectDirectory(directory);
    const output = await this.run(
      [
        'session',
        'list',
        '--format',
        'json',
        '--max-count',
        String(SESSION_LIMIT),
      ],
      directory,
    );
    return normalizeSessions(output, directory);
  }

  async listProjects(directories: string[]): Promise<OpenCodeSessionSummary[]> {
    const uniqueDirectories = [...new Set(directories)].filter((directory) =>
      path.isAbsolute(directory),
    );
    // Repository registry entries can outlive their local clones. Skip those
    // stale paths so one deleted checkout doesn't hide every other project's
    // sessions; permission and CLI errors still surface to the caller.
    const existingDirectories = (
      await mapConcurrent(uniqueDirectories, EXPORT_CONCURRENCY, async (dir) =>
        (await isProjectDirectory(dir)) ? dir : null,
      )
    ).filter((directory): directory is string => directory !== null);
    const byDirectory = await mapConcurrent(
      existingDirectories,
      EXPORT_CONCURRENCY,
      (directory) => this.list(directory),
    );
    return byDirectory
      .flat()
      .sort(
        (a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title),
      );
  }

  async search(
    directory: string,
    query: string,
  ): Promise<OpenCodeSessionSummary[]> {
    return this.searchSessions(await this.list(directory), query);
  }

  async searchProjects(
    directories: string[],
    query: string,
  ): Promise<OpenCodeSessionSummary[]> {
    return this.searchSessions(await this.listProjects(directories), query);
  }

  private async searchSessions(
    sessions: OpenCodeSessionSummary[],
    query: string,
  ): Promise<OpenCodeSessionSummary[]> {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return sessions;

    const matched = await mapConcurrent(
      sessions,
      EXPORT_CONCURRENCY,
      async (session) => {
        if (session.title.toLocaleLowerCase().includes(term)) return session;
        const exported = await this.run(
          ['session', 'export', '--sanitize', session.id],
          session.directory,
        );
        return exported.toLocaleLowerCase().includes(term) ? session : null;
      },
    );
    return matched.filter(
      (session): session is OpenCodeSessionSummary => session !== null,
    );
  }

  async getResumeTarget(
    directory: string,
    sessionId: string,
  ): Promise<OpenCodeResumeTarget> {
    if (!SAFE_SESSION_ID.test(sessionId)) {
      throw new Error('Invalid OpenCode session ID');
    }
    const sessions = await this.list(directory);
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (!session) {
      throw new Error('OpenCode session was not found in this project');
    }
    return {
      cwd: session.directory,
      title: session.title,
      executable: 'opencode',
      args: ['--session', session.id],
    };
  }
}

export const openCodeSessionHistoryService =
  new OpenCodeSessionHistoryService();
