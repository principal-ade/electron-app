/**
 * HeatmapPanel
 *
 * Panel wrapper for HourlyActivityHeatmap component.
 * Used in the FeedView panel layout.
 */

import React, { useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { HourlyActivityHeatmap, type CommitTimestamp } from '../components/HourlyActivityHeatmap';

export interface HeatmapPanelProps {
  /** Commit timestamps for the heatmap */
  commits: CommitTimestamp[];
  /** Whether commit data is loading */
  loading?: boolean;
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
  /** Currently selected time block (ISO string) */
  selectedBlock?: string | null;
}

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  commits,
  loading = false,
  events,
  selectedBlock = null,
}) => {
  const { theme } = useTheme();

  // Handle block click - emit event for other panels to filter
  const handleBlockClick = useCallback(
    (startTime: Date, endTime: Date, count: number) => {
      if (count === 0) return;

      // Toggle filter off if clicking the same block
      const blockKey = startTime.toISOString();
      const isDeselecting = selectedBlock === blockKey;

      events.emit({
        type: 'feed:time-filter-changed',
        source: 'heatmap-panel',
        timestamp: Date.now(),
        payload: isDeselecting ? null : { start: startTime, end: endTime },
      });
    },
    [events, selectedBlock]
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        padding: 16,
      }}
    >
      <HourlyActivityHeatmap
        commits={commits}
        loading={loading}
        onBlockClick={handleBlockClick}
        selectedBlock={selectedBlock}
      />
    </div>
  );
};

export default HeatmapPanel;
