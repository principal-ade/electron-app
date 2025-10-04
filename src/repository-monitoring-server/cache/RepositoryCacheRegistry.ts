import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

import type {
  CacheEntry,
  CacheError,
  CacheSlice,
  CacheSliceDataMap,
  RepositoryCacheSnapshot,
} from '../types';

export interface RepositoryCacheRegistryOptions {
  /**
   * Maximum number of cache rebuilds that may run concurrently across all repositories.
   * Defaults to 2 to avoid thrashing the filesystem when multiple repositories emit changes.
   */
  concurrency?: number;
  /**
   * Custom hashing implementation for cache payloads. Primarily exposed for unit testing.
   */
  hash?: (payload: unknown) => string;
  /**
   * Injectable clock for deterministic testing.
   */
  now?: () => number;
}

export interface CacheUpdatedEvent<K extends CacheSlice = CacheSlice> {
  repoPath: string;
  slice: K;
  entry: CacheEntry<CacheSliceDataMap[K]>;
}

type InternalCacheEntry<K extends CacheSlice = CacheSlice> = CacheEntry<CacheSliceDataMap[K]>;

type RepositoryCacheMap = Map<CacheSlice, InternalCacheEntry>;

type BuildTask = () => Promise<void>;

const DEFAULT_CONCURRENCY = 2;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stableStringify(value: unknown): string {
  if (!isObject(value)) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',')}}`;
}

function defaultHash(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function serializeError(error: unknown): CacheError {
  if (error && typeof error === 'object') {
    const typed = error as { message?: unknown; stack?: unknown; name?: unknown; code?: unknown };
    return {
      message: typeof typed.message === 'string' ? typed.message : 'Unknown error',
      name: typeof typed.name === 'string' ? typed.name : undefined,
      stack: typeof typed.stack === 'string' ? typed.stack : undefined,
      code:
        typeof typed.code === 'string' || typeof typed.code === 'number'
          ? typed.code
          : undefined,
    };
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown error',
  };
}

export class RepositoryCacheRegistry extends EventEmitter {
  private readonly cache: Map<string, RepositoryCacheMap> = new Map();

  private readonly versions: Map<string, Map<CacheSlice, number>> = new Map();

  private readonly options: {
    concurrency: number;
    hash?: (payload: unknown) => string;
    now?: () => number;
  };

  private activeBuilds = 0;

  private readonly buildQueue: BuildTask[] = [];

  constructor(options: RepositoryCacheRegistryOptions = {}) {
    super();

    this.options = {
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
      hash: options.hash,
      now: options.now,
    };
  }

  on<K extends CacheSlice>(event: 'cacheUpdated', listener: (payload: CacheUpdatedEvent<K>) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  once<K extends CacheSlice>(event: 'cacheUpdated', listener: (payload: CacheUpdatedEvent<K>) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this {
    return super.once(event, listener);
  }

  off<K extends CacheSlice>(event: 'cacheUpdated', listener: (payload: CacheUpdatedEvent<K>) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }

  /**
   * Returns the current cache entry for a repository slice if available.
   */
  get<K extends CacheSlice>(repoPath: string, slice: K): CacheEntry<CacheSliceDataMap[K]> | undefined {
    const repoCache = this.cache.get(repoPath);
    if (!repoCache) {
      return undefined;
    }

    const entry = repoCache.get(slice) as InternalCacheEntry<K> | undefined;
    return entry ? { ...entry } : undefined;
  }

  /**
   * Returns a snapshot of all cached slices for the provided repository.
   */
  getSnapshot(repoPath: string): RepositoryCacheSnapshot {
    const repoCache = this.cache.get(repoPath);
    if (!repoCache) {
      return { repoPath, slices: {} };
    }

    const slices: RepositoryCacheSnapshot['slices'] = {};
    for (const [slice, entry] of repoCache.entries()) {
      (slices as Record<string, CacheEntry<unknown>>)[slice] = { ...entry };
    }

    return { repoPath, slices };
  }

  /**
   * Returns cached data when available, otherwise builds and stores the slice using the provided builder.
   */
  async getOrBuild<K extends CacheSlice>(
    repoPath: string,
    slice: K,
    builder: () => Promise<CacheSliceDataMap[K]>,
  ): Promise<CacheEntry<CacheSliceDataMap[K]>> {
    const existing = this.get(repoPath, slice);
    if (existing?.data !== undefined && existing.error === undefined) {
      return existing as CacheEntry<CacheSliceDataMap[K]>;
    }

    await this.scheduleRebuild(repoPath, slice, builder);
    const refreshed = this.get(repoPath, slice);
    if (!refreshed) {
      throw new Error(`Cache entry missing after rebuild for ${repoPath}:${slice}`);
    }

    return refreshed as CacheEntry<CacheSliceDataMap[K]>;
  }

  /**
   * Schedules a rebuild of the provided slice. Concurrent rebuilds are deduplicated per slice.
   */
  async scheduleRebuild<K extends CacheSlice>(
    repoPath: string,
    slice: K,
    builder: () => Promise<CacheSliceDataMap[K]>,
  ): Promise<CacheEntry<CacheSliceDataMap[K]>> {
    const entry = this.ensureEntry(repoPath, slice) as InternalCacheEntry<K>;

    if (entry.inflight) {
      await entry.inflight;
      return { ...entry };
    }

    const inflightPromise = (async () => {
      let result: CacheSliceDataMap[K] | undefined;
      await this.enqueueBuild(async () => {
        try {
          result = await builder();
          this.applyData(repoPath, slice, result);
        } catch (error) {
          this.applyError(repoPath, slice, error);
          throw error;
        }
      }).finally(() => {
        const latest = this.ensureEntry(repoPath, slice) as InternalCacheEntry<K>;
        delete latest.inflight;
      });

      return result as CacheSliceDataMap[K];
    })();

    entry.inflight = inflightPromise;

    try {
      await inflightPromise;
    } catch (error) {
      throw error;
    }

    const latest = this.ensureEntry(repoPath, slice) as InternalCacheEntry<K>;
    return { ...latest };
  }

  /**
   * Explicitly updates a cache slice with provided data.
   */
  update<K extends CacheSlice>(
    repoPath: string,
    slice: K,
    data: CacheSliceDataMap[K],
  ): CacheEntry<CacheSliceDataMap[K]> {
    this.applyData(repoPath, slice, data);
    const latest = this.ensureEntry(repoPath, slice) as InternalCacheEntry<K>;
    return { ...latest };
  }

  /**
   * Invalidates the cache slice, forcing consumers to refetch data.
   */
  invalidate<K extends CacheSlice>(repoPath: string, slice: K): CacheEntry<CacheSliceDataMap[K]> {
    const entry = this.ensureEntry(repoPath, slice) as InternalCacheEntry<K>;
    entry.version = this.bumpVersion(repoPath, slice);
    entry.timestamp = this.now();
    delete entry.data;
    delete entry.hash;
    delete entry.error;
    delete entry.inflight;
    this.emit('cacheUpdated', { repoPath, slice, entry: { ...entry } } satisfies CacheUpdatedEvent<K>);
    return { ...entry };
  }

  private ensureEntry<K extends CacheSlice>(repoPath: string, slice: K): InternalCacheEntry<K> {
    let repoCache = this.cache.get(repoPath);
    if (!repoCache) {
      repoCache = new Map();
      this.cache.set(repoPath, repoCache);
    }

    const existing = repoCache.get(slice) as InternalCacheEntry<K> | undefined;
    if (existing) {
      return existing;
    }

    const entry: InternalCacheEntry<K> = {
      version: this.getVersion(repoPath, slice),
      timestamp: this.now(),
    } as InternalCacheEntry<K>;

    repoCache.set(slice, entry);
    return entry;
  }

  private applyData<K extends CacheSlice>(
    repoPath: string,
    slice: K,
    data: CacheSliceDataMap[K],
  ): void {
    const entry = this.ensureEntry(repoPath, slice) as InternalCacheEntry<K>;
    entry.data = data;
    entry.version = this.bumpVersion(repoPath, slice);
    entry.hash = this.hash(data);
    entry.timestamp = this.now();
    delete entry.error;
    // Exclude inflight promise when emitting to ensure structured clone compatibility
    const { inflight, ...serializable } = entry;
    this.emit('cacheUpdated', { repoPath, slice, entry: serializable } satisfies CacheUpdatedEvent<K>);
  }

  private applyError<K extends CacheSlice>(repoPath: string, slice: K, error: unknown): void {
    const entry = this.ensureEntry(repoPath, slice) as InternalCacheEntry<K>;
    entry.version = this.bumpVersion(repoPath, slice);
    entry.timestamp = this.now();
    entry.error = serializeError(error);
    delete entry.data;
    delete entry.hash;
    // Exclude inflight promise when emitting to ensure structured clone compatibility
    const { inflight, ...serializable } = entry;
    this.emit('cacheUpdated', { repoPath, slice, entry: serializable } satisfies CacheUpdatedEvent<K>);
  }

  private enqueueBuild(task: BuildTask): Promise<void> {
    return new Promise((resolve, reject) => {
      const wrapped = async () => {
        this.activeBuilds += 1;
        try {
          await task();
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          this.activeBuilds -= 1;
          this.processQueue();
        }
      };

      if (this.activeBuilds < this.options.concurrency) {
        void wrapped();
      } else {
        this.buildQueue.push(wrapped);
      }
    });
  }

  private processQueue(): void {
    while (this.activeBuilds < this.options.concurrency && this.buildQueue.length > 0) {
      const next = this.buildQueue.shift();
      if (next) {
        void next();
      }
    }
  }

  private hash(payload: unknown): string {
    const hasher = this.options.hash ?? defaultHash;
    return hasher(payload);
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  private getVersion<K extends CacheSlice>(repoPath: string, slice: K): number {
    let repoVersions = this.versions.get(repoPath);
    if (!repoVersions) {
      repoVersions = new Map();
      this.versions.set(repoPath, repoVersions);
    }

    return repoVersions.get(slice) ?? 0;
  }

  private bumpVersion<K extends CacheSlice>(repoPath: string, slice: K): number {
    const repoVersions = this.versions.get(repoPath) ?? new Map<CacheSlice, number>();
    this.versions.set(repoPath, repoVersions);
    const nextVersion = (repoVersions.get(slice) ?? 0) + 1;
    repoVersions.set(slice, nextVersion);
    return nextVersion;
  }
}
