/**
 * Local copies of the handful of `@principal-ai/principal-view-core` types and
 * guards the renderer used to depend on.
 *
 * We vendored these so the renderer no longer imports the pvc package at all.
 * Each is a faithful (at times intentionally permissive) copy of the upstream
 * definition — keep them in sync if the on-disk `.principal-views` formats
 * change.
 */

// ---------------------------------------------------------------------------
// Auxiliary manifest (`.principal-views/auxiliary.manifest.json`)
// ---------------------------------------------------------------------------

/**
 * One project area — a folder (or file) that supports the project outside the
 * OTEL telemetry surface.
 */
export interface ProjectArea {
  /** Display name. Must be unique across all areas in the manifest. */
  name: string;
  /**
   * One or more repo-relative paths owned by this area. Each entry may be a
   * folder (covers all descendants) or a specific file.
   */
  paths: string[];
  /** Free-text purpose — a sentence about why this folder exists. */
  description: string;
}

/** The full manifest document, persisted at `auxiliary.manifest.json`. */
export interface AuxiliaryManifest {
  /** Optional pointer to the JSON Schema that describes this file. */
  $schema?: string;
  /** Project areas declared in this manifest. */
  areas: ProjectArea[];
}

/**
 * Type guard: true when the value plausibly conforms to `AuxiliaryManifest`.
 * Shallow check — matches upstream pvc `isAuxiliaryManifest`.
 */
export function isAuxiliaryManifest(value: unknown): value is AuxiliaryManifest {
  if (!value || typeof value !== 'object') return false;
  const v = value as { areas?: unknown };
  return Array.isArray(v.areas);
}

// ---------------------------------------------------------------------------
// Canvas node types (`.scopes.canvas` / `<scope>.events.canvas`)
// ---------------------------------------------------------------------------

/**
 * Permissive canvas node. Real canvases carry a wide range of optional and
 * unknown fields, and the scope-manager reads most of them through loose casts,
 * so we keep this deliberately open.
 */
export interface ExtendedCanvasNode {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: string;
  color?: string;
  [key: string]: unknown;
}

/** A canvas document as loaded from disk. Extra top-level fields ride along. */
export interface ExtendedCanvas {
  name?: string;
  /** Nodes — JSON Canvas types and/or OTEL node types. */
  nodes?: ExtendedCanvasNode[];
  /** Edges between nodes. */
  edges?: unknown[];
  [key: string]: unknown;
}

/** An OTEL instrumentation-scope node (`type: 'otel-scope'`). */
export interface OtelScopeNode {
  id: string;
  type: 'otel-scope';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Display label shown on the canvas node. */
  label?: string;
  /** Fill color (hex string). */
  color?: string;
  /** Short description of this instrumentation scope. */
  description?: string;
  /** Optional source paths that define this scope's code region. */
  paths?: string[];
  /** OTEL metadata — scope name is required. */
  otel: {
    /** Scope name (maps to getTracer('scope-name')). */
    scope: string;
    /** Implementation status. */
    status?: string;
    /** Legacy location for the description. */
    description?: string;
  };
}

/** Type guard for OTEL scope nodes. */
export function isOtelScopeNode(node: { type?: unknown }): node is OtelScopeNode {
  return node?.type === 'otel-scope';
}
