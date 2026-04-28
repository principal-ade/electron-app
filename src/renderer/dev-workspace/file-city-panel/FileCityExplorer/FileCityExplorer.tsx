import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  FileTree,
  useFileTree,
  useFileTreeSelector,
  type UseFileTreeResult,
} from '@pierre/trees/react';
import type { FileTreeDirectoryHandle, FileTreeItemHandle } from '@pierre/trees';

import {
  FileCity3D,
  buildFolderElevatedPanels,
  buildFolderIndex,
  type CityData,
  type CityDistrict,
  type ElevatedScopePanel,
  type HighlightLayer,
} from '@principal-ai/file-city-react';
import type { ProjectArea } from '@principal-ai/principal-view-core';

import { useScopeManagerOptional } from '../../scope-manager-provider';
import { useAreaManagerOptional } from '../../area-manager-provider';
import type {
  NamespaceRecord,
  ScopeRecord,
} from '../../../services/scope-manager/types';
import { AddToAreaModal } from './AddToAreaModal';
import { AddToScopeModal } from './AddToScopeModal';
import { ScopeInfoOverlay } from './ScopeInfoOverlay';
import {
  AREA_PANEL_COLOR,
  DEFAULT_NAMESPACE_COLOR,
  buildLayersForScope,
  pickNamespaceColor,
} from './layers';
import { createPathConverters } from './pathConversion';
import {
  buildScopeTreePaths,
  parseScopeTreePath,
  type ScopeTreeSelection,
} from './scopeTreePaths';
import { makeSectionLabelStyle, withAlpha } from './styles';

type FileTreeModel = UseFileTreeResult['model'];

// Stable empty fallbacks so memos that depend on `scopes`/`areas` don't
// re-fire on every render when the provider isn't mounted.
const EMPTY_SCOPES: readonly ScopeRecord[] = [];
const EMPTY_AREAS: readonly ProjectArea[] = [];

/**
 * Trees library returns directory selections with a trailing slash
 * (`packages/server/`) but our `cityDirectories` set stores them
 * without one (`packages/server`). Normalise on the way in.
 */
function stripTrailingSlash(p: string | undefined): string {
  if (!p) return '';
  return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
}

/**
 * Mirror of principal-view-core's `validateAreaScopeDisjoint` — areas and
 * scopes must partition the filesystem, neither side may claim a path the
 * other already covers (or sits underneath). The upstream validator lives
 * on the node entrypoint so we can't import it from the renderer.
 */
function pathConflictsWithScopes(
  path: string,
  scopes: readonly ScopeRecord[],
): boolean {
  const allScopePaths = scopes.flatMap((s) => [
    ...s.paths,
    ...s.namespaces.flatMap((ns) => ns.paths),
  ]);
  return allScopePaths.some(
    (sp) =>
      sp === path || path.startsWith(sp + '/') || sp.startsWith(path + '/'),
  );
}

/**
 * Narrow a `FileTreeItemHandle` to its directory variant. The library's
 * `isDirectory()` method returns `true`/`false` literals but isn't a
 * `this is X` predicate, so callers can't use it to access directory-only
 * methods (`expand`, `collapse`, `toggle`) without help.
 */
function asDir(
  handle: FileTreeItemHandle | null | undefined,
): FileTreeDirectoryHandle | null {
  return handle && handle.isDirectory() ? (handle as FileTreeDirectoryHandle) : null;
}

export interface FileCityExplorerProps {
  /** City data to render in the 3D canvas. */
  cityData: CityData;
  /**
   * Prefix that scopes/namespace paths are stripped of when read out of
   * `cityData` (e.g. `'electron-app/'`). Pass `''` if the city data is already
   * rooted at the project root.
   */
  packageRoot: string;
  /**
   * Initial focused directory (city path). Defaults to the city root derived
   * from `packageRoot` (with trailing slash stripped).
   */
  initialFocusDirectory?: string | null;
  /**
   * Fired when the user wants to open a file — either by clicking a
   * building in the 3D canvas or by selecting a file leaf in the left
   * file tree. The wrapper panel hooks this up to the panel-framework
   * `file:open` event so editors and terminals can react.
   */
  onFileOpen?: (cityPath: string) => void;
  /**
   * Repo label shown in the path header when no directory is focused (e.g.
   * `"owner/repo"`). Used purely for display; doesn't affect path
   * conversion or city geometry.
   */
  repoLabel?: string | null;
}

