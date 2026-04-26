/**
 * Pure derivation: turn the current ScopeSelection + workspace scopes +
 * city districts into the ElevatedScopePanel[] FileCity3D renders as floating
 * slabs above the flat city.
 *
 * Drilldown semantics:
 *   - selection = null
 *       → umbrella slab per scope-level path (one per scope)
 *   - selection = { scopeName }
 *       → that scope's namespace slabs (other scopes still show umbrellas)
 *   - selection = { scopeName, namespaceName }
 *       → same as above, but the *selected* namespace's slab is dropped so
 *         the buildings underneath show through.
 *
 * Slab clicks bubble back through the supplied `setSelection` so clicking a
 * slab moves the active selection one level deeper.
 */

import type { CityDistrict, ElevatedScopePanel } from '@principal-ai/file-city-react';
import type { ScopeRecord } from '../../services/scope-manager';
import type { ScopeSelection } from './ScopeOverlaySelectionContext';

const DEFAULT_NAMESPACE_COLOR = '#a855f7';
const DEFAULT_SCOPE_COLOR = '#3b82f6';
const SLAB_HEIGHT = 4;
const SLAB_THICKNESS = 2;

export interface BuildElevatedPanelsInput {
  selection: ScopeSelection | null;
  scopes: readonly ScopeRecord[];
  districts: readonly CityDistrict[] | undefined;
  /** Called when a slab is clicked. */
  setSelection?: (next: ScopeSelection | null) => void;
}

export function buildElevatedPanels({
  selection,
  scopes,
  districts,
  setSelection,
}: BuildElevatedPanelsInput): ElevatedScopePanel[] {
  if (!districts || districts.length === 0) return [];
  const districtByPath = new Map<string, CityDistrict>();
  for (const d of districts) {
    districtByPath.set(d.path, d);
  }

  const panels: ElevatedScopePanel[] = [];

  for (const scope of scopes) {
    const isScopeSelected = selection?.scopeName === scope.name;

    if (!isScopeSelected) {
      // Umbrella slab(s) for the scope. One per scope-level path.
      for (const sp of scope.paths) {
        const district = districtByPath.get(normalizePath(sp));
        if (!district) continue;
        panels.push({
          id: `${scope.name}::scope::${sp}`,
          color: scope.color ?? DEFAULT_SCOPE_COLOR,
          height: SLAB_HEIGHT,
          thickness: SLAB_THICKNESS,
          bounds: district.worldBounds,
          label: scope.name,
          onClick: setSelection
            ? () => setSelection({ scopeName: scope.name })
            : undefined,
        });
      }
      continue;
    }

    // Scope is selected — render its namespaces as slabs (skipping the one
    // that's drilled into).
    for (const ns of scope.namespaces) {
      if (selection?.namespaceName === ns.name) continue;
      for (const np of ns.paths) {
        const district = districtByPath.get(normalizePath(np));
        if (!district) continue;
        panels.push({
          id: `${scope.name}::${ns.name}::${np}`,
          color: ns.color ?? DEFAULT_NAMESPACE_COLOR,
          height: SLAB_HEIGHT,
          thickness: SLAB_THICKNESS,
          bounds: district.worldBounds,
          label: ns.name,
          onClick: setSelection
            ? () =>
                setSelection({
                  scopeName: scope.name,
                  namespaceName: ns.name,
                })
            : undefined,
        });
      }
    }
  }

  return panels;
}

/** Mirrors buildOverlay.normalizePath — trailing-slash stripping, etc. */
function normalizePath(p: string): string {
  let out = p.trim();
  while (out.endsWith('/') && out.length > 1) out = out.slice(0, -1);
  return out;
}
