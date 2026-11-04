/**
 * Build configuration store (topic-1793592184227, P0 item 2).
 *
 * One JSON file per configuration plus `_index.json`, mirroring the
 * `~/.principal/subsystem-models` layout. Files hold the config plus
 * store-managed timestamps — secret *names* only, never values.
 */

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  BUILD_CONFIG_ID_PATTERN,
  confirmationFingerprintSource,
  isConfirmationCurrent,
  validateBuildConfiguration,
  type BuildConfiguration,
  type BuildConfigurationSummary,
  type StoredBuildConfiguration,
} from '../../shared/build-configurations/types';

interface BuildConfigurationIndex {
  version: 2;
  entries: BuildConfigurationSummary[];
}

/** Thrown by create/update when the document fails validation. */
export class BuildConfigurationValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`invalid build configuration: ${issues.join('; ')}`);
    this.name = 'BuildConfigurationValidationError';
    this.issues = issues;
  }
}

export function buildConfigurationsDirectory(): string {
  const home =
    process.env.PRINCIPAL_BUILD_CONFIGURATIONS_HOME?.trim() || homedir();
  return join(home, '.principal', 'build-configurations');
}

function sortMostRecentlyEditedFirst(
  entries: BuildConfigurationSummary[],
): BuildConfigurationSummary[] {
  return [...entries].sort((a, b) => {
    const byDate = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    return Number.isNaN(byDate) || byDate === 0
      ? a.name.localeCompare(b.name)
      : byDate;
  });
}

