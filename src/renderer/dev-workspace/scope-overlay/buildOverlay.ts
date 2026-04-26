/**
 * Pure derivation: turn the current ScopeSelection + workspace scopes into
 * the props FileCity3D needs to render scope overlays.
 *
 * Scope/namespace paths flow through verbatim. They live on disk repo-relative
 * (per the canvas schema) and `LayerItem.path` is documented the same way, so
 * no prefix translation is required — building paths emitted by
 * buildCityDataFromContext are repo-relative too.
 */

import { createFileHighlightLayers } from '@principal-ai/file-city-builder';
import type { HighlightLayer } from '@principal-ai/file-city-react';
import type { ScopeRecord } from '../../services/scope-manager';
import type { ScopeSelection } from './ScopeOverlaySelectionContext';

export interface OverlayState {
  focusDirectory: string | null;
  highlightLayers: HighlightLayer[];
}

export interface BuildOverlayInput {
  selection: ScopeSelection | null;
  scopes: readonly ScopeRecord[];
  /**
   * Live city buildings. Required for extension-colored layers when a scope
   * is shown "open" (no namespace selected) — we resolve the scope's claimed
   * paths to a concrete file list and color each by suffix.
   */
  buildings?: readonly { path: string }[];
}

const DEFAULT_NAMESPACE_COLOR = '#a855f7';

const EMPTY: OverlayState = { focusDirectory: null, highlightLayers: [] };

export function buildOverlay({
  selection,
  scopes,
  buildings,
}: BuildOverlayInput): OverlayState {
  if (!selection) return EMPTY;
  const scope = scopes.find((s) => s.name === selection.scopeName);
  if (!scope) return EMPTY;

  return {
    focusDirectory: pickFocusDirectory(scope, selection),
    highlightLayers: pickHighlightLayers(scope, selection, buildings),
  };
}

function pickFocusDirectory(
  scope: ScopeRecord,
  selection: ScopeSelection,
): string | null {
  if (selection.namespaceName) {
    const ns = scope.namespaces.find((n) => n.name === selection.namespaceName);
    if (ns?.paths[0]) return normalizePath(ns.paths[0]);
  }
  if (scope.paths[0]) return normalizePath(scope.paths[0]);
  return null;
}

/** FileCity3D directory-matches with `path.startsWith(item.path + '/')` so a
 *  trailing slash on `item.path` breaks the match. Strip defensively. */
function normalizePath(p: string): string {
  let out = p.trim();
  while (out.endsWith('/') && out.length > 1) out = out.slice(0, -1);
  return out;
}

function pickHighlightLayers(
  scope: ScopeRecord,
  selection: ScopeSelection,
  buildings: readonly { path: string }[] | undefined,
): HighlightLayer[] {
  // Namespace selected: keep the single-color directory fill so the focused
  // namespace stands out cleanly.
  if (selection.namespaceName) {
    const ns = scope.namespaces.find((n) => n.name === selection.namespaceName);
    if (!ns || ns.paths.length === 0) return [];
    return [
      {
        id: `${scope.name}::${ns.name}`,
        name: ns.name,
        enabled: true,
        color: ns.color ?? DEFAULT_NAMESPACE_COLOR,
        opacity: 0.55,
        priority: pathDepthPriority(ns.paths),
        items: ns.paths.map((p) => ({
          type: 'directory' as const,
          path: normalizePath(p),
          renderStrategy: 'fill' as const,
        })),
      },
    ];
  }

  // Scope selected (open view): color each in-scope file by its extension.
  // Every path the scope claims — whether scope-level or under a namespace —
  // contributes its files. createFileHighlightLayers groups by suffix and
  // emits the standard file-color layers used elsewhere in the city.
  const claimed = new Set<string>();
  for (const p of scope.paths) claimed.add(normalizePath(p));
  for (const ns of scope.namespaces) {
    for (const p of ns.paths) claimed.add(normalizePath(p));
  }
  if (claimed.size === 0 || !buildings) return [];

  const claimedArr = Array.from(claimed);
  const matched = buildings.filter((b) =>
    claimedArr.some((c) => b.path === c || b.path.startsWith(c + '/')),
  );
  if (matched.length === 0) return [];

  return createFileHighlightLayers(matched).highlightLayers;
}

function pathDepthPriority(paths: readonly string[]): number {
  let max = 1;
  for (const p of paths) {
    const depth = normalizePath(p).split('/').length;
    if (depth > max) max = depth;
  }
  return max;
}
