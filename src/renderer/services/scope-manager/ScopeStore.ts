import type { RawCanvas } from './canvasIo';

/**
 * One events.canvas file paired with the dotted scope name that owns it.
 * The file's top-level `scope` field should match `scopeName`; the
 * ScopeManager is responsible for keeping that in sync on writes.
 */
export interface EventsCanvasFile {
  scopeName: string;
  canvas: RawCanvas;
}

/**
 * I/O contract for ScopeManager. Implementations decide where the canvas
 * data actually lives (in-memory map, fs, IPC bridge, network). All methods
 * are async to keep adapters interchangeable.
 */
export interface ScopeStore {
  /** Read the single .scopes.canvas. Returns null when absent. */
  readScopesCanvas(): Promise<RawCanvas | null>;

  /** Overwrite the single .scopes.canvas. */
  writeScopesCanvas(canvas: RawCanvas): Promise<void>;

  /** List all `<scope>.events.canvas` files known to the store. */
  listEventsCanvases(): Promise<EventsCanvasFile[]>;

  /** Overwrite (or create) a single `<scope>.events.canvas`. */
  writeEventsCanvas(file: EventsCanvasFile): Promise<void>;

  /** Drop a `<scope>.events.canvas` (e.g. when its scope is deleted). */
  deleteEventsCanvas(scopeName: string): Promise<void>;
}
