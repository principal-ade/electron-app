import type { AreaStore } from '../AreaStore';
import type { AuxiliaryManifest } from '../types';

/**
 * In-memory adapter. Convenient for tests and storybook so the manager can
 * still drive its lifecycle without hitting the filesystem.
 */
export class InMemoryAreaStore implements AreaStore {
  private manifest: AuxiliaryManifest | null;

  constructor(initial?: AuxiliaryManifest | null) {
    this.manifest = initial ? cloneJson(initial) : null;
  }

  async readManifest(): Promise<AuxiliaryManifest | null> {
    return this.manifest ? cloneJson(this.manifest) : null;
  }

  async writeManifest(manifest: AuxiliaryManifest): Promise<void> {
    this.manifest = cloneJson(manifest);
  }

  /** Test helper. */
  snapshot(): AuxiliaryManifest | null {
    return this.manifest ? cloneJson(this.manifest) : null;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
