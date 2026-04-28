/**
 * AreaManager — authoring orchestrator on top of an `AreaStore`.
 *
 * Mirrors `ScopeManager`'s shape: load the manifest into a workspace, apply
 * pure mutations from `model.ts`, persist the affected file back to the
 * store, notify subscribers.
 *
 * Designed to lift cleanly into principal-view-core-library: the only
 * environment dependency is the injected `AreaStore`.
 */

import type { AreaStore } from './AreaStore';
import {
  addArea,
  addPathToArea,
  emptyWorkspace,
  findArea,
  removeArea,
  removePathFromArea,
} from './model';
import type {
  AddAreaInput,
  AddPathToAreaInput,
  AreaWorkspace,
  AuxiliaryManifest,
  ProjectArea,
} from './types';

type Listener = (workspace: AreaWorkspace) => void;

export class AreaManager {
  private workspace: AreaWorkspace = emptyWorkspace();
  /** Preserved so round-tripping doesn't strip unknown fields. */
  private manifest: AuxiliaryManifest | null = null;
  private listeners = new Set<Listener>();
  private loaded = false;

  constructor(private readonly store: AreaStore) {}

  // ---- read ----------------------------------------------------------------

  get areas(): readonly ProjectArea[] {
    return this.workspace.areas;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  getWorkspace(): AreaWorkspace {
    return this.workspace;
  }

  findArea(name: string): ProjectArea | undefined {
    return findArea(this.workspace, name);
  }

  // ---- lifecycle -----------------------------------------------------------

  async load(): Promise<void> {
    const manifest = await this.store.readManifest();
    this.manifest = manifest;
    this.workspace = { areas: manifest?.areas ? [...manifest.areas] : [] };
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

  async addArea(input: AddAreaInput): Promise<void> {
    this.workspace = addArea(this.workspace, input);
    await this.persist();
    this.emit();
  }

  async addPathToArea(input: AddPathToAreaInput): Promise<void> {
    this.workspace = addPathToArea(this.workspace, input);
    await this.persist();
    this.emit();
  }

  async removeArea(name: string): Promise<void> {
    this.workspace = removeArea(this.workspace, name);
    await this.persist();
    this.emit();
  }

  async removePathFromArea(areaName: string, path: string): Promise<void> {
    this.workspace = removePathFromArea(this.workspace, areaName, path);
    await this.persist();
    this.emit();
  }

  // ---- persistence ---------------------------------------------------------

  private async persist(): Promise<void> {
    const next: AuxiliaryManifest = {
      ...(this.manifest ?? {}),
      areas: [...this.workspace.areas],
    };
    this.manifest = next;
    await this.store.writeManifest(next);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.workspace);
    }
  }
}
