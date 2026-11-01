import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { WatchedPullRequest } from '../../shared/main-process-api-interfaces/PullRequestWatchAPI';

export const MAX_WATCHED_PULL_REQUESTS = 200;

/**
 * Plain JSON on disk. Snapshots hold only public PR metadata, never tokens,
 * so secure storage is unnecessary and the file stays inspectable.
 */
export class PullRequestWatchStore {
  constructor(
    private readonly filePath = path.join(
      app.getPath('userData'),
      'watched-pull-requests.json',
    ),
  ) {}

  load(): WatchedPullRequest[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const value: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (
        !value ||
        typeof value !== 'object' ||
        (value as { version?: unknown }).version !== 1 ||
        !Array.isArray((value as { pullRequests?: unknown }).pullRequests)
      ) {
        return [];
      }
      return (value as { pullRequests: unknown[] }).pullRequests.filter(
        isWatchedPullRequest,
      );
    } catch (error) {
      console.warn('[PullRequestWatch] Could not read watch list:', error);
      return [];
    }
  }

  save(pullRequests: WatchedPullRequest[]): void {
    const temporary = `${this.filePath}.tmp`;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(
      temporary,
      JSON.stringify({ version: 1, pullRequests }, null, 2),
    );
    fs.renameSync(temporary, this.filePath);
  }
}

function isWatchedPullRequest(value: unknown): value is WatchedPullRequest {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.owner === 'string' &&
    typeof entry.repo === 'string' &&
    typeof entry.number === 'number' &&
    typeof entry.url === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.state === 'string' &&
    typeof entry.checks === 'object' &&
    entry.checks !== null &&
    typeof entry.review === 'string' &&
    typeof entry.addedAt === 'number' &&
    typeof entry.updatedAt === 'number'
  );
}
