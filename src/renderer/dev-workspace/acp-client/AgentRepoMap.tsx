import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
  type HighlightLayer,
} from '@principal-ai/file-city-react';

import type { AcpHighlightItem } from '../../../shared/main-process-api-interfaces/AcpAPI';
import {
  buildAcpHighlightLayers,
  type AcpHighlightToolCall,
} from './acpHighlightLayers';

/** One tool call rendered on the activity map. */
export interface AgentRepoMapCall extends AcpHighlightToolCall {
  id: string;
  title: string;
  summary?: string;
  name: string;
  kind: string;
  status?: string;
  highlightItems?: AcpHighlightItem[];
  highlightPaths?: string[];
}

export interface AgentRepoMapProps {
  cityData: CityData;
  calls: AgentRepoMapCall[];
}

/**
 * A live File City view whose highlight layers follow the session's real tool
 * calls. The accessed-files rail, legend, and activity status live outside
 * this component; this is only the map canvas and its live footer.
 */
export const AgentRepoMap: React.FC<AgentRepoMapProps> = ({
  cityData,
  calls,
}) => {
  const { theme } = useTheme();

  const layers = useMemo<HighlightLayer[]>(
    () =>
      buildAcpHighlightLayers(calls, {
        activeColor: theme.colors.primary,
      }),
    [calls, theme.colors.primary],
  );

  const activeIsRunning = useMemo(
    () =>
      calls.some(
        (call) => call.status === 'in_progress' || call.status === 'pending',
      ),
    [calls],
  );

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <style>{`
        @keyframes agent-repo-map-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.72); }
        }
        .agent-repo-map__pulse { animation: agent-repo-map-pulse 1.4s ease-in-out infinite; }
      `}</style>

      <div
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <ArchitectureMapHighlightLayers
            cityData={cityData}
            highlightLayers={layers}
            fullSize
            isolationMode="transparent"
            dimOpacity={0.14}
            canvasBackgroundColor={theme.colors.background}
            defaultBuildingColor={theme.colors.backgroundSecondary}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '10px 14px',
            borderTop: `1px solid ${theme.colors.border}`,
            background: theme.colors.backgroundSecondary,
          }}
        >
          <span
            className={activeIsRunning ? 'agent-repo-map__pulse' : undefined}
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: activeIsRunning
                ? theme.colors.success
                : theme.colors.textTertiary,
            }}
          />
          <span
            style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: theme.colors.textMuted,
            }}
          >
            {activeIsRunning ? 'Live activity' : 'Activity complete'}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: theme.fonts.monospace,
              fontSize: 11,
              color: theme.colors.textMuted,
            }}
          >
            {calls.length} calls
          </span>
        </div>
      </div>
    </div>
  );
};
