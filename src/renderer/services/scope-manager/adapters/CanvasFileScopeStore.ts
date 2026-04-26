/**
 * Filesystem-backed ScopeStore. Reads and writes canvas JSON under
 * `<repoPath>/<canvasDir>/` (defaults to `.principal-views/`).
 *
 * NOTE: This adapter is the only file in scope-manager that depends on
 * electron-renderer-specific code (`FileSystemService`). When the rest of
 * scope-manager moves into principal-view-core-library, this adapter must
 * stay behind here — see services/scope-manager/README.md.
 */

import { FileSystemService } from '../../../main-process-api/FileSystemService';
import type { RawCanvas } from '../canvasIo';
import type { EventsCanvasFile, ScopeStore } from '../ScopeStore';

const DEFAULT_CANVAS_DIR = '.principal-views';
/** Filename used when no .scopes.canvas exists yet. */
const SCOPES_CANVAS_DEFAULT_NAME = 'architecture.scopes.canvas';

export interface CanvasFileScopeStoreOptions {
  /** Absolute path to the repo root. */
  repositoryPath: string;
  /**
   * Folder under the repo root where canvases live. Defaults to
   * `.principal-views`.
   */
  canvasDir?: string;
}

export class CanvasFileScopeStore implements ScopeStore {
  private readonly canvasDirAbs: string;
  /** Path of the .scopes.canvas we read from (or will create). */
  private scopesCanvasPath: string | null = null;
  /**
   * scopeName → events canvas file path. Populated by listEventsCanvases so
   * round-trip writes don't rename existing files.
   */
  private readonly eventsCanvasPaths = new Map<string, string>();

  constructor(options: CanvasFileScopeStoreOptions) {
    const repo = stripTrailingSlash(options.repositoryPath);
    const dir = options.canvasDir ?? DEFAULT_CANVAS_DIR;
    this.canvasDirAbs = `${repo}/${dir}`;
  }

  async readScopesCanvas(): Promise<RawCanvas | null> {
    const filenames = await this.listCanvasDir();
    const matches = filenames.filter((n) => n.endsWith('.scopes.canvas'));
    if (matches.length === 0) return null;
    if (matches.length > 1) {
      console.warn(
        '[CanvasFileScopeStore] Multiple .scopes.canvas files found in',
        this.canvasDirAbs,
        '— using',
        matches[0],
      );
    }
    const filename = matches[0];
    const filePath = `${this.canvasDirAbs}/${filename}`;
    const canvas = await this.readCanvasFile(filePath);
    if (canvas) this.scopesCanvasPath = filePath;
    return canvas;
  }

  async writeScopesCanvas(canvas: RawCanvas): Promise<void> {
    const filePath =
      this.scopesCanvasPath ??
      `${this.canvasDirAbs}/${SCOPES_CANVAS_DEFAULT_NAME}`;
    await this.writeCanvasFile(filePath, canvas);
    this.scopesCanvasPath = filePath;
  }

  async listEventsCanvases(): Promise<EventsCanvasFile[]> {
    const filenames = await this.listCanvasDir();
    const matches = filenames.filter((n) => n.endsWith('.events.canvas'));
    const out: EventsCanvasFile[] = [];
    for (const filename of matches) {
      const filePath = `${this.canvasDirAbs}/${filename}`;
      const canvas = await this.readCanvasFile(filePath);
      if (!canvas) continue;
      const scopeName = readScopeField(canvas);
      if (!scopeName) {
        console.warn(
          '[CanvasFileScopeStore]',
          filename,
          'has no top-level "scope" field — skipping',
        );
        continue;
      }
      this.eventsCanvasPaths.set(scopeName, filePath);
      out.push({ scopeName, canvas });
    }
    return out;
  }

  async writeEventsCanvas(file: EventsCanvasFile): Promise<void> {
    const known = this.eventsCanvasPaths.get(file.scopeName);
    const filePath =
      known ??
      `${this.canvasDirAbs}/${sanitizeScopeName(file.scopeName)}.events.canvas`;
    await this.writeCanvasFile(filePath, file.canvas);
    this.eventsCanvasPaths.set(file.scopeName, filePath);
  }

  async deleteEventsCanvas(scopeName: string): Promise<void> {
    const filePath = this.eventsCanvasPaths.get(scopeName);
    if (!filePath) return; // never written, nothing to do
    const result = await FileSystemService.deleteFile(filePath);
    if (!result.success) {
      throw new Error(
        `[CanvasFileScopeStore] Failed to delete ${filePath}: ${result.error ?? 'unknown error'}`,
      );
    }
    this.eventsCanvasPaths.delete(scopeName);
  }

  // ---- internals ----------------------------------------------------------

  private async listCanvasDir(): Promise<string[]> {
    try {
      return await FileSystemService.readDirectory(this.canvasDirAbs);
    } catch {
      // Directory likely doesn't exist yet — that's fine, treat as empty.
      return [];
    }
  }

  private async readCanvasFile(filePath: string): Promise<RawCanvas | null> {
    try {
      const result = await FileSystemService.readFile(filePath);
      if (!result?.content) return null;
      return JSON.parse(result.content) as RawCanvas;
    } catch (err) {
      console.error(
        '[CanvasFileScopeStore] Failed to read/parse',
        filePath,
        err,
      );
      return null;
    }
  }

  private async writeCanvasFile(
    filePath: string,
    canvas: RawCanvas,
  ): Promise<void> {
    const json = JSON.stringify(canvas, null, 2);
    const result = await FileSystemService.writeFile(filePath, json);
    if (!result?.success) {
      throw new Error(
        `[CanvasFileScopeStore] Failed to write ${filePath}: ${result?.error ?? 'unknown error'}`,
      );
    }
  }
}

function readScopeField(canvas: RawCanvas): string | null {
  const value = (canvas as Record<string, unknown>).scope;
  return typeof value === 'string' ? value : null;
}

function stripTrailingSlash(p: string): string {
  return p.endsWith('/') ? p.slice(0, -1) : p;
}

/**
 * Convert a dotted scope name (e.g. "principal-view.cli") into a filename-safe
 * basename ("principal-view-cli"). Matches the convention in the
 * principal-view-core-library examples.
 */
function sanitizeScopeName(scopeName: string): string {
  return (
    scopeName
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/\./g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'scope'
  );
}
