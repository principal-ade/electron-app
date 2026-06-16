import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
  type HighlightLayer,
} from '@principal-ai/file-city-react';

export interface TrailMinimapProps {
  /**
   * The city for the repository. Building paths are expected to be
   * repo-relative (e.g. "src/x.ts") — the shape produced by
   * {@link buildCityDataFromContext}.
   */
  cityData: CityData;
  /**
   * Aggregate ("all trails") mode. Maps each repo-relative path to how many
   * trails touch it. Renders a coverage heat map (theme `primary`, brighter
   * where more trails overlap — the same layer shape as `trailHighlightLayers`
   * in FileCityExplorer). Takes precedence over {@link coveredPaths} when
   * provided.
   */
  coverageByPath?: ReadonlyMap<string, number>;
  /**
   * Single-trail mode. Repo-relative paths a single trail touches (the union
   * of its markers' `sourcePath`s), filled solid in `theme.colors.warning` —
   * matching the "selected trail" highlight you see when you click a trail in
   * the full panel. Used only when {@link coverageByPath} is omitted.
   */
  coveredPaths?: readonly string[];
  /**
   * Map height. A number is treated as px; a string (e.g. "100%") is passed
   * through so the map can fill a flex parent. Width always fills the
   * container. Defaults to 160.
   */
  height?: number | string;
  /** Heat-map color for aggregate mode. Defaults to `theme.colors.primary`. */
  heatColor?: string;
  /** Fill color for single-trail mode. Defaults to `theme.colors.warning`. */
  coverageColor?: string;
}

/**
 * A compact, non-interactive 2D File City map — effectively a read-only
 * `FileCityExplorer`. It renders the same city and the same trail-coverage
 * highlights as the full panel, but with no controls, no floating cards, and
 * no service coupling: callers supply both the repo's `cityData` (built once
 * per repo and shared across that repo's cards) and the coverage to paint.
 *
 * Two modes:
 *  - Aggregate (`coverageByPath`): the all-trails heat map (info blue, opacity
 *    by touch count) — the default "how much have the trails covered" view.
 *  - Single trail (`coveredPaths`): one trail's files filled solid (warning),
 *    matching the click-to-select highlight.
 */
export const TrailMinimap: React.FC<TrailMinimapProps> = ({
  cityData,
  coverageByPath,
  coveredPaths,
  height = 160,
  heatColor,
  coverageColor,
}) => {
  const { theme } = useTheme();

  // Every building (file) path in the city. Coverage is filtered against this
  // so stale paths (renamed/deleted files) don't try to highlight buildings
  // that no longer exist — the same guard FileCityExplorer applies.
  const cityBuildingPaths = useMemo(
    () => new Set(cityData.buildings.map((b) => b.path)),
    [cityData],
  );

  const highlightLayers = useMemo<HighlightLayer[]>(() => {
    // Aggregate heat map — split into opacity tiers by touch count, since a
    // HighlightLayer is single-color/single-opacity. Mirrors
    // `trailHighlightLayers` in FileCityExplorer.
    if (coverageByPath) {
      const lowItems: HighlightLayer['items'] = [];
      const highItems: HighlightLayer['items'] = [];
      for (const [path, count] of coverageByPath) {
        if (count <= 0) continue;
        if (!cityBuildingPaths.has(path)) continue;
        const item = {
          path,
          type: 'file' as const,
          renderStrategy: 'fill' as const,
        };
        if (count >= 2) highItems.push(item);
        else lowItems.push(item);
      }
      const color = heatColor ?? theme.colors.primary;
      const layers: HighlightLayer[] = [];
      if (lowItems.length > 0) {
        layers.push({
          id: 'trail-heatmap-low',
          name: 'Trail heat map (1 trail)',
          enabled: true,
          color,
          priority: 700,
          opacity: 0.35,
          items: lowItems,
        });
      }
      if (highItems.length > 0) {
        layers.push({
          id: 'trail-heatmap-high',
          name: 'Trail heat map (2+ trails)',
          enabled: true,
          color,
          priority: 710,
          opacity: 0.7,
          items: highItems,
        });
      }
      return layers;
    }

    // Single-trail fill — matches `selectedTrailHighlightLayer`.
    if (coveredPaths && coveredPaths.length > 0) {
      const items: HighlightLayer['items'] = [];
      const seen = new Set<string>();
      for (const path of coveredPaths) {
        if (seen.has(path)) continue;
        if (!cityBuildingPaths.has(path)) continue;
        seen.add(path);
        items.push({ path, type: 'file', renderStrategy: 'fill' });
      }
      if (items.length === 0) return [];
      return [
        {
          id: 'trail-coverage-fill',
          name: 'Trail coverage',
          enabled: true,
          color: coverageColor ?? theme.colors.warning,
          priority: 920,
          opacity: 0.95,
          items,
        },
      ];
    }

    return [];
  }, [
    coverageByPath,
    coveredPaths,
    cityBuildingPaths,
    heatColor,
    coverageColor,
    theme.colors.primary,
    theme.colors.warning,
  ]);

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      <ArchitectureMapHighlightLayers
        cityData={cityData}
        highlightLayers={highlightLayers}
        fullSize
        enableZoom={false}
        showFileNames={false}
        showDirectoryLabels={false}
        showLayerControls={false}
        canvasBackgroundColor={theme.colors.background}
        defaultBuildingColor={theme.colors.backgroundSecondary}
        defaultDirectoryColor={theme.colors.background}
        maxCanvasSize={384}
      />
    </div>
  );
};
