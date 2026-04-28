import type { AuxiliaryManifest } from './types';

/**
 * I/O contract for `AreaManager`. Implementations decide where the manifest
 * actually lives (in-memory map, fs, IPC bridge). Both methods are async
 * so adapters stay interchangeable.
 */
export interface AreaStore {
  /** Read the manifest. Returns null when no file exists yet. */
  readManifest(): Promise<AuxiliaryManifest | null>;

  /** Overwrite the manifest. Implementations are free to skip the schema URL. */
  writeManifest(manifest: AuxiliaryManifest): Promise<void>;
}
