/**
 * ScopeManager — authoring orchestrator on top of a ScopeStore.
 *
 * Responsibilities:
 *  - Load .scopes.canvas + every <scope>.events.canvas into a unified
 *    in-memory ScopeWorkspace.
 *  - Apply pure mutations from `model.ts`.
 *  - Persist the affected canvas file(s) back to the store.
 *  - Notify subscribers so the UI can re-render.
 *
 * Designed to lift cleanly into principal-view-core-library: the only
 * environment dependency is the injected ScopeStore.
 */

import {
  parseEventsCanvas,
  parseScopesCanvas,
  serializeEventsCanvas,
  serializeScopesCanvas,
  type RawCanvas,
} from './canvasIo';
import {
  addEvent,
  addNamespace,
  addPathToNamespace,
  addPathToScope,
  addScope,
  emptyWorkspace,
  findNamespace,
  findScope,
  removeNamespace,
  removeScope,
} from './model';
import type { EventsCanvasFile, ScopeStore } from './ScopeStore';
import type {
  AddEventInput,
  AddNamespaceInput,
  AddPathToNamespaceInput,
  AddScopeInput,
  ScopeRecord,
  ScopeWorkspace,
} from './types';

/**
 * Composite operation: attach `paths` to a scope (creating it if missing)
 * and optionally a namespace (creating that if missing). Maintains the
 * invariant that every namespace path is covered by some scope path.
 */
export interface AddToScopeInput {
  scopeName: string;
  /** Omit/blank to add paths at the scope level. */
  namespaceName?: string;
  paths: string[];
  /** Used only when creating a new scope. */
  description?: string;
  /**
   * Used only when creating a new namespace. Existing namespaces keep their
   * color. Callers that care about uniqueness should compute this from the
   * current workspace before calling.
   */
  namespaceColor?: string;
}

type Listener = (workspace: ScopeWorkspace) => void;

interface CanvasState {
  scopesCanvas: RawCanvas | null;
  /** Per-scope events canvas (keyed by dotted scope name). */
  eventsCanvases: Map<string, RawCanvas>;
}

export class ScopeManager {
  private workspace: ScopeWorkspace = emptyWorkspace();
  private canvases: CanvasState = {
    scopesCanvas: null,
    eventsCanvases: new Map(),
  };
  private listeners = new Set<Listener>();
  private loaded = false;

  constructor(private readonly store: ScopeStore) {}

  // ---- read ----------------------------------------------------------------

