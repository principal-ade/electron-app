import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { ClaudeSessionSummary } from '../../shared/main-process-api-interfaces/ClaudeSessionHistoryAPI';

const SESSION_LIMIT = 100;
const SCAN_CONCURRENCY = 4;
const SAFE_SESSION_ID = /^[a-f0-9-]{36}$/i;
const MAX_HEADER_BYTES = 128 * 1024;

interface ClaudeSessionRecord {
  summary: ClaudeSessionSummary;
  transcriptPath: string;
}

interface TranscriptRow {
  type?: unknown;
  sessionId?: unknown;
  cwd?: unknown;
  timestamp?: unknown;
  isMeta?: unknown;
  isSidechain?: unknown;
  customTitle?: unknown;
  aiTitle?: unknown;
  message?: {
    role?: unknown;
    content?: unknown;
  };
}

function configDirectory(): string {
  const configured = process.env.CLAUDE_CONFIG_DIR;
  return configured
    ? path.resolve(configured)
    : path.join(os.homedir(), '.claude');
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .filter(
      (part): part is { type?: string; text?: string } =>
        !!part && typeof part === 'object',
    )
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n')
    .trim();
}

function rowTitle(row: TranscriptRow): string | undefined {
  if (row.type === 'custom-title' && typeof row.customTitle === 'string') {
    return row.customTitle.trim() || undefined;
  }
  if (row.type === 'ai-title' && typeof row.aiTitle === 'string') {
    return row.aiTitle.trim() || undefined;
  }
  if (
    row.type === 'user' &&
    row.isMeta !== true &&
    row.isSidechain !== true &&
    row.message?.role === 'user'
  ) {
    return textContent(row.message.content) || undefined;
  }
  return undefined;
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

async function readTranscriptHeader(
  transcriptPath: string,
): Promise<{ title?: string; directory?: string; createdAt?: number }> {
  const stream = createReadStream(transcriptPath, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let bytesRead = 0;
  let title: string | undefined;
  let directory: string | undefined;
  let createdAt: number | undefined;

  try {
    for await (const line of lines) {
      bytesRead += Buffer.byteLength(line, 'utf8') + 1;
      let row: TranscriptRow;
      try {
        row = JSON.parse(line) as TranscriptRow;
      } catch {
        if (bytesRead >= MAX_HEADER_BYTES) break;
        continue;
      }
      if (
        !directory &&
        typeof row.cwd === 'string' &&
        path.isAbsolute(row.cwd)
      ) {
        directory = row.cwd;
      }
      if (!createdAt && typeof row.timestamp === 'string') {
        const timestamp = Date.parse(row.timestamp);
        if (Number.isFinite(timestamp)) createdAt = timestamp;
      }
      const candidate = rowTitle(row);
      // Keep scanning a bounded header for a session name, but don't read the
      // full transcript just to build a list row.
      if (
        candidate &&
        (row.type === 'custom-title' || row.type === 'ai-title')
      ) {
        title = candidate;
      } else if (!title && candidate) {
        title = candidate;
      }
      if (bytesRead >= MAX_HEADER_BYTES) break;
      if (title && directory && createdAt) break;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return { title, directory, createdAt };
}

async function existingProjectDirectories(root: string): Promise<string[]> {
  const projects = path.join(root, 'projects');
  try {
    const entries = await fs.readdir(projects, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => path.join(projects, entry.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new Error(`Cannot read Claude Code sessions at ${projects}`);
  }
}

async function transcriptFiles(root: string): Promise<string[]> {
  const projectDirectories = await existingProjectDirectories(root);
  const byProject = await mapConcurrent(
    projectDirectories,
    SCAN_CONCURRENCY,
    async (directory) => {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const candidates = entries
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.endsWith('.jsonl') &&
            SAFE_SESSION_ID.test(path.basename(entry.name, '.jsonl')),
        )
        .map((entry) => path.join(directory, entry.name));
      return mapConcurrent(candidates, SCAN_CONCURRENCY, async (file) => {
        const stat = await fs.stat(file).catch(() => null);
        return stat?.isFile() ? { file, updatedAt: stat.mtimeMs } : null;
      });
    },
  );
  return byProject
    .flat()
    .filter((entry): entry is { file: string; updatedAt: number } => !!entry)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, SESSION_LIMIT)
    .map((entry) => entry.file);
}

export class ClaudeSessionHistoryService {
  constructor(private readonly root = configDirectory()) {}

  private async records(): Promise<ClaudeSessionRecord[]> {
    const files = await transcriptFiles(this.root);
    return mapConcurrent(files, SCAN_CONCURRENCY, async (transcriptPath) => {
      const [stat, header] = await Promise.all([
        fs.stat(transcriptPath),
        readTranscriptHeader(transcriptPath),
      ]);
      const id = path.basename(transcriptPath, '.jsonl');
      const projectDirectory = path.basename(path.dirname(transcriptPath));
      const fallbackTitle =
        projectDirectory.replace(/^-+/, '') || 'Claude Code session';
      return {
        transcriptPath,
        summary: {
          id,
          title: header.title || fallbackTitle,
          directory: header.directory || os.homedir(),
          createdAt: header.createdAt || stat.birthtimeMs || stat.mtimeMs,
          updatedAt: stat.mtimeMs,
        },
      };
    });
  }

  async list(): Promise<ClaudeSessionSummary[]> {
    return (await this.records()).map((record) => record.summary);
  }

  async search(query: string): Promise<ClaudeSessionSummary[]> {
    const term = query.trim().toLocaleLowerCase();
    const records = await this.records();
    if (!term) return records.map((record) => record.summary);
    const matches = await mapConcurrent(
      records,
      SCAN_CONCURRENCY,
      async (record) => {
        if (record.summary.title.toLocaleLowerCase().includes(term)) {
          return record.summary;
        }
        const transcript = await fs.readFile(record.transcriptPath, 'utf8');
        return transcript.toLocaleLowerCase().includes(term)
          ? record.summary
          : null;
      },
    );
    return matches.filter(
      (session): session is ClaudeSessionSummary => session !== null,
    );
  }

  async resume(
    directory: string,
    sessionId: string,
  ): Promise<ClaudeSessionSummary> {
    if (!SAFE_SESSION_ID.test(sessionId)) {
      throw new Error('Invalid Claude Code session ID');
    }
    const session = (await this.records()).find(
      (record) =>
        record.summary.id === sessionId &&
        record.summary.directory === directory,
    );
    if (!session) throw new Error('Claude Code session was not found');
    return session.summary;
  }
}

export const claudeSessionHistoryService = new ClaudeSessionHistoryService();
