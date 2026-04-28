import type { HighlightLayer } from '@principal-ai/file-city-react';
import type { ScopeRecord } from '../../../services/scope-manager/types';

export const NAMESPACE_PALETTE = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#14b8a6',
  '#a855f7',
  '#eab308',
];

/**
 * Fallback when a namespace has no `color` set on disk. Read sites use this
 * via `ns.color ?? DEFAULT_NAMESPACE_COLOR` so the UI can render every
 * namespace, including ones authored before colors were captured.
 */
export const DEFAULT_NAMESPACE_COLOR = NAMESPACE_PALETTE[0];

/** Colour used for area umbrella tiles and their picker swatches. */
export const AREA_PANEL_COLOR = '#64748b';

export function pickNamespaceColor(scopes: readonly ScopeRecord[]): string {
  const used = new Set(scopes.flatMap(s => s.namespaces.map(n => n.color)));
  return (
    NAMESPACE_PALETTE.find(c => !used.has(c)) ??
    NAMESPACE_PALETTE[scopes.length % NAMESPACE_PALETTE.length]
  );
}

/**
 * Build highlight layers for a scope: one fill layer per namespace plus a
 * border-only layer for scope-level paths. Priority is path depth (longest-
 * prefix wins) per the partition convention in docs/scope-namespace-overlay.md.
 *
 * `toCityPath` translates scope-relative paths back to city paths so
 * districts can be matched.
 */
export function buildLayersForScope(
  scope: ScopeRecord,
  toCityPath: (scopePath: string) => string,
): HighlightLayer[] {
  const layers: HighlightLayer[] = scope.namespaces.map(ns => {
    const maxDepth = Math.max(1, ...ns.paths.map(p => p.split('/').length));
    return {
      id: `${scope.name}::${ns.name}`,
      name: ns.name,
      enabled: true,
      color: ns.color ?? DEFAULT_NAMESPACE_COLOR,
      opacity: 0.55,
      priority: maxDepth,
      items: ns.paths.map(p => ({
        path: toCityPath(p),
        type: 'directory' as const,
        renderStrategy: 'fill' as const,
      })),
    };
  });
  if (scope.paths.length > 0) {
    layers.push({
      id: `${scope.name}::__scope__`,
      name: `${scope.name} (scope-level)`,
      enabled: true,
      color: '#64748b',
      opacity: 0.4,
      priority: 0,
      items: scope.paths.map(p => ({
        path: toCityPath(p),
        type: 'directory' as const,
        renderStrategy: 'fill' as const,
      })),
    });
  }
  return layers;
}
