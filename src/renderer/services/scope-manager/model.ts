/**
 * Pure mutators over the in-memory ScopeWorkspace model. No I/O — the
 * ScopeManager composes these with a ScopeStore to persist.
 *
 * All operations return a new workspace; the input is never mutated.
 */

import {
  ScopeManagerError,
  type AddEventInput,
  type AddNamespaceInput,
  type AddPathToNamespaceInput,
  type AddScopeInput,
  type NamespaceRecord,
  type ScopeRecord,
  type ScopeWorkspace,
} from './types';

export function emptyWorkspace(): ScopeWorkspace {
  return { scopes: [] };
}

export function findScope(
  workspace: ScopeWorkspace,
  scopeName: string,
): ScopeRecord | undefined {
  return workspace.scopes.find((s) => s.name === scopeName);
}

export function findNamespace(
  workspace: ScopeWorkspace,
  scopeName: string,
  namespaceName: string,
): NamespaceRecord | undefined {
  return findScope(workspace, scopeName)?.namespaces.find(
    (ns) => ns.name === namespaceName,
  );
}

function requireScope(
  workspace: ScopeWorkspace,
  scopeName: string,
): ScopeRecord {
  const scope = findScope(workspace, scopeName);
  if (!scope) {
    throw new ScopeManagerError(
      `Scope "${scopeName}" not found.`,
      'missing-scope',
    );
  }
  return scope;
}

function requireNamespace(
  scope: ScopeRecord,
  namespaceName: string,
): NamespaceRecord {
  const namespace = scope.namespaces.find((ns) => ns.name === namespaceName);
  if (!namespace) {
    throw new ScopeManagerError(
      `Namespace "${namespaceName}" not found on scope "${scope.name}".`,
      'missing-namespace',
    );
  }
  return namespace;
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

/**
 * Strip whitespace, trailing slashes, and any leading "./". A trailing slash
 * on a directory path silently breaks FileCity3D's directory match
 * (`path.startsWith(item.path + '/')`), so we normalise on the way in to
 * keep authoring tolerant.
 */
function normalizePath(input: string): string {
  let p = input.trim();
  if (!p) return '';
  while (p.startsWith('./')) p = p.slice(2);
  while (p.endsWith('/') && p.length > 1) p = p.slice(0, -1);
  return p;
}

export function addScope(
  workspace: ScopeWorkspace,
  input: AddScopeInput,
): ScopeWorkspace {
  const name = input.name.trim();
  if (!name) {
    throw new ScopeManagerError('Scope name is required.', 'invalid-input');
  }
  if (findScope(workspace, name)) {
    throw new ScopeManagerError(
      `Scope "${name}" already exists.`,
      'duplicate-scope',
    );
  }
  const next: ScopeRecord = {
    name,
    description: input.description?.trim() || undefined,
    paths: dedupePaths(input.paths ?? []),
    color: input.color,
    status: input.status,
    label: input.label?.trim() || undefined,
    namespaces: [],
  };
  return { ...workspace, scopes: [...workspace.scopes, next] };
}

export function addNamespace(
  workspace: ScopeWorkspace,
  input: AddNamespaceInput,
): ScopeWorkspace {
  const namespaceName = input.name.trim();
  if (!namespaceName) {
    throw new ScopeManagerError(
      'Namespace name is required.',
      'invalid-input',
    );
  }
  const scope = requireScope(workspace, input.scopeName);
  if (scope.namespaces.some((ns) => ns.name === namespaceName)) {
    throw new ScopeManagerError(
      `Namespace "${namespaceName}" already exists on scope "${scope.name}".`,
      'duplicate-namespace',
    );
  }
  const namespace: NamespaceRecord = {
    name: namespaceName,
    description: input.description?.trim() ?? '',
    paths: dedupePaths(input.paths ?? []),
    events: [],
    color: input.color,
  };
  return mapScope(workspace, scope.name, (s) => ({
    ...s,
    namespaces: [...s.namespaces, namespace],
  }));
}

export function addPathToNamespace(
  workspace: ScopeWorkspace,
  input: AddPathToNamespaceInput,
): ScopeWorkspace {
  const path = input.path.trim();
  if (!path) {
    throw new ScopeManagerError('Path is required.', 'invalid-input');
  }
  const scope = requireScope(workspace, input.scopeName);
  requireNamespace(scope, input.namespaceName);
  return mapNamespace(
    workspace,
    input.scopeName,
    input.namespaceName,
    (ns) => ({
      ...ns,
      paths: dedupePaths([...ns.paths, path]),
    }),
  );
}

export function addPathToScope(
  workspace: ScopeWorkspace,
  scopeName: string,
  path: string,
): ScopeWorkspace {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new ScopeManagerError('Path is required.', 'invalid-input');
  }
  requireScope(workspace, scopeName);
  return mapScope(workspace, scopeName, (s) => ({
    ...s,
    paths: dedupePaths([...s.paths, trimmed]),
  }));
}

export function addEvent(
  workspace: ScopeWorkspace,
  input: AddEventInput,
): ScopeWorkspace {
  const eventName = input.name.trim();
  if (!eventName) {
    throw new ScopeManagerError('Event name is required.', 'invalid-input');
  }
  const scope = requireScope(workspace, input.scopeName);
  const namespace = requireNamespace(scope, input.namespaceName);
  if (namespace.events.some((e) => e.name === eventName)) {
    throw new ScopeManagerError(
      `Event "${eventName}" already exists on namespace "${namespace.name}".`,
      'duplicate-event',
    );
  }
  return mapNamespace(workspace, scope.name, namespace.name, (ns) => ({
    ...ns,
    events: [
      ...ns.events,
      {
        name: eventName,
        severity: input.severity,
        description: input.description?.trim() || undefined,
        attributes: input.attributes,
      },
    ],
  }));
}

export function removeScope(
  workspace: ScopeWorkspace,
  scopeName: string,
): ScopeWorkspace {
  if (!findScope(workspace, scopeName)) {
    throw new ScopeManagerError(
      `Scope "${scopeName}" not found.`,
      'missing-scope',
    );
  }
  return {
    ...workspace,
    scopes: workspace.scopes.filter((s) => s.name !== scopeName),
  };
}

export function removeNamespace(
  workspace: ScopeWorkspace,
  scopeName: string,
  namespaceName: string,
): ScopeWorkspace {
  const scope = requireScope(workspace, scopeName);
  if (!scope.namespaces.some((ns) => ns.name === namespaceName)) {
    throw new ScopeManagerError(
      `Namespace "${namespaceName}" not found on scope "${scopeName}".`,
      'missing-namespace',
    );
  }
  return mapScope(workspace, scopeName, (s) => ({
    ...s,
    namespaces: s.namespaces.filter((ns) => ns.name !== namespaceName),
  }));
}

function mapScope(
  workspace: ScopeWorkspace,
  scopeName: string,
  fn: (scope: ScopeRecord) => ScopeRecord,
): ScopeWorkspace {
  return {
    ...workspace,
    scopes: workspace.scopes.map((s) => (s.name === scopeName ? fn(s) : s)),
  };
}

function mapNamespace(
  workspace: ScopeWorkspace,
  scopeName: string,
  namespaceName: string,
  fn: (namespace: NamespaceRecord) => NamespaceRecord,
): ScopeWorkspace {
  return mapScope(workspace, scopeName, (s) => ({
    ...s,
    namespaces: s.namespaces.map((ns) =>
      ns.name === namespaceName ? fn(ns) : ns,
    ),
  }));
}
