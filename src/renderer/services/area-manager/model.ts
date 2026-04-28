/**
 * Pure mutators over the in-memory `AreaWorkspace`. No I/O — `AreaManager`
 * composes these with an `AreaStore` to persist.
 *
 * Mirrors `services/scope-manager/model.ts` in shape so the two managers
 * feel symmetric to consumers.
 */

import {
  AreaManagerError,
  type AddAreaInput,
  type AddPathToAreaInput,
  type AreaWorkspace,
  type ProjectArea,
} from './types';

export function emptyWorkspace(): AreaWorkspace {
  return { areas: [] };
}

export function findArea(
  workspace: AreaWorkspace,
  name: string,
): ProjectArea | undefined {
  return workspace.areas.find((a) => a.name === name);
}

function requireArea(workspace: AreaWorkspace, name: string): ProjectArea {
  const area = findArea(workspace, name);
  if (!area) {
    throw new AreaManagerError(`Area "${name}" not found.`, 'missing-area');
  }
  return area;
}

function dedupePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const normalized = normalizePath(p);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizePath(input: string): string {
  let p = input.trim();
  if (!p) return '';
  while (p.startsWith('./')) p = p.slice(2);
  while (p.endsWith('/') && p.length > 1) p = p.slice(0, -1);
  return p;
}

export function addArea(
  workspace: AreaWorkspace,
  input: AddAreaInput,
): AreaWorkspace {
  const name = input.name.trim();
  if (!name) {
    throw new AreaManagerError('Area name is required.', 'invalid-input');
  }
  if (findArea(workspace, name)) {
    throw new AreaManagerError(
      `Area "${name}" already exists.`,
      'duplicate-area',
    );
  }
  const next: ProjectArea = {
    name,
    description: input.description?.trim() ?? '',
    paths: dedupePaths(input.paths ?? []),
  };
  return { ...workspace, areas: [...workspace.areas, next] };
}

export function addPathToArea(
  workspace: AreaWorkspace,
  input: AddPathToAreaInput,
): AreaWorkspace {
  const path = input.path.trim();
  if (!path) {
    throw new AreaManagerError('Path is required.', 'invalid-input');
  }
  requireArea(workspace, input.areaName);
  return mapArea(workspace, input.areaName, (a) => ({
    ...a,
    paths: dedupePaths([...a.paths, path]),
  }));
}

export function removeArea(
  workspace: AreaWorkspace,
  name: string,
): AreaWorkspace {
  if (!findArea(workspace, name)) {
    throw new AreaManagerError(`Area "${name}" not found.`, 'missing-area');
  }
  return {
    ...workspace,
    areas: workspace.areas.filter((a) => a.name !== name),
  };
}

export function removePathFromArea(
  workspace: AreaWorkspace,
  areaName: string,
  path: string,
): AreaWorkspace {
  requireArea(workspace, areaName);
  return mapArea(workspace, areaName, (a) => ({
    ...a,
    paths: a.paths.filter((p) => p !== path),
  }));
}

function mapArea(
  workspace: AreaWorkspace,
  areaName: string,
  fn: (area: ProjectArea) => ProjectArea,
): AreaWorkspace {
  return {
    ...workspace,
    areas: workspace.areas.map((a) => (a.name === areaName ? fn(a) : a)),
  };
}
