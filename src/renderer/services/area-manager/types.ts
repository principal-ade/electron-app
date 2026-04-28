/**
 * In-memory area-manager model. Mirrors the on-disk
 * `.principal-views/auxiliary.manifest.json` shape (an `AuxiliaryManifest`
 * from `@principal-ai/principal-view-core`) but exposes a flatter API the
 * UI can call.
 *
 * `ProjectArea` is re-exported as-is from principal-view-core — we don't
 * fork it. `AreaWorkspace` is a thin wrapper that mirrors `ScopeWorkspace`
 * for symmetry.
 */

import type {
  AuxiliaryManifest,
  ProjectArea,
} from '@principal-ai/principal-view-core';

export type { AuxiliaryManifest, ProjectArea };

/** Mirror of `ScopeWorkspace` for symmetry — what the manager exposes. */
export interface AreaWorkspace {
  areas: ProjectArea[];
}

export interface AddAreaInput {
  name: string;
  description?: string;
  paths?: string[];
}

export interface AddPathToAreaInput {
  areaName: string;
  path: string;
}

/** Thrown by the model layer when an operation violates an invariant. */
export class AreaManagerError extends Error {
  constructor(
    message: string,
    public code:
      | 'duplicate-area'
      | 'missing-area'
      | 'invalid-input'
      | 'overlaps-scope',
  ) {
    super(message);
    this.name = 'AreaManagerError';
  }
}
