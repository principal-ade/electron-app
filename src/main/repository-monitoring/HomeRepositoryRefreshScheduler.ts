import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';

const REFRESH_INTERVAL_MS = 60_000;
const MIN_START_SPACING_MS = 250;
const MAX_CONCURRENT_REFRESHES = 2;

interface RepositoryRefreshState {
  dueAt: number;
  status?: GitStatusWithFiles;
  revision: number;
}

interface Consumer {
  paths: Set<string>;
  visible: boolean;
}

/**
 * One rolling queue shared by every Home window. The minute is a freshness
 * target, not a deadline: slow checks never cause a catch-up burst.
 */
export class HomeRepositoryRefreshScheduler {
  private readonly consumers = new Map<string, Consumer>();
  private readonly repositories = new Map<string, RepositoryRefreshState>();
  private readonly inFlight = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nextStartAt = 0;
  private disposed = false;
  private suspended = false;

  constructor(
    private readonly refresh: (path: string) => Promise<GitStatusWithFiles>,
    private readonly publish: (status: GitStatusWithFiles) => void,
    private readonly onError: (path: string, error: unknown) => void,
  ) {}

  setConsumer(id: string, paths: string[], visible: boolean): void {
    if (this.disposed) return;
    if (paths.length === 0) this.consumers.delete(id);
    else this.consumers.set(id, { paths: new Set(paths), visible });

    const retained = new Set(
      [...this.consumers.values()].flatMap((consumer) => [...consumer.paths]),
    );
    // Retain snapshots/deadlines across Home unmounts, but only schedule paths
    // requested by a currently visible consumer.
    const spacing = Math.max(
      MIN_START_SPACING_MS,
      REFRESH_INTERVAL_MS / Math.max(1, retained.size),
    );
    let offset = 0;
    for (const path of retained) {
      if (!this.repositories.has(path)) {
        this.repositories.set(path, {
          dueAt: Date.now() + offset * spacing,
          revision: 0,
        });
        offset++;
      }
    }
    this.schedule();
  }

  removeConsumer(id: string): void {
    this.setConsumer(id, [], false);
  }

  /** Live watcher events count as fresh and defer the next safety-net check. */
  observeStatus(status: GitStatusWithFiles): void {
    const state = this.repositories.get(String(status.repoPath));
    if (!state) return;
    state.status = status;
    state.revision++;
    state.dueAt = Date.now() + REFRESH_INTERVAL_MS;
    this.schedule();
  }

  getStatuses(paths: string[]): GitStatusWithFiles[] {
    return paths.flatMap((path) => {
      const status = this.repositories.get(path)?.status;
      return status ? [status] : [];
    });
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.consumers.clear();
    this.repositories.clear();
  }

  private activePaths(): Set<string> {
    return new Set(
      [...this.consumers.values()]
        .filter((consumer) => consumer.visible)
        .flatMap((consumer) => [...consumer.paths]),
    );
  }

  private startSpacing(): number {
    return Math.max(
      MIN_START_SPACING_MS,
      REFRESH_INTERVAL_MS / Math.max(1, this.activePaths().size),
    );
  }

  private nextRepository(): [string, RepositoryRefreshState] | undefined {
    let next: [string, RepositoryRefreshState] | undefined;
    for (const path of this.activePaths()) {
      const state = this.repositories.get(path);
      if (
        state &&
        !this.inFlight.has(path) &&
        (!next || state.dueAt < next[1].dueAt)
      ) {
        next = [path, state];
      }
    }
    return next;
  }

  private schedule(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (
      this.disposed ||
      this.suspended ||
      this.inFlight.size >= MAX_CONCURRENT_REFRESHES
    )
      return;
    const next = this.nextRepository();
    if (!next) return;
    const delay = Math.max(
      0,
      next[1].dueAt - Date.now(),
      this.nextStartAt - Date.now(),
    );
    this.timer = setTimeout(() => this.runNext(), delay);
  }

  private runNext(): void {
    this.timer = undefined;
    const next = this.nextRepository();
    if (!next || this.disposed) return;
    const [path, state] = next;
    const revision = state.revision;
    this.inFlight.add(path);
    this.nextStartAt = Date.now() + this.startSpacing();
    state.dueAt = Date.now() + REFRESH_INTERVAL_MS;
    void Promise.resolve()
      .then(() => this.refresh(path))
      .then((status) => {
        if (this.disposed || this.repositories.get(path) !== state) return;
        // A watcher may have delivered a newer status while this read ran.
        if (state.revision === revision) {
          this.observeStatus(status);
          this.publish(status);
        }
      })
      .catch((error: unknown) => this.onError(path, error))
      .finally(() => {
        this.inFlight.delete(path);
        this.schedule();
      });
    this.schedule();
  }
}
