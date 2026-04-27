import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  FileCity3D,
  buildFolderElevatedPanels,
  buildFolderIndex,
  type CityBuilding,
  type CityData,
  type ElevatedScopePanel,
  type HighlightLayer,
} from '@principal-ai/file-city-react';
import type {
  PanelActions,
  PanelContextValue,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { FileTree as RepoFileTree } from '@principal-ai/repository-abstraction';
import {
  buildCityDataFromContext,
  stripRootPath,
} from './buildCityDataFromContext';
import { useScopeManagerOptional } from '../scope-manager-provider';
import { useFolderExpansion } from '../folder-expansion-provider';
import {
  ScopeInfoOverlay,
  buildElevatedPanels,
  buildOverlay,
  useScopeOverlaySelectionOptional,
} from '../scope-overlay';

interface FileCityPanelContext extends PanelContextValue {
  fileTree?: DataSlice<RepoFileTree | null>;
  repository?: { path?: string | null } | null;
}

export interface FileCityPanelProps {
  context: FileCityPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
  /** Optional pre-built CityData. When provided, overrides the context-derived city. */
  cityData?: CityData;
  /** Forwarded to FileCity3D for scope-overlay highlighting. */
  highlightLayers?: HighlightLayer[];
  /** Forwarded to FileCity3D for scope-overlay slab tiles. */
  elevatedScopePanels?: ElevatedScopePanel[];
  /** Forwarded to FileCity3D to focus on a specific directory. */
  focusDirectory?: string | null;
}

export const FileCityPanel: React.FC<FileCityPanelProps> = ({
  context,
  events,
  cityData: cityDataOverride,
  highlightLayers,
  elevatedScopePanels,
  focusDirectory,
}) => {
  const { theme } = useTheme();
  const scopeCtx = useScopeManagerOptional();
  const overlaySelection = useScopeOverlaySelectionOptional();
  const tree = context.fileTree?.data ?? null;
  const repositoryPath = context.repository?.path ?? null;

  const [derivedCityData, setDerivedCityData] = React.useState<CityData | null>(
    null,
  );
  const [isBuilding, setIsBuilding] = React.useState(false);

  React.useEffect(() => {
    if (cityDataOverride) return;
    if (!tree) {
      setDerivedCityData(null);
      return;
    }
    let cancelled = false;
    setIsBuilding(true);
    buildCityDataFromContext({ fileTree: tree, repositoryPath })
      .then((next) => {
        if (!cancelled) setDerivedCityData(next);
      })
      .finally(() => {
        if (!cancelled) setIsBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tree, repositoryPath, cityDataOverride]);

  const cityData = cityDataOverride ?? derivedCityData;
  const rootPath = tree?.metadata?.id ?? '';

  // Derive overlay state from the active scope selection. Explicit props
  // (highlightLayers, focusDirectory) win when supplied so storybook / tests
  // can drive the visualization directly without going through the context.
  const derivedOverlay = React.useMemo(() => {
    if (!scopeCtx || !overlaySelection) {
      return { focusDirectory: null, highlightLayers: [] };
    }
    return buildOverlay({
      selection: overlaySelection.selection,
      scopes: scopeCtx.workspace.scopes,
      buildings: cityData?.buildings,
    });
  }, [scopeCtx, overlaySelection, cityData]);

  const derivedElevatedPanels = React.useMemo(() => {
    if (!scopeCtx || !overlaySelection) return [];
    return buildElevatedPanels({
      selection: overlaySelection.selection,
      scopes: scopeCtx.workspace.scopes,
      districts: cityData?.districts,
      setSelection: overlaySelection.setSelection,
    });
  }, [scopeCtx, overlaySelection, cityData]);

  // Folder-driven elevated panels: collapsed folders in the files panel
  // become umbrella tiles over the city. Cache the per-cityData index so
  // the recursive walk only runs when expansion or city changes.
  const folderExpansion = useFolderExpansion();
  const folderIndex = React.useMemo(
    () => (cityData ? buildFolderIndex(cityData) : null),
    [cityData],
  );
  // Folder umbrella tiles don't expand on click — they select. The user then
  // confirms via the "Open" button in the bottom-right card. Toggling the
  // same tile clears selection.
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>(
    null,
  );
  const folderPanels = React.useMemo<ElevatedScopePanel[]>(() => {
    if (!cityData || !folderIndex) return [];
    const panels = buildFolderElevatedPanels({
      cityData,
      expandedFolders: folderExpansion.expandedFolders,
      onToggleFolder: (path) =>
        setSelectedFolder((prev) => (prev === path ? null : path)),
      index: folderIndex,
    });
    if (!selectedFolder) return panels;
    // Dim non-selected tiles so the picked folder reads as the active one.
    return panels.map((p) =>
      p.id === `folder::${selectedFolder}` ? p : { ...p, opacity: 0.45 },
    );
  }, [
    cityData,
    folderIndex,
    folderExpansion.expandedFolders,
    selectedFolder,
  ]);

  const effectiveHighlightLayers =
    highlightLayers ?? derivedOverlay.highlightLayers;
  const effectiveFocusDirectory =
    focusDirectory !== undefined ? focusDirectory : derivedOverlay.focusDirectory;
  // Resolution order: explicit prop > scope-driven panels > folder-driven
  // panels. The scope panels only exist while a scope is selected, so the
  // folder panels become the default view when no scope is active.
  const folderPanelsActive =
    !elevatedScopePanels && derivedElevatedPanels.length === 0;
  const effectiveElevatedScopePanels =
    elevatedScopePanels ??
    (derivedElevatedPanels.length > 0 ? derivedElevatedPanels : folderPanels);

  // Clear folder selection when its tile is no longer in play (scope panels
  // took over, city rebuilt, or the folder got expanded elsewhere).
  React.useEffect(() => {
    if (!selectedFolder) return;
    const stillThere =
      folderPanelsActive &&
      folderPanels.some((p) => p.id === `folder::${selectedFolder}`);
    if (!stillThere) setSelectedFolder(null);
  }, [selectedFolder, folderPanelsActive, folderPanels]);

  const selectedFolderPanel = selectedFolder
    ? folderPanels.find((p) => p.id === `folder::${selectedFolder}`) ?? null
    : null;

  const handleOpenSelectedFolder = React.useCallback(() => {
    if (!selectedFolder) return;
    folderExpansion.toggleFolder(selectedFolder);
    setSelectedFolder(null);
  }, [selectedFolder, folderExpansion]);

  const [selectedBuilding, setSelectedBuilding] =
    React.useState<CityBuilding | null>(null);

  const handleBuildingClick = React.useCallback(
    (building: CityBuilding) => {
      setSelectedBuilding(building);
      events.emit({
        type: 'file:open',
        source: 'file-city-panel',
        timestamp: Date.now(),
        payload: { path: stripRootPath(building.path, rootPath) },
      });
    },
    [events, rootPath],
  );

  // Drop a stale selection if its building disappears (city rebuilt, etc.).
  React.useEffect(() => {
    if (!selectedBuilding || !cityData) return;
    const stillThere = cityData.buildings.some(
      (b) => b.path === selectedBuilding.path,
    );
    if (!stillThere) setSelectedBuilding(null);
  }, [cityData, selectedBuilding]);

  if (!cityData) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: theme.colors.background,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
        }}
      >
        {isBuilding ? 'Building city…' : 'No file tree available'}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        background: theme.colors.background,
      }}
    >
      <FileCity3D
        cityData={cityData}
        width="100%"
        height="100%"
        showControls
        heightScaling="linear"
        linearScale={0.5}
        animation={{ startFlat: true, autoStartDelay: null }}
        focusDirectory={effectiveFocusDirectory ?? null}
        highlightLayers={effectiveHighlightLayers}
        elevatedScopePanels={effectiveElevatedScopePanels}
        selectedBuilding={selectedBuilding}
        onBuildingClick={handleBuildingClick}
        backgroundColor={theme.colors.background}
      />
      <ScopeInfoOverlay />
      {selectedFolderPanel && (
        <SelectedFolderCard
          folderPath={selectedFolder ?? ''}
          color={selectedFolderPanel.color}
          onOpen={handleOpenSelectedFolder}
          onDismiss={() => setSelectedFolder(null)}
        />
      )}
    </div>
  );
};

const SelectedFolderCard: React.FC<{
  folderPath: string;
  color: string;
  onOpen: () => void;
  onDismiss: () => void;
}> = ({ folderPath, color, onOpen, onDismiss }) => {
  const { theme } = useTheme();
  const folderName =
    folderPath.split('/').filter(Boolean).pop() ?? folderPath;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        minWidth: 240,
        maxWidth: 360,
        background: `${theme.colors.backgroundSecondary}f5`,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 8,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: 13,
        zIndex: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: color,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {folderName}
          </div>
          {folderPath !== folderName && (
            <div
              style={{
                fontSize: 10,
                color: theme.colors.textSecondary,
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {folderPath}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss selection"
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            fontSize: 14,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <button
        onClick={onOpen}
        style={{
          background: theme.colors.primary,
          color: theme.colors.background,
          border: 'none',
          borderRadius: 4,
          padding: '6px 10px',
          cursor: 'pointer',
          fontFamily: theme.fonts.body,
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        Open folder
      </button>
    </div>
  );
};