function generateId(): string {
  return `bc-${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
}

export interface BuildConfigurationStoreOptions {
  /**
   * When provided, a non-null checkout.path must live inside it.
   * Mirrors the bridge's baseDefaultDirectory constraint.
   */
  baseDefaultDirectory?: string;
}

export class BuildConfigurationStore {
  constructor(
    private readonly directory = buildConfigurationsDirectory(),
    private readonly options: BuildConfigurationStoreOptions = {},
  ) {}

  /** Most-recent-first summaries, from the index when valid. */
  async listSummaries(): Promise<BuildConfigurationSummary[]> {
    try {
      const raw = await fs.readFile(
        join(this.directory, '_index.json'),
        'utf8',
      );
      const index = JSON.parse(raw) as Partial<BuildConfigurationIndex>;
      if (index.version === 2 && Array.isArray(index.entries)) {
        return sortMostRecentlyEditedFirst(index.entries.filter(isSummary));
      }
    } catch {
      // Rebuild from config files when the index is missing or invalid.
    }
    return this.rebuildSummaries();
  }

  /** Full config plus timestamps, or null when the id is invalid/missing/invalid. */
  async get(id: string): Promise<StoredBuildConfiguration | null> {
    if (!BUILD_CONFIG_ID_PATTERN.test(id)) return null;
    let raw: string;
    try {
      raw = await fs.readFile(join(this.directory, `${id}.json`), 'utf8');
    } catch {
      return null;
    }
    return this.parseStored(id, raw);
  }

  /**
   * Create a config from agent- or UI-authored fields (no id, no
   * confirmation, no timestamps). The store assigns the id; confirmation
   * always starts empty — only the in-app confirm action sets it.
   */
  async create(input: unknown): Promise<StoredBuildConfiguration> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BuildConfigurationValidationError(['body must be an object']);
    }
    const now = new Date().toISOString();
    const candidate = {
      ...(input as Record<string, unknown>),
      id: generateId(),
      secretConfirmation: null,
      createdAt: now,
      updatedAt: now,
    };
    const stored = this.requireValid(candidate);
    await this.writeStored(stored);
    await this.writeIndex();
    return stored;
  }

  /**
   * Merge a partial patch into a config and re-validate. A material edit
   * (repo, ref, command line, secret names) clears the secret confirmation —
   * the stored confirmation must always match the content. Returns null
   * when the id is unknown.
   */
  async update(
    id: string,
    patch: unknown,
  ): Promise<StoredBuildConfiguration | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new BuildConfigurationValidationError(['patch must be an object']);
    }
    const fields = patch as Record<string, unknown>;
    if (fields.id !== undefined && fields.id !== id) {
      throw new BuildConfigurationValidationError([
        'id: cannot change the configuration id',
      ]);
    }
    const merged: Record<string, unknown> = {
      ...existing,
      ...fields,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    if (
      fields.checkout !== undefined &&
      fields.checkout !== null &&
      typeof fields.checkout === 'object'
    ) {
      merged.checkout = { ...existing.checkout, ...fields.checkout };
    }
    if (
      fields.command !== undefined &&
      fields.command !== null &&
      typeof fields.command === 'object'
    ) {
      merged.command = { ...existing.command, ...fields.command };
    }
    if (
      existing.secretConfirmation !== null &&
      confirmationFingerprintSource(existing) !==
        confirmationFingerprintSource(merged as BuildConfiguration)
    ) {
      merged.secretConfirmation = null;
    }
    const stored = this.requireValid(merged);
    await this.writeStored(stored);
    await this.writeIndex();
    return stored;
  }

  /** Delete a config. False when the id is invalid or nothing was stored. */
  async remove(id: string): Promise<boolean> {
    if (!BUILD_CONFIG_ID_PATTERN.test(id)) return false;
    try {
      await fs.unlink(join(this.directory, `${id}.json`));
    } catch {
      return false;
    }
    await this.writeIndex();
    return true;
  }

  private requireValid(value: unknown): StoredBuildConfiguration {
    const candidate = value as Record<string, unknown>;
    const { createdAt, updatedAt, ...config } = candidate;
    const result = validateBuildConfiguration(config, {
      baseDefaultDirectory: this.options.baseDefaultDirectory,
    });
    if (!result.ok) {
      throw new BuildConfigurationValidationError(result.issues);
    }
    if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
      throw new BuildConfigurationValidationError([
        'store timestamps are missing',
      ]);
    }
    return { ...result.config, createdAt, updatedAt };
  }

  private parseStored(
    id: string,
    raw: string,
  ): StoredBuildConfiguration | null {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (record.id !== id) return null;
    if (
      typeof record.createdAt !== 'string' ||
      typeof record.updatedAt !== 'string'
    ) {
      return null;
    }
    const { createdAt, updatedAt, ...config } = record;
    const result = validateBuildConfiguration(config, {
      baseDefaultDirectory: this.options.baseDefaultDirectory,
    });
    if (!result.ok) return null;
    return { ...result.config, createdAt, updatedAt };
  }

  private async writeStored(stored: StoredBuildConfiguration): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    const filePath = join(this.directory, `${stored.id}.json`);
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(stored, null, 2)}\n`);
    await fs.rename(tempPath, filePath);
  }

  private toSummary(
    stored: StoredBuildConfiguration,
  ): BuildConfigurationSummary {
    return {
      id: stored.id,
      name: stored.name,
      repo: stored.repo,
      confirmed: isConfirmationCurrent(stored),
      updatedAt: stored.updatedAt,
    };
  }

  private async rebuildSummaries(): Promise<BuildConfigurationSummary[]> {
    let entries;
    try {
      entries = await fs.readdir(this.directory, { withFileTypes: true });
    } catch {
      return [];
    }
    const summaries = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.endsWith('.json') &&
            entry.name !== '_index.json' &&
            BUILD_CONFIG_ID_PATTERN.test(entry.name.slice(0, -5)),
        )
        .map(async (entry) => {
          const stored = await this.get(entry.name.slice(0, -5));
          return stored ? this.toSummary(stored) : null;
        }),
    );
    return sortMostRecentlyEditedFirst(
      summaries.filter(
        (summary): summary is BuildConfigurationSummary => summary !== null,
      ),
    );
  }

  private async writeIndex(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    const entries = await this.rebuildSummaries();
    const index: BuildConfigurationIndex = { version: 2, entries };
    const filePath = join(this.directory, '_index.json');
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`);
    await fs.rename(tempPath, filePath);
  }
}

function isSummary(value: unknown): value is BuildConfigurationSummary {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<BuildConfigurationSummary>;
  return (
    typeof entry.id === 'string' &&
    BUILD_CONFIG_ID_PATTERN.test(entry.id) &&
    typeof entry.name === 'string' &&
    typeof entry.repo === 'string' &&
    typeof entry.confirmed === 'boolean' &&
    typeof entry.updatedAt === 'string'
  );
}