export const FileCityExplorer: React.FC<FileCityExplorerProps> = ({
  cityData,
  packageRoot,
  initialFocusDirectory,
  onFileOpen,
  repoLabel,
}) => {
  const { theme } = useTheme();
  const sectionLabelStyle = makeSectionLabelStyle(theme);

  // City root without trailing slash — used as the iterative-zoom-out clamp
  // and the default initial focus.
  const packageRootClamp = React.useMemo(
    () => (packageRoot.endsWith('/') ? packageRoot.slice(0, -1) : packageRoot),
    [packageRoot],
  );

  const { toScopePath, toCityPath } = React.useMemo(
    () => createPathConverters(packageRoot),
    [packageRoot],
  );

  // City-derived lookups — recomputed only if `cityData` changes.
  const cityPaths = React.useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const b of cityData.buildings) set.add(b.path);
    return Array.from(set).sort();
  }, [cityData]);

  const cityDirectories = React.useMemo<Set<string>>(
    () => new Set(cityData.districts.map(d => d.path)),
    [cityData],
  );
  // Mirror in a ref so the `useFileTree` callbacks (frozen at first
  // render) can read the latest set without recapturing.
  const cityDirectoriesRef = React.useRef(cityDirectories);
  React.useEffect(() => {
    cityDirectoriesRef.current = cityDirectories;
  }, [cityDirectories]);

  // Set of building (file) paths — the only paths it's meaningful to
  // emit as `file:open`. Mirrored in a ref for the same reason as
  // `cityDirectoriesRef`.
  const cityFilesRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    cityFilesRef.current = new Set(cityData.buildings.map((b) => b.path));
  }, [cityData]);

  const districtsByPath = React.useMemo<Map<string, CityDistrict>>(
    () => new Map(cityData.districts.map(d => [d.path, d])),
    [cityData],
  );

  const folderIndex = React.useMemo(() => buildFolderIndex(cityData), [cityData]);

  // Scope and area state come from the dev-workspace providers; mutations
  // round-trip through .principal-views/ on disk via the managers. The panel
  // can still render without a provider mounted (storybook) — in that case
  // the +Add buttons no-op.
  const scopeCtx = useScopeManagerOptional();
  const areaCtx = useAreaManagerOptional();
  const scopes = scopeCtx?.workspace.scopes ?? EMPTY_SCOPES;
  const areas = areaCtx?.workspace.areas ?? EMPTY_AREAS;

  const [focusDirectory, setFocusDirectory] = React.useState<string | null>(
    initialFocusDirectory !== undefined ? initialFocusDirectory : packageRootClamp,
  );
  const [focusPinned, setFocusPinned] = React.useState(false);
  // While pinned, tree/scope selections must not change focusDirectory.
  // Wrapping the setter (rather than gating each call site) keeps the pin
  // honoured even from event handlers we add later.
  const focusPinnedRef = React.useRef(focusPinned);
  React.useEffect(() => {
    focusPinnedRef.current = focusPinned;
  }, [focusPinned]);
  // Keep a ref to focusDirectory so event handlers (e.g. the city's
  // double-click handler) can branch on it without taking a hard dep
  // and re-rebuilding folder panels on every focus change.
  const focusDirectoryRef = React.useRef(focusDirectory);
  React.useEffect(() => {
    focusDirectoryRef.current = focusDirectory;
  }, [focusDirectory]);
  const setFocusDirectoryIfUnpinned = React.useCallback(
    (next: string | null) => {
      if (focusPinnedRef.current) return;
      setFocusDirectory(next);
    },
    [],
  );
  const [selectedPanelFolder, setSelectedPanelFolder] = React.useState<string | null>(null);
  // Mirrored in a ref so the contents-tree `useFileTree` callback (frozen
  // at first render) can re-prefix stripped paths back to full city paths.
  const selectedPanelFolderRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    selectedPanelFolderRef.current = selectedPanelFolder;
  }, [selectedPanelFolder]);
  const [showPanelFolderContents, setShowPanelFolderContents] = React.useState(false);
  const [showAddPicker, setShowAddPicker] = React.useState(false);
  const addPickerRef = React.useRef<HTMLDivElement | null>(null);
  // Close the +Add picker on any click outside of it. Listens at the
  // document level so clicks anywhere — canvas, header, other overlays —
  // dismiss the menu just like a native dropdown.
  React.useEffect(() => {
    if (!showAddPicker) return;
    const onPointerDown = (e: MouseEvent) => {
      if (addPickerRef.current?.contains(e.target as Node)) return;
      setShowAddPicker(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showAddPicker]);
  // Anchor for the top-right "Hidden parent layers" panel: tracks the
  // most-recently-interacted folder so the panel always shows the chain of
  // expanded ancestors up from the user's current focus. Updated by
  // umbrella clicks, building clicks, and file tree selections.
  const [parentLayersAnchor, setParentLayersAnchor] = React.useState<string | null>(null);
  // When true, the panel is hidden until the next folder interaction.
  const [parentLayersDismissed, setParentLayersDismissed] = React.useState(false);

  // Sub-tree of paths under the currently selected panel folder. Computed
  // on demand so we only rebuild when the user actually opens the contents
  // view. Paths are stripped of the folder prefix so the tree renders rooted
  // at the folder itself.
  const panelFolderContentsPaths = React.useMemo(() => {
    if (!selectedPanelFolder || !showPanelFolderContents) return [] as string[];
    const prefix = selectedPanelFolder + '/';
    return cityPaths.filter(p => p.startsWith(prefix))
      .map(p => p.slice(prefix.length))
      .sort();
  }, [selectedPanelFolder, showPanelFolderContents, cityPaths]);

  const initialPanelFolderPaths = React.useRef<string[]>([]);
  const { model: panelFolderContentsTreeModel } = useFileTree({
    paths: initialPanelFolderPaths.current,
    search: true,
    onSelectionChange: (paths) => {
      const selected = stripTrailingSlash(paths[0]);
      if (!selected) return;
      const folder = selectedPanelFolderRef.current;
      if (!folder) return;
      // Paths in this tree are stripped of `${selectedPanelFolder}/`; rebuild
      // the full city path before firing the open event.
      const fullCityPath = `${folder}/${selected}`;
      // Only emit for actual building (file) paths — directory selections
      // just navigate inside the contents tree.
      if (!cityFilesRef.current.has(fullCityPath)) return;
      onFileOpenRef.current?.(fullCityPath);
    },
  });

  // Keep the sub-tree in sync as the selected folder or visibility changes.
  React.useEffect(() => {
    panelFolderContentsTreeModel.resetPaths(panelFolderContentsPaths);
  }, [panelFolderContentsTreeModel, panelFolderContentsPaths]);

  const [scopeSelection, setScopeSelection] = React.useState<ScopeTreeSelection | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [scopeModalTargetPath, setScopeModalTargetPath] = React.useState<string | null>(null);
  const [modalScopeId, setModalScopeId] = React.useState('');
  const [modalNamespaceName, setModalNamespaceName] = React.useState('');
  const [showAddAreaModal, setShowAddAreaModal] = React.useState(false);
  const [areaModalTargetPath, setAreaModalTargetPath] = React.useState<string | null>(null);
  const [modalAreaName, setModalAreaName] = React.useState('');
  const [modalAreaDescription, setModalAreaDescription] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'files' | 'scopes'>('files');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchInputFocused, setSearchInputFocused] = React.useState(false);

  // Substring search over building paths. Case-insensitive, no debounce — the
  // city's render path handles the per-keystroke layer churn fine for now.
  // Returns the matched paths so the highlight layer below can fill them in.
  const searchResults = React.useMemo<string[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const matches: string[] = [];
    for (const b of cityData.buildings) {
      if (b.path.toLowerCase().includes(q)) matches.push(b.path);
    }
    return matches;
  }, [searchQuery, cityData]);

  const searchHighlightLayer = React.useMemo<HighlightLayer | null>(() => {
    if (searchResults.length === 0) return null;
    return {
      id: 'search-results',
      name: 'Search Results',
      enabled: true,
      color: '#3b82f6',
      priority: 900,
      opacity: 0.9,
      items: searchResults.map((path) => ({
        path,
        type: 'file',
        renderStrategy: 'fill',
      })),
    };
  }, [searchResults]);

  const searchPanelOpen = searchQuery.trim().length > 0;

  // Hovered search result → its own one-item highlight layer at a slightly
  // higher priority than the bulk search layer, so the hovered building reads
  // as the "currently aimed at" hit while the rest stay blue.
  const [hoveredSearchResult, setHoveredSearchResult] = React.useState<string | null>(null);
  const hoveredSearchHighlightLayer = React.useMemo<HighlightLayer | null>(() => {
    if (!hoveredSearchResult) return null;
    return {
      id: 'search-results-hover',
      name: 'Hovered search result',
      enabled: true,
      color: theme.colors.warning,
      priority: 950,
      opacity: 1,
      items: [
        {
          path: hoveredSearchResult,
          type: 'file',
          renderStrategy: 'fill',
        },
      ],
    };
  }, [hoveredSearchResult, theme]);

  const initialCityPaths = React.useRef(cityPaths);
  const { model: treeModel } = useFileTree({
    paths: initialCityPaths.current,
    search: true,
    initialExpandedPaths: [],
    onSelectionChange: paths => {
      const selected = stripTrailingSlash(paths[0]);
      if (!selected) {
        setFocusDirectoryIfUnpinned(null);
        return;
      }
      // Selecting a directory focuses the city on it; selecting a file
      // additionally fires `onFileOpen` so the wrapper can emit
      // `file:open` to the panel framework — matches building clicks in
      // the 3D city.
      if (cityDirectoriesRef.current.has(selected)) {
        setFocusDirectoryIfUnpinned(selected);
        setParentLayersAnchor(selected);
        setParentLayersDismissed(false);
        return;
      }
      // Only emit on actual file paths (buildings). Anything else
      // (synthetic tree nodes, unknown paths) just adjusts focus.
      if (cityFilesRef.current.has(selected)) {
        onFileOpenRef.current?.(selected);
      }
      const parts = selected.split('/');
      while (parts.length > 1) {
        parts.pop();
        const candidate = parts.join('/');
        if (cityDirectories.has(candidate)) {
          setFocusDirectoryIfUnpinned(candidate);
          setParentLayersAnchor(selected);
          setParentLayersDismissed(false);
          return;
        }
      }
      setFocusDirectoryIfUnpinned(null);
    },
  });

  const scopeTreePaths = React.useMemo(() => buildScopeTreePaths(scopes), [scopes]);
  const initialScopeTreePaths = React.useRef(scopeTreePaths);
  const initialExpandedScopeIds = React.useRef(scopes.map(s => s.name));
  const { model: scopeTreeModel } = useFileTree({
    paths: initialScopeTreePaths.current,
    search: true,
    initialExpandedPaths: initialExpandedScopeIds.current,
    onSelectionChange: paths => {
      const selected = paths[0];
      if (!selected) {
        setScopeSelection(null);
        return;
      }
      const parsed = parseScopeTreePath(selected);
      setScopeSelection(parsed);

      // Selecting a namespace or event also focuses the city on the namespace's
      // first declared path; selecting a bare scope clears the focus.
      if (parsed.namespaceName) {
        const scope = scopes.find(s => s.name === parsed.scopeId);
        const ns = scope?.namespaces.find(n => n.name === parsed.namespaceName);
        if (ns?.paths[0]) setFocusDirectoryIfUnpinned(toCityPath(ns.paths[0]));
      } else {
        setFocusDirectoryIfUnpinned(null);
      }
    },
  });

  // Keep the scope tree's paths in sync as scopes mutate (the model is created
  // once; later option changes need resetPaths per @pierre/trees docs).
  const isFirstScopeTreeSync = React.useRef(true);
  const pendingExpand = React.useRef<string[]>([]);
  React.useEffect(() => {
    if (isFirstScopeTreeSync.current) {
      isFirstScopeTreeSync.current = false;
      return;
    }
    scopeTreeModel.resetPaths(scopeTreePaths);
    for (const dirPath of pendingExpand.current) {
      asDir(scopeTreeModel.getItem(dirPath))?.expand();
    }
    pendingExpand.current = [];
  }, [scopeTreeModel, scopeTreePaths]);

  // Track which scope/namespace nodes are expanded in the scope tree. The
  // city panels mirror this: a collapsed scope shows one umbrella tile, an
  // expanded scope shows per-namespace tiles, and an expanded namespace
  // hides its tile so the buildings underneath are visible.
  const treeExpansion = useFileTreeSelector(
    scopeTreeModel,
    React.useCallback(
      (model: FileTreeModel) => {
        const expandedScopes = new Set<string>();
        const expandedNamespaces = new Set<string>();
        for (const scope of scopes) {
          const scopeItem = asDir(model.getItem(scope.name));
          if (scopeItem && scopeItem.isExpanded()) {
            expandedScopes.add(scope.name);
            for (const ns of scope.namespaces) {
              const nsKey = `${scope.name}/${ns.name}`;
              const nsItem = asDir(model.getItem(nsKey));
              if (nsItem && nsItem.isExpanded()) {
                expandedNamespaces.add(nsKey);
              }
            }
          }
        }
        return { expandedScopes, expandedNamespaces };
      },
      [scopes],
    ),
    React.useCallback(
      (
        prev: { expandedScopes: Set<string>; expandedNamespaces: Set<string> },
        next: { expandedScopes: Set<string>; expandedNamespaces: Set<string> },
      ) => {
        if (prev.expandedScopes.size !== next.expandedScopes.size) return false;
        for (const k of prev.expandedScopes) if (!next.expandedScopes.has(k)) return false;
        if (prev.expandedNamespaces.size !== next.expandedNamespaces.size) return false;
        for (const k of prev.expandedNamespaces) if (!next.expandedNamespaces.has(k)) return false;
        return true;
      },
      [],
    ),
  );

  // Resolve the current scope tree selection into the underlying objects.
  const scopeInfo = React.useMemo(() => {
    if (!scopeSelection) return null;
    const scope = scopes.find(s => s.name === scopeSelection.scopeId);
    if (!scope) return null;
    const ns = scopeSelection.namespaceName
      ? scope.namespaces.find(n => n.name === scopeSelection.namespaceName) ?? null
      : null;
    const ev =
      ns && scopeSelection.eventName
        ? ns.events.find(e => e.name === scopeSelection.eventName) ?? null
        : null;
    return { scope, ns, ev };
  }, [scopeSelection, scopes]);

  // City highlight layers derive from the active tab:
  //   scopes tab → selected scope's namespace fills (+ scope-level borders)
  //   files tab  → border around the currently-selected folder
  const cityHighlightLayers = React.useMemo(() => {
    if (activeTab === 'scopes') {
      return scopeInfo ? buildLayersForScope(scopeInfo.scope, toCityPath) : undefined;
    }
    if (activeTab === 'files' && selectedPanelFolder) {
      return [
        {
          id: 'folder-selection',
          name: 'Selected folder',
          enabled: true,
          color: theme.colors.warning,
          priority: 1000,
          items: [
            {
              path: selectedPanelFolder,
              type: 'directory' as const,
              renderStrategy: 'border' as const,
            },
          ],
        },
      ];
    }
    return undefined;
  }, [activeTab, scopeInfo, toCityPath, selectedPanelFolder, theme]);

  // Elevated scope panels — driven by the scope tree's expansion state.
  // - Collapsed scope → one gray umbrella tile per scope path.
  // - Expanded scope, collapsed namespace → colored tile per namespace path.
  // - Expanded namespace → no tile (buildings show through).
  const cityElevatedPanels = React.useMemo<ElevatedScopePanel[] | undefined>(() => {
    if (activeTab !== 'scopes') return undefined;
    const panels: ElevatedScopePanel[] = [];

    for (const scope of scopes) {
      const isScopeExpanded = treeExpansion.expandedScopes.has(scope.name);

      if (!isScopeExpanded) {
        const onClick = () => asDir(scopeTreeModel.getItem(scope.name))?.toggle();
        for (const sp of scope.paths) {
          const district = districtsByPath.get(toCityPath(sp));
          if (!district) continue;
          panels.push({
            id: `${scope.name}::scope::${sp}`,
            color: theme.colors.textTertiary,
            height: 4,
            thickness: 2,
            bounds: district.worldBounds,
            label: scope.name,
            onClick,
          });
        }
        continue;
      }

      for (const ns of scope.namespaces) {
        const nsKey = `${scope.name}/${ns.name}`;
        if (treeExpansion.expandedNamespaces.has(nsKey)) continue;

        const onClick = () => asDir(scopeTreeModel.getItem(nsKey))?.toggle();
        for (const np of ns.paths) {
          const district = districtsByPath.get(toCityPath(np));
          if (!district) continue;
          panels.push({
            id: `${scope.name}::${ns.name}::${np}`,
            color: ns.color ?? DEFAULT_NAMESPACE_COLOR,
            height: 4,
            thickness: 2,
            bounds: district.worldBounds,
            label: ns.name,
            onClick,
          });
        }
      }
    }

    return panels.length > 0 ? panels : undefined;
  }, [activeTab, scopes, scopeTreeModel, treeExpansion, districtsByPath, toCityPath, theme]);

  // Track which folders are expanded in the file tree. The file-tree tab's
  // elevated panels mirror this: a collapsed folder shows one umbrella tile
  // covering every descendant district; expanding the folder reveals its
  // sub-folder tiles (or the buildings themselves at the leaves).
  const folderTreeExpansion = useFileTreeSelector(
    treeModel,
    React.useCallback((model: FileTreeModel) => {
      const expanded = new Set<string>();
      for (const dir of cityDirectories) {
        const item = asDir(model.getItem(dir));
        if (item && item.isExpanded()) expanded.add(dir);
      }
      return { expanded };
    }, [cityDirectories]),
    React.useCallback(
      (prev: { expanded: Set<string> }, next: { expanded: Set<string> }) => {
        if (prev.expanded.size !== next.expanded.size) return false;
        for (const k of prev.expanded) if (!next.expanded.has(k)) return false;
        return true;
      },
      [],
    ),
  );

  // Mirror contents-tree expansion onto the main tree so the city's folder
  // umbrellas hide for folders the user expands in the floating contents
  // view. Contents-tree paths are stripped of the selected-folder prefix;
  // we re-prefix them to address the same node in the main model.
  const contentsFolderExpansion = useFileTreeSelector(
    panelFolderContentsTreeModel,
    React.useCallback(
      (model: FileTreeModel) => {
        const expanded = new Set<string>();
        if (!selectedPanelFolder) return { expanded };
        const prefix = selectedPanelFolder + '/';
        for (const dir of cityDirectories) {
          if (!dir.startsWith(prefix)) continue;
          const stripped = dir.slice(prefix.length);
          const item = asDir(model.getItem(stripped));
          if (item && item.isExpanded()) expanded.add(dir);
        }
        return { expanded };
      },
      [selectedPanelFolder, cityDirectories],
    ),
    React.useCallback(
      (prev: { expanded: Set<string> }, next: { expanded: Set<string> }) => {
        if (prev.expanded.size !== next.expanded.size) return false;
        for (const k of prev.expanded) if (!next.expanded.has(k)) return false;
        return true;
      },
      [],
    ),
  );

  // Diff against the prior mirror so collapses propagate without stomping
  // folders the user expanded directly via city umbrella clicks.
  const prevContentsExpansionRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const next = contentsFolderExpansion.expanded;
    const prev = prevContentsExpansionRef.current;
    for (const dir of next) {
      if (!prev.has(dir)) asDir(treeModel.getItem(dir))?.expand();
    }
    for (const dir of prev) {
      if (!next.has(dir)) asDir(treeModel.getItem(dir))?.collapse();
    }
    prevContentsExpansionRef.current = new Set(next);
  }, [contentsFolderExpansion, treeModel]);

  // Folder city-path → area display name. Lets folder umbrella tiles surface
  // the human-readable area name above the technical path component.
  const areaNameByCityPath = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const area of areas) {
      for (const p of area.paths) m.set(toCityPath(p), area.name);
    }
    return m;
  }, [areas, toCityPath]);

  const folderElevatedPanels = React.useMemo<ElevatedScopePanel[] | undefined>(() => {
    if (activeTab !== 'files') return undefined;
    const rawPanels = buildFolderElevatedPanels({
      cityData,
      expandedFolders: folderTreeExpansion.expanded,
      onToggleFolder: (folderPath, event) => {
        // Plain click → surface the clicked folder in the panel-selection
        // card (with an "Open" button) instead of expanding immediately,
        // so the umbrella tile doesn't vanish out from under the click.
        // showPanelFolderContents is intentionally not reset here: if the
        // user already opted into the contents view, switching folders
        // keeps the contents view active for the new folder.
        setSelectedPanelFolder(folderPath);
        setParentLayersAnchor(folderPath);
        setParentLayersDismissed(false);
        // Cmd-click (⌘ on macOS) / Ctrl-click — same selection behaviour
        // plus immediately reveal the folder's contents (mirrors the
        // "Show contents" button: expand the folder in the tree so the
        // umbrella lifts, and open the floating file-tree view).
        if (event.metaKey || event.ctrlKey) {
          setShowPanelFolderContents(true);
          asDir(treeModel.getItem(folderPath))?.expand();
        }
      },
      onDoubleClickFolder: (folderPath) => {
        // Double-click → focus the camera on this folder. Double-clicking
        // a folder that is *already* the focus pops the focus up by one
        // ancestor (clamped at the package root), giving an iterative
        // "zoom out" gesture as the user keeps double-clicking.
        let next = folderPath;
        let nextSelected = folderPath;
        if (focusDirectoryRef.current === folderPath) {
          const slash = folderPath.lastIndexOf('/');
          next = slash > 0 ? folderPath.slice(0, slash) : packageRootClamp;
          nextSelected = next;
        }
        setSelectedPanelFolder(nextSelected);
        setFocusDirectoryIfUnpinned(next);
        setParentLayersAnchor(nextSelected);
        setParentLayersDismissed(false);
      },
      index: folderIndex,
    });
    const panels: ElevatedScopePanel[] = rawPanels.map(panel => {
      const folderPath = panel.id.startsWith('folder::') ? panel.id.slice('folder::'.length) : null;
      const displayLabel = folderPath ? areaNameByCityPath.get(folderPath) : undefined;
      return displayLabel ? { ...panel, displayLabel } : panel;
    });
    // Two-layer selection ring: when the selected folder is collapsed, its
    // umbrella tile occludes the ground-painted highlight border, so we
    // also slip a slightly-inflated slab underneath the umbrella to show
    // an accent rim. The expanded case is covered by the `border`-strategy
    // highlight layer in `cityHighlightLayers`.
    if (selectedPanelFolder) {
      const idx = panels.findIndex(p => p.id === `folder::${selectedPanelFolder}`);
      if (idx >= 0) {
        const target = panels[idx];
        const inflate = 4;
        const border: ElevatedScopePanel = {
          id: `folder-border::${selectedPanelFolder}`,
          color: theme.colors.warning,
          height: (target.height ?? 4) - 2,
          thickness: 1,
          bounds: {
            minX: target.bounds.minX - inflate,
            maxX: target.bounds.maxX + inflate,
            minZ: target.bounds.minZ - inflate,
            maxZ: target.bounds.maxZ + inflate,
          },
        };
        const next = [...panels];
        next.splice(idx, 0, border);
        return next;
      }
    }

    return panels.length > 0 ? panels : undefined;
  }, [
    activeTab,
    cityData,
    selectedPanelFolder,
    treeModel,
    folderTreeExpansion,
    setFocusDirectoryIfUnpinned,
    areaNameByCityPath,
    folderIndex,
    packageRootClamp,
    theme,
  ]);

  // Cmd-click on a building → surface the chain of expanded ancestor folders
  // (their umbrellas are currently hidden because they're expanded). Each
  // entry in the popup can be clicked to collapse that ancestor, which
  // restores its umbrella so the user can navigate back up.
  const parentLayers = React.useMemo<string[]>(() => {
    if (!parentLayersAnchor) return [];
    const parts = parentLayersAnchor.split('/');
    const out: string[] = [];
    // Walk shallowest → deepest so the list reads outermost-first.
    // Include the anchor itself: if it's expanded, its umbrella is hidden
    // (children took its place), so the user should be able to collapse it
    // back from the panel.
    for (let i = 1; i <= parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/');
      if (folderTreeExpansion.expanded.has(ancestor)) out.push(ancestor);
    }
    return out;
  }, [parentLayersAnchor, folderTreeExpansion]);

  // Mirror of `onFileOpen` so the `useFileTree` callback (created once at
  // first render) can always reach the latest handler.
  const onFileOpenRef = React.useRef(onFileOpen);
  React.useEffect(() => {
    onFileOpenRef.current = onFileOpen;
  }, [onFileOpen]);

  const handleBuildingClick = React.useCallback(
    (building: { path: string }) => {
      setParentLayersAnchor(building.path);
      setParentLayersDismissed(false);
      onFileOpen?.(building.path);
    },
    [onFileOpen],
  );

  const collapseFolder = React.useCallback(
    (folderPath: string) => asDir(treeModel.getItem(folderPath))?.collapse(),
    [treeModel],
  );

  const openAddModal = React.useCallback(
    (targetPath: string, prefillScopeId?: string) => {
      setScopeModalTargetPath(targetPath);
      setModalScopeId(prefillScopeId ?? '');
      setModalNamespaceName('');
      setShowAddModal(true);
    },
    [],
  );

  // Coverage lookup for the city-panel-clicked folder. Returns scope hits
  // (with the most specific covering namespace, if any) and area hits.
  const panelFolderCoverage = React.useMemo(() => {
    if (!selectedPanelFolder) return null;
    const sp = toScopePath(selectedPanelFolder);
    const covers = (claim: string) => sp === claim || sp.startsWith(claim + '/');

    const scopeHits: { scope: ScopeRecord; namespace: NamespaceRecord | null }[] = [];
    for (const scope of scopes) {
      const ns = scope.namespaces.find(n => n.paths.some(covers)) ?? null;
      const scopeLevel = scope.paths.some(covers);
      if (ns || scopeLevel) scopeHits.push({ scope, namespace: ns });
    }

    const areaHits = areas.filter(a => a.paths.some(covers));

    return { scopeHits, areaHits };
  }, [selectedPanelFolder, scopes, areas, toScopePath]);

  const submitAddToScope = React.useCallback(() => {
    if (!scopeModalTargetPath) return;
    if (!scopeCtx) return; // no manager mounted (storybook); silently no-op
    const path = toScopePath(scopeModalTargetPath);
    const scopeId = modalScopeId.trim();
    const namespaceName = modalNamespaceName.trim();
    if (!scopeId) return;

    // Queue branches to auto-expand once the tree re-resets.
    pendingExpand.current = namespaceName ? [scopeId, `${scopeId}/${namespaceName}`] : [scopeId];

    // Manager handles all five branches (new scope, new scope+ns, existing
    // scope, existing scope+new ns, existing scope+existing ns) and the
    // "scope.paths covers ns.paths" invariant. We only have to pre-pick a
    // namespace color so new namespaces get a unique palette colour.
    void scopeCtx.manager
      .addToScope({
        scopeName: scopeId,
        namespaceName: namespaceName || undefined,
        paths: [path],
        description: '(new scope)',
        namespaceColor: namespaceName ? pickNamespaceColor(scopes) : undefined,
      })
      .catch((err) => {
        console.error('[FileCityExplorer] addToScope failed', err);
      });

    setShowAddModal(false);
    setScopeModalTargetPath(null);
  }, [scopeCtx, scopes, scopeModalTargetPath, modalScopeId, modalNamespaceName, toScopePath]);

  const openAddAreaModal = React.useCallback((targetPath: string) => {
    setAreaModalTargetPath(targetPath);
    setModalAreaName('');
    setModalAreaDescription('');
    setShowAddAreaModal(true);
  }, []);

  const submitAddToArea = React.useCallback(() => {
    if (!areaModalTargetPath) return;
    if (!areaCtx) return; // no manager mounted (storybook); silently no-op
    const path = toScopePath(areaModalTargetPath);
    const name = modalAreaName.trim();
    const desc = modalAreaDescription.trim();
    if (!name) return;

    // Areas and scopes must partition the filesystem — neither side may
    // claim a path the other already covers. Reject up front so the user
    // sees the conflict instead of writing a manifest the validator will
    // later flag.
    if (pathConflictsWithScopes(path, scopes)) {
      console.warn(
        '[FileCityExplorer] Refusing to add area path that overlaps an existing scope:',
        path,
      );
      return;
    }

    const existing = areas.find((a) => a.name === name);
    const op = existing
      ? areaCtx.manager.addPathToArea({ areaName: name, path })
      : areaCtx.manager.addArea({
          name,
          description: desc || '(new area)',
          paths: [path],
        });
    void op.catch((err) => {
      console.error('[FileCityExplorer] add area failed', err);
    });

    setShowAddAreaModal(false);
    setAreaModalTargetPath(null);
  }, [
    areaCtx,
    areas,
    scopes,
    areaModalTargetPath,
    modalAreaName,
    modalAreaDescription,
    toScopePath,
  ]);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', background: theme.colors.background }}>
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        {/* Canvas wrapper — pushed down by HEADER_HEIGHT so the focus
            bar doesn't occlude the camera's framing area. The 3D camera
            sizes itself to the canvas, so shrinking the canvas is what
            makes focus calculations exclude the header. */}
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <FileCity3D
            cityData={cityData}
            height="100%"
            width="100%"
            heightScaling="linear"
            linearScale={0.5}
            backgroundColor={theme.colors.background}
            textColor={theme.colors.textMuted}
            focusDirectory={focusDirectory}
            highlightLayers={(() => {
              const extras: HighlightLayer[] = [];
              if (searchHighlightLayer) extras.push(searchHighlightLayer);
              if (hoveredSearchHighlightLayer) extras.push(hoveredSearchHighlightLayer);
              if (extras.length === 0) return cityHighlightLayers;
              return [...(cityHighlightLayers ?? []), ...extras];
            })()}
            elevatedScopePanels={
              searchHighlightLayer || searchInputFocused
                ? undefined
                : cityElevatedPanels ?? folderElevatedPanels
            }
            onBuildingClick={handleBuildingClick}
            animation={{
              startFlat: true,
              autoStartDelay: null,
              staggerDelay: 5,
              tension: 150,
              friction: 16,
            }}
            showControls={true}
          />
        </div>

        {/* Focus directory overlay — pinnable */}
        <div
          style={{
            position: 'absolute',
            top: theme.space[2],
            left: theme.space[2],
            right: theme.space[2],
            padding: '8px 12px',
            background: withAlpha(theme.colors.background, 72),
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${focusPinned ? theme.colors.warning : theme.colors.border}`,
            borderRadius: theme.radii[3],
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {(() => {
              // Drive the breadcrumb from the deeper of focus and selection.
              // Selection-only (no focus) still produces a breadcrumb so a
              // single-click on a folder umbrella surfaces the path even
              // before the user double-clicks to commit it as the camera
              // focus.
              const breadcrumbAnchor: string | null = (() => {
                if (selectedPanelFolder) {
                  if (!focusDirectory) return selectedPanelFolder;
                  if (
                    selectedPanelFolder === focusDirectory ||
                    selectedPanelFolder.startsWith(focusDirectory + '/')
                  ) {
                    return selectedPanelFolder;
                  }
                }
                return focusDirectory || null;
              })();

              // When there's no focus, treat every segment as in-focus
              // styling-wise — there's nothing "beyond" it yet.
              const focusDepth = focusDirectory
                ? focusDirectory.split('/').length
                : Infinity;
              const segments: { label: string; path: string; beyondFocus: boolean }[] = [];
              if (breadcrumbAnchor) {
                const parts = breadcrumbAnchor.split('/');
                for (let i = 0; i < parts.length; i++) {
                  const path = parts.slice(0, i + 1).join('/');
                  if (cityDirectories.has(path)) {
                    segments.push({ label: parts[i], path, beyondFocus: i + 1 > focusDepth });
                  }
                }
              }

              if (!repoLabel && segments.length === 0) {
                return (
                  <div
                    style={{
                      fontFamily: theme.fonts.monospace,
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textTertiary,
                      wordBreak: 'break-all',
                    }}
                  >
                    None
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  {repoLabel && (
                    // Repo prefix — clicking clears focus + selection so the
                    // camera reframes the whole city. Always present so the
                    // header reads `owner/repo / segment / segment …`.
                    <button
                      onClick={() => {
                        setFocusPinned(false);
                        setFocusDirectory(null);
                        setSelectedPanelFolder(null);
                        setParentLayersAnchor(null);
                        setParentLayersDismissed(false);
                      }}
                      title="Clear focus — show the whole repo"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '2px 4px',
                        borderRadius: theme.radii[1],
                        fontFamily: theme.fonts.monospace,
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.text,
                        fontWeight: segments.length === 0
                          ? theme.fontWeights.semibold
                          : theme.fontWeights.body,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        textDecorationColor: theme.colors.muted,
                      }}
                    >
                      {repoLabel}
                    </button>
                  )}
                  {segments.map((seg, i) => {
                    const isFocus = seg.path === focusDirectory;
                    const isSelectedLeaf =
                      seg.path === selectedPanelFolder && seg.beyondFocus;
                    const color = isFocus || seg.beyondFocus
                      ? theme.colors.text
                      : theme.colors.textMuted;
                    const showSeparator = repoLabel || i > 0;
                    return (
                      <React.Fragment key={seg.path}>
                        {showSeparator && (
                          <span style={{ color: theme.colors.text, fontFamily: theme.fonts.monospace }}>
                            /
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setFocusDirectory(seg.path);
                            setSelectedPanelFolder(seg.path);
                            setParentLayersAnchor(seg.path);
                            setParentLayersDismissed(false);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '2px 4px',
                            borderRadius: theme.radii[1],
                            fontFamily: theme.fonts.monospace,
                            fontSize: theme.fontSizes[1],
                            color,
                            fontWeight: isFocus || isSelectedLeaf
                              ? theme.fontWeights.semibold
                              : theme.fontWeights.body,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textDecorationColor: theme.colors.muted,
                          }}
                        >
                          {seg.label}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchInputFocused(true)}
              onBlur={() => setSearchInputFocused(false)}
              onKeyDown={e => {
                if (e.key === 'Escape') setSearchQuery('');
              }}
              placeholder="Search files…"
              style={{
                width: 160,
                padding: '4px 8px',
                background: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[2],
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                outline: 'none',
              }}
            />
          </div>
          {focusDirectory && (
            <button
              onClick={() => setFocusPinned(p => !p)}
              title={
                focusPinned
                  ? 'Unpin — selections will move the focus again'
                  : 'Pin — keep this focus while navigating the trees'
              }
              style={{
                background: focusPinned ? theme.colors.warning : 'transparent',
                color: focusPinned ? theme.colors.background : theme.colors.textSecondary,
                border: `1px solid ${focusPinned ? theme.colors.warning : theme.colors.border}`,
                borderRadius: theme.radii[2],
                padding: '4px 8px',
                fontSize: theme.fontSizes[0],
                cursor: 'pointer',
                fontWeight: theme.fontWeights.medium,
                flexShrink: 0,
              }}
            >
              {focusPinned ? 'Pinned' : 'Pin'}
            </button>
          )}
          {focusDirectory && (
            <button
              onClick={() => {
                setFocusPinned(false);
                setFocusDirectory(null);
              }}
              title="Clear focus"
              style={{
                background: 'transparent',
                color: theme.colors.textMuted,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[2],
                padding: '4px 8px',
                fontSize: theme.fontSizes[0],
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Selected-folder card — driven by clicks on city folder panels.
            Renders below the focus overlay; an "Open" button expands the
            folder in the file tree (which removes the umbrella tile). */}
        {activeTab === 'files' && selectedPanelFolder && (
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: theme.space[2],
              padding: '8px 12px',
              background: withAlpha(theme.colors.background, 72),
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii[3],
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              zIndex: 100,
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.space[2],
            }}
          >
            {panelFolderCoverage && (panelFolderCoverage.scopeHits.length > 0 ||
              panelFolderCoverage.areaHits.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {panelFolderCoverage.areaHits.map(area => (
                  <div
                    key={area.name}
                    style={{
                      padding: '6px 8px',
                      background: theme.colors.backgroundDark ?? theme.colors.background,
                      border: `1px dashed ${theme.colors.border}`,
                      borderRadius: theme.radii[2],
                      display: 'flex',
                      flexDirection: 'column',
                      gap: theme.space[1],
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textMuted,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          fontWeight: theme.fontWeights.semibold,
                        }}
                      >
                        Area
                      </span>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: theme.radii[1],
                          background: AREA_PANEL_COLOR,
                          border: `1px dashed ${theme.colors.textMuted}`,
                          flexShrink: 0,
                        }}
                      />
                      <code style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary }}>{area.name}</code>
                    </div>
                    <div style={{ fontSize: theme.fontSizes[0], color: theme.colors.textMuted, lineHeight: 1.4 }}>
                      {area.description}
                    </div>
                  </div>
                ))}
                {panelFolderCoverage.scopeHits.map(({ scope, namespace }) => (
                  <div
                    key={scope.name}
                    style={{
                      padding: '6px 8px',
                      background: theme.colors.backgroundDark ?? theme.colors.background,
                      border: `1px solid ${theme.colors.backgroundSecondary}`,
                      borderRadius: theme.radii[2],
                      display: 'flex',
                      flexDirection: 'column',
                      gap: theme.space[1],
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.accent,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          fontWeight: theme.fontWeights.semibold,
                        }}
                      >
                        Scope
                      </span>
                      <code style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary }}>{scope.name}</code>
                      {namespace && (
                        <>
                          <span style={{ color: theme.colors.muted }}>/</span>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: theme.radii[1],
                              background: namespace.color ?? DEFAULT_NAMESPACE_COLOR,
                              flexShrink: 0,
                            }}
                          />
                          <code style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary }}>{namespace.name}</code>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: theme.fontSizes[0], color: theme.colors.textMuted, lineHeight: 1.4 }}>
                      {namespace ? namespace.description : scope.description ?? ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <div ref={addPickerRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowAddPicker(v => !v)}
                  title="Add this folder to a scope or area"
                  style={{
                    background: showAddPicker ? theme.colors.backgroundSecondary : 'transparent',
                    color: theme.colors.textSecondary,
                    border: `1px solid ${theme.colors.muted}`,
                    borderRadius: theme.radii[2],
                    padding: '4px 10px',
                    fontSize: theme.fontSizes[0],
                    cursor: 'pointer',
                    fontWeight: theme.fontWeights.medium,
                  }}
                >
                  + Add
                </button>
                {showAddPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      background: withAlpha(theme.colors.background, 95),
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii[2],
                      padding: theme.space[1],
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      zIndex: 110,
                      minWidth: 120,
                      boxShadow: theme.shadows[3],
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowAddPicker(false);
                        openAddModal(selectedPanelFolder);
                      }}
                      style={{
                        background: 'transparent',
                        color: theme.colors.textSecondary,
                        border: `1px solid ${theme.colors.accent}`,
                        borderRadius: theme.radii[1],
                        padding: '4px 10px',
                        fontSize: theme.fontSizes[0],
                        cursor: 'pointer',
                        fontWeight: theme.fontWeights.medium,
                        textAlign: 'left',
                      }}
                    >
                      Scope
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPicker(false);
                        openAddAreaModal(selectedPanelFolder);
                      }}
                      style={{
                        background: 'transparent',
                        color: theme.colors.textSecondary,
                        border: `1px dashed ${theme.colors.textMuted}`,
                        borderRadius: theme.radii[1],
                        padding: '4px 10px',
                        fontSize: theme.fontSizes[0],
                        cursor: 'pointer',
                        fontWeight: theme.fontWeights.medium,
                        textAlign: 'left',
                      }}
                    >
                      Area
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  const next = !showPanelFolderContents;
                  setShowPanelFolderContents(next);
                  // Mirror the Open/Close behaviour: showing contents
                  // expands the folder in the tree (so the city's umbrella
                  // tile lifts and child buildings become visible);
                  // hiding collapses it again.
                  const item = asDir(treeModel.getItem(selectedPanelFolder));
                  if (!item) return;
                  if (next) item.expand();
                  else item.collapse();
                }}
                title="Show files inside this folder"
                style={{
                  background: showPanelFolderContents ? theme.colors.backgroundSecondary : 'transparent',
                  color: theme.colors.textSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                  padding: '4px 10px',
                  fontSize: theme.fontSizes[0],
                  cursor: 'pointer',
                  fontWeight: theme.fontWeights.medium,
                }}
              >
                {showPanelFolderContents ? 'Hide contents' : 'Show contents'}
              </button>
            </div>
            {showPanelFolderContents && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `1px solid ${theme.colors.backgroundSecondary}`,
                  paddingTop: theme.space[2],
                  marginTop: 2,
                  minWidth: 320,
                }}
              >
                {panelFolderContentsPaths.length === 0 ? (
                  <div
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textTertiary,
                      fontStyle: 'italic',
                      padding: '4px 0',
                    }}
                  >
                    No files in this folder.
                  </div>
                ) : (
                  <div style={{ height: 640, display: 'flex', flexDirection: 'column' }}>
                    <FileTree
                      model={panelFolderContentsTreeModel}
                      style={
                        {
                          flex: 1,
                          minHeight: 0,
                          '--trees-bg-override': 'transparent',
                          '--trees-search-bg-override': 'rgba(0, 0, 0, 0.25)',
                          '--trees-padding-inline-override': '0',
                          '--trees-theme-list-active-selection-bg': withAlpha(theme.colors.primary, 28),
                          '--trees-theme-list-hover-bg': withAlpha(theme.colors.primary, 14),
                        } as React.CSSProperties
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Parent-layers popup — surfaces ancestor folders whose umbrellas
            are currently hidden (because they're expanded). Triggered by
            Cmd/Ctrl-click on a building. Each entry collapses that
            ancestor on click so its umbrella reappears. */}
        {parentLayersAnchor && !parentLayersDismissed && parentLayers.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 72,
              right: theme.space[2],
              padding: '10px 12px',
              background: withAlpha(theme.colors.background, 72),
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii[3],
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              zIndex: 100,
              maxWidth: 240,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.space[2],
              boxShadow: theme.shadows[3],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ ...sectionLabelStyle, flex: 1, minWidth: 0 }}>
                Hidden parent layers
              </div>
              <button
                onClick={() => setParentLayersDismissed(true)}
                title="Dismiss (reappears on next folder interaction)"
                style={{
                  background: 'transparent',
                  color: theme.colors.textMuted,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                  padding: '4px 8px',
                  fontSize: theme.fontSizes[0],
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space[1] }}>
              {parentLayers.map(folderPath => {
                const label = folderPath.split('/').pop() ?? folderPath;
                return (
                  <button
                    key={folderPath}
                    onClick={() => collapseFolder(folderPath)}
                    title={`Collapse ${folderPath} — restores its umbrella tile`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.space[2],
                      padding: '6px 8px',
                      background: theme.colors.backgroundSecondary,
                      color: theme.colors.text,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii[2],
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[0],
                    }}
                  >
                    <span style={{ fontFamily: theme.fonts.monospace, fontWeight: theme.fontWeights.medium }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search-results overlay — mirrors the focus/selected-folder
            overlays on the left, but on the right side. Only mounted while a
            query is active so the canvas is unobstructed when search clears. */}
        {searchPanelOpen && (
          <div
            style={{
              position: 'absolute',
              top: 60,
              right: theme.space[2],
              bottom: theme.space[3],
              width: 320,
              padding: '10px 12px',
              background: withAlpha(theme.colors.background, 72),
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii[3],
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.space[2],
              boxShadow: theme.shadows[3],
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div style={{ ...sectionLabelStyle, flex: 1, minWidth: 0 }}>
                Search results
              </div>
              <span
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textMuted,
                  fontFamily: theme.fonts.monospace,
                }}
              >
                {searchResults.length}
              </span>
            </div>
            {searchResults.length === 0 ? (
              <div
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textTertiary,
                  fontStyle: 'italic',
                }}
              >
                No files match “{searchQuery.trim()}”.
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  margin: `0 -${theme.space[1]}`,
                }}
              >
                {searchResults.map((path) => {
                  const slash = path.lastIndexOf('/');
                  const name = slash >= 0 ? path.slice(slash + 1) : path;
                  const dir = slash >= 0 ? path.slice(0, slash) : '';
                  return (
                    <button
                      key={path}
                      onClick={() => onFileOpen?.(path)}
                      title={path}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderRadius: theme.radii[2],
                        padding: '4px 8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = withAlpha(theme.colors.primary, 14);
                        setHoveredSearchResult(path);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        setHoveredSearchResult((prev) => (prev === path ? null : prev));
                      }}
                    >
                      <span
                        style={{
                          fontFamily: theme.fonts.monospace,
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </span>
                      {dir && (
                        <span
                          style={{
                            fontFamily: theme.fonts.monospace,
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textMuted,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dir}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mode switch — swap which feature layer the canvas renders */}
        <div
          style={{
            position: 'absolute',
            bottom: theme.space[3],
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            background: withAlpha(theme.colors.background, 92),
            border: `1px solid ${theme.colors.backgroundSecondary}`,
            borderRadius: theme.radii[3],
            overflow: 'hidden',
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            boxShadow: theme.shadows[2],
            zIndex: 10,
          }}
        >
          {(
            [
              { id: 'files' as const, label: 'Files', accent: theme.colors.primary },
              { id: 'scopes' as const, label: 'Scopes', accent: theme.colors.accent },
            ]
          ).map((opt, i) => {
            const active = activeTab === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setActiveTab(opt.id)}
                style={{
                  padding: '8px 16px',
                  background: active ? opt.accent : 'transparent',
                  color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary,
                  border: 'none',
                  borderLeft: i === 0 ? 'none' : `1px solid ${theme.colors.backgroundSecondary}`,
                  cursor: 'pointer',
                  fontWeight: active ? theme.fontWeights.semibold : theme.fontWeights.body,
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Info overlay — driven by scope tree selection */}
        {activeTab === 'scopes' && scopeInfo && <ScopeInfoOverlay info={scopeInfo} />}
      </div>

      {/* Add-to-scope modal */}
      {showAddModal && scopeModalTargetPath && (
        <AddToScopeModal
          path={toScopePath(scopeModalTargetPath)}
          scopes={scopes}
          scopeId={modalScopeId}
          namespaceName={modalNamespaceName}
          onScopeIdChange={setModalScopeId}
          onNamespaceNameChange={setModalNamespaceName}
          onPickExisting={(s, n) => {
            setModalScopeId(s);
            setModalNamespaceName(n);
          }}
          onSubmit={submitAddToScope}
          onClose={() => {
            setShowAddModal(false);
            setScopeModalTargetPath(null);
          }}
        />
      )}

      {/* Add-to-area modal */}
      {showAddAreaModal && areaModalTargetPath && (
        <AddToAreaModal
          path={toScopePath(areaModalTargetPath)}
          areas={areas}
          areaName={modalAreaName}
          description={modalAreaDescription}
          onAreaNameChange={setModalAreaName}
          onDescriptionChange={setModalAreaDescription}
          onPickExisting={name => setModalAreaName(name)}
          onSubmit={submitAddToArea}
          onClose={() => {
            setShowAddAreaModal(false);
            setAreaModalTargetPath(null);
          }}
        />
      )}
    </div>
  );
};
