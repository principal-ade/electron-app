/**
 * In-memory scope-manager model. Mirrors the on-disk canvas schema closely
 * but flattens it into a tree the UI can navigate without touching JSON Canvas
 * positioning details for reads.
 */

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EventAttributeSchema {
  type: string;
  required?: boolean;
  description?: string;
}

export interface EventRecord {
  name: string;
  severity?: 'INFO' | 'WARN' | 'ERROR';
  description?: string;
  attributes?: Record<string, EventAttributeSchema>;
}

export interface NamespaceRecord {
  /** Namespace key (e.g. "filetree"). Unique within a scope. */
  name: string;
  description: string;
  paths: string[];
  events: EventRecord[];
  /** Preserved canvas position so round-trips don't reflow the diagram. */
  position?: NodePosition;
  /** Hex color attached to the canvas node, if any. */
  color?: string;
  /** Stable canvas node id, preserved across writes. */
  nodeId?: string;
}

export interface ScopeRecord {
  /** Dotted scope name (e.g. "principal-view.cli"). Identity. */
  name: string;
  description?: string;
  paths: string[];
  /** Hex color from the .scopes.canvas node, if any. */
  color?: string;
  /** OTEL status from the .scopes.canvas node ("draft", "ready", etc.). */
  status?: string;
  /** Optional human-readable label override (defaults to `name`). */
  label?: string;
  namespaces: NamespaceRecord[];
  /** Preserved canvas position for the otel-scope node. */
  position?: NodePosition;
  /** Stable canvas node id, preserved across writes. */
  nodeId?: string;
}

export interface ScopeWorkspace {
  scopes: ScopeRecord[];
}

export interface AddScopeInput {
  name: string;
  description?: string;
  paths?: string[];
  color?: string;
  status?: string;
  label?: string;
}

export interface AddNamespaceInput {
  scopeName: string;
  name: string;
  description?: string;
  paths?: string[];
  color?: string;
}

export interface AddPathToNamespaceInput {
  scopeName: string;
  namespaceName: string;
  path: string;
}

export interface AddEventInput {
  scopeName: string;
  namespaceName: string;
  name: string;
  severity?: 'INFO' | 'WARN' | 'ERROR';
  description?: string;
  attributes?: Record<string, EventAttributeSchema>;
}

/**
 * Errors thrown by the model layer when an operation violates an invariant
 * (duplicate names, missing parents, etc.).
 */
export class ScopeManagerError extends Error {
  constructor(
    message: string,
    public code:
      | 'duplicate-scope'
      | 'duplicate-namespace'
      | 'duplicate-event'
      | 'missing-scope'
      | 'missing-namespace'
      | 'invalid-input',
  ) {
    super(message);
    this.name = 'ScopeManagerError';
  }
}