  get scopes(): readonly ScopeRecord[] {
    return this.workspace.scopes;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  getWorkspace(): ScopeWorkspace {
    return this.workspace;
  }

  findScope(name: string): ScopeRecord | undefined {
    return findScope(this.workspace, name);
  }

  // ---- lifecycle -----------------------------------------------------------

  async load(): Promise<void> {
    const [scopesCanvas, eventsFiles] = await Promise.all([
      this.store.readScopesCanvas(),
      this.store.listEventsCanvases(),
    ]);

    this.canvases.scopesCanvas = scopesCanvas;
    this.canvases.eventsCanvases = new Map(
      eventsFiles.map((f) => [f.scopeName, f.canvas]),
    );

    const { scopes } = parseScopesCanvas(scopesCanvas);
    for (const scope of scopes) {
      const eventsCanvas = this.canvases.eventsCanvases.get(scope.name);
      if (!eventsCanvas) continue;
      const { namespaces } = parseEventsCanvas(eventsCanvas);
      scope.namespaces = namespaces;
    }

    this.workspace = { scopes };
    this.loaded = true;
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- mutations -----------------------------------------------------------

  async addScope(input: AddScopeInput): Promise<void> {
    const next = addScope(this.workspace, input);
    this.workspace = next;
    await this.persistScopesCanvas();
    // New scopes get an empty events.canvas so namespaces can be appended later.
    await this.persistEventsCanvas(input.name.trim());
    this.emit();
  }

  /**
   * One-shot path attachment that handles all five cases the AddToScope UI
   * exposes: brand-new scope, new scope+namespace, add-to-existing-scope,
   * new namespace on existing scope, add-path on existing namespace.
   *
   * Path duplicates are silently deduped by the model layer, so this is safe
   * to call repeatedly with the same input.
   */
  async addToScope(input: AddToScopeInput): Promise<void> {
    const scopeName = input.scopeName.trim();
    const namespaceName = input.namespaceName?.trim() || undefined;
    const paths = input.paths.map((p) => p.trim()).filter(Boolean);
    if (!scopeName) {
      throw new Error('addToScope: scopeName is required');
    }

    let next = this.workspace;
    let scopesCanvasDirty = false;

    if (!findScope(next, scopeName)) {
      // Brand-new scope. Seed with paths whether or not a namespace is set —
      // the invariant requires scope.paths to cover anything its namespaces
      // claim.
      next = addScope(next, {
        name: scopeName,
        description: input.description,
        paths,
      });
      scopesCanvasDirty = true;
    } else if (!namespaceName) {
      // Add scope-level paths.
      for (const p of paths) {
        const before = next;
        next = addPathToScope(next, scopeName, p);
        if (before !== next) scopesCanvasDirty = true;
      }
    }

    if (namespaceName) {
      if (!findNamespace(next, scopeName, namespaceName)) {
        next = addNamespace(next, {
          scopeName,
          name: namespaceName,
          paths,
          color: input.namespaceColor,
        });
      } else {
        for (const p of paths) {
          next = addPathToNamespace(next, {
            scopeName,
            namespaceName,
            path: p,
          });
        }
      }
      // Maintain the "scope.paths covers ns.paths" invariant.
      for (const p of paths) {
        if (!isCoveredByScope(next, scopeName, p)) {
          next = addPathToScope(next, scopeName, p);
          scopesCanvasDirty = true;
        }
      }
    }

    if (next === this.workspace) return; // no-op (everything already there)

    this.workspace = next;
    if (scopesCanvasDirty) await this.persistScopesCanvas();
    await this.persistEventsCanvas(scopeName);
    this.emit();
  }

  async addNamespace(input: AddNamespaceInput): Promise<void> {
    this.workspace = addNamespace(this.workspace, input);
    await this.persistEventsCanvas(input.scopeName);
    this.emit();
  }

  async addPathToNamespace(input: AddPathToNamespaceInput): Promise<void> {
    this.workspace = addPathToNamespace(this.workspace, input);
    await this.persistEventsCanvas(input.scopeName);
    this.emit();
  }

  async addPathToScope(scopeName: string, path: string): Promise<void> {
    this.workspace = addPathToScope(this.workspace, scopeName, path);
    await this.persistScopesCanvas();
    this.emit();
  }

  async addEvent(input: AddEventInput): Promise<void> {
    this.workspace = addEvent(this.workspace, input);
    await this.persistEventsCanvas(input.scopeName);
    this.emit();
  }

  async removeScope(scopeName: string): Promise<void> {
    this.workspace = removeScope(this.workspace, scopeName);
    this.canvases.eventsCanvases.delete(scopeName);
    await Promise.all([
      this.persistScopesCanvas(),
      this.store.deleteEventsCanvas(scopeName),
    ]);
    this.emit();
  }

  async removeNamespace(
    scopeName: string,
    namespaceName: string,
  ): Promise<void> {
    this.workspace = removeNamespace(this.workspace, scopeName, namespaceName);
    await this.persistEventsCanvas(scopeName);
    this.emit();
  }

  // ---- persistence helpers -------------------------------------------------

  private async persistScopesCanvas(): Promise<void> {
    const next = serializeScopesCanvas(
      this.workspace.scopes,
      this.canvases.scopesCanvas,
    );
    this.canvases.scopesCanvas = next;
    await this.store.writeScopesCanvas(next);
  }

  private async persistEventsCanvas(scopeName: string): Promise<void> {
    const scope = findScope(this.workspace, scopeName);
    const namespaces = scope?.namespaces ?? [];
    const next = serializeEventsCanvas(
      scopeName,
      namespaces,
      this.canvases.eventsCanvases.get(scopeName),
    );
    this.canvases.eventsCanvases.set(scopeName, next);
    const file: EventsCanvasFile = { scopeName, canvas: next };
    await this.store.writeEventsCanvas(file);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.workspace);
    }
  }
}

function isCoveredByScope(
  workspace: ScopeWorkspace,
  scopeName: string,
  path: string,
): boolean {
  const scope = findScope(workspace, scopeName);
  if (!scope) return false;
  return scope.paths.some((p) => path === p || path.startsWith(p + '/'));
}
