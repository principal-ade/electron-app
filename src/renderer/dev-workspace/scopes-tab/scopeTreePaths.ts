import type { ScopeRecord } from '../../services/scope-manager';

/**
 * Sentinel leaves so empty scopes / namespaces still surface in the tree —
 * pierre/trees infers structure from paths, so directories without children
 * disappear unless a placeholder leaf keeps them populated.
 */
export const EMPTY_NS_SENTINEL = '(no namespaces)';
export const EMPTY_EVENTS_SENTINEL = '(no events)';

export interface ScopeTreeSelection {
  scopeName: string;
  namespaceName?: string;
  eventName?: string;
}

/**
 * Build canonical pierre/trees paths for the scope tree:
 * `<scope>/<namespace>/<event>`. Empty branches emit a sentinel leaf.
 */
export function buildScopeTreePaths(scopes: readonly ScopeRecord[]): string[] {
  const out: string[] = [];
  for (const scope of scopes) {
    if (scope.namespaces.length === 0) {
      out.push(`${scope.name}/${EMPTY_NS_SENTINEL}`);
      continue;
    }
    for (const ns of scope.namespaces) {
      if (ns.events.length === 0) {
        out.push(`${scope.name}/${ns.name}/${EMPTY_EVENTS_SENTINEL}`);
        continue;
      }
      for (const ev of ns.events) {
        out.push(`${scope.name}/${ns.name}/${ev.name}`);
      }
    }
  }
  return out;
}

export function parseScopeTreePath(path: string): ScopeTreeSelection {
  const [scopeName, namespaceName, eventName] = path.split('/');
  const result: ScopeTreeSelection = { scopeName };
  if (namespaceName && namespaceName !== EMPTY_NS_SENTINEL) {
    result.namespaceName = namespaceName;
  }
  if (eventName && eventName !== EMPTY_EVENTS_SENTINEL) {
    result.eventName = eventName;
  }
  return result;
}
