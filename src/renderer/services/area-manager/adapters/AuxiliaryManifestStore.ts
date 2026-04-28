/**
 * Filesystem-backed AreaStore. Reads and writes
 * `<repoPath>/<canvasDir>/auxiliary.manifest.json`.
 *
 * NOTE: This adapter is the only file in area-manager that depends on
 * electron-renderer-specific code (`FileSystemService`). When the rest of
 * area-manager moves into principal-view-core-library, this adapter must
 * stay behind here — see services/scope-manager/README.md for the same
 * boundary rule applied to scope-manager.
 */

import { isAuxiliaryManifest } from '@principal-ai/principal-view-core';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import type { AreaStore } from '../AreaStore';
import type { AuxiliaryManifest } from '../types';

const DEFAULT_CANVAS_DIR = '.principal-views';
const MANIFEST_FILENAME = 'auxiliary.manifest.json';

export interface AuxiliaryManifestStoreOptions {
  /** Absolute path to the repo root. */
  repositoryPath: string;
  /**
   * Folder under the repo root where the manifest lives. Defaults to
   * `.principal-views` (matches the convention in
   * `services/scope-manager/adapters/CanvasFileScopeStore.ts`).
   */
  canvasDir?: string;
}

export class AuxiliaryManifestStore implements AreaStore {
  private readonly filePath: string;

  constructor(options: AuxiliaryManifestStoreOptions) {
    const repo = stripTrailingSlash(options.repositoryPath);
    const dir = options.canvasDir ?? DEFAULT_CANVAS_DIR;
    this.filePath = `${repo}/${dir}/${MANIFEST_FILENAME}`;
  }

  async readManifest(): Promise<AuxiliaryManifest | null> {
    try {
      const result = await FileSystemService.readFile(this.filePath);
      if (!result?.content) return null;
      const parsed = JSON.parse(result.content);
      if (!isAuxiliaryManifest(parsed)) {
        console.warn(
          '[AuxiliaryManifestStore]',
          this.filePath,
          'failed isAuxiliaryManifest guard — treating as empty.',
        );
        return null;
      }
      return parsed;
    } catch (err) {
      // Missing file is expected on first run — only log unexpected failures.
      if (!isLikelyMissingFile(err)) {
        console.error(
          '[AuxiliaryManifestStore] Failed to read/parse',
          this.filePath,
          err,
        );
      }
      return null;
    }
  }

  async writeManifest(manifest: AuxiliaryManifest): Promise<void> {
    const json = JSON.stringify(manifest, null, 2);
    const result = await FileSystemService.writeFile(this.filePath, json);
    if (!result?.success) {
      throw new Error(
        `[AuxiliaryManifestStore] Failed to write ${this.filePath}: ${result?.error ?? 'unknown error'}`,
      );
    }
  }
}

function stripTrailingSlash(p: string): string {
  return p.endsWith('/') ? p.slice(0, -1) : p;
}

function isLikelyMissingFile(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === 'ENOENT';
}
