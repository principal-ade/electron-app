import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { CityData } from '@principal-ai/file-city-react';
import type {
  PanelActions,
  PanelContextValue,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { FileTree as RepoFileTree } from '@principal-ai/repository-abstraction';

import { FileCityExplorer } from './FileCityExplorer';
import {
  buildCityDataFromContext,
  stripRootPath,
} from './buildCityDataFromContext';
import { FileOverlay } from './FileOverlay';
import { SequenceDiagramOverlay } from './SequenceDiagramOverlay';
import { SequenceEventDetailOverlay } from './SequenceEventDetailOverlay';
import { SequenceEventExplainerOverlay } from './SequenceEventExplainerOverlay';
import {
  SequenceLeaderLine,
  type SequenceLeaderLineHandle,
} from './SequenceLeaderLine';
import { useSequenceDiagram } from './useSequenceDiagram';

const MEDIA_RE = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|mp4|webm|mov|avi|mkv|ogv)$/i;
const isOverlayable = (path: string): boolean => {
  if (MEDIA_RE.test(path)) return false;
  if (path.endsWith('.md') || path.endsWith('.mdx')) return false;
  return true;
};

interface FileCityPanelContext extends PanelContextValue {
  fileTree?: DataSlice<RepoFileTree | null>;
  repository?: {
    path?: string | null;
    name?: string | null;
    owner?: string | null;
  } | null;
}

export interface FileCityPanelProps {
  context: FileCityPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
}

export const FileCityPanel: React.FC<FileCityPanelProps> = ({
  context,
  events,
}) => {
  const tree = context.fileTree?.data ?? null;
  const repositoryPath = context.repository?.path ?? null;
  const repoOwner = context.repository?.owner ?? null;
  const repoName = context.repository?.name ?? null;
  const repoLabel =
    repoOwner && repoName
      ? `${repoOwner}/${repoName}`
      : (repoName ?? null);

  const [cityData, setCityData] = React.useState<CityData | null>(null);
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [overlayFile, setOverlayFile] = React.useState<{
    filePath: string;
    fileName: string;
  } | null>(null);

  const {
    payload: sequencePayload,
    selectedEventId: sequenceSelectedEventId,
    setSelectedEventId: setSequenceSelectedEventId,
    clear: clearSequence,
  } = useSequenceDiagram(repositoryPath);

  const selectedEventIndex = React.useMemo(() => {
    if (!sequencePayload || !sequenceSelectedEventId) return -1;
    return sequencePayload.events.findIndex(
      (e) => e.id === sequenceSelectedEventId,
    );
  }, [sequencePayload, sequenceSelectedEventId]);

  const selectedSequenceEvent = React.useMemo(() => {
    if (!sequencePayload || selectedEventIndex < 0) return null;
    return sequencePayload.events[selectedEventIndex] ?? null;
  }, [sequencePayload, selectedEventIndex]);

  const sequenceSelection = React.useMemo(() => {
    if (!selectedSequenceEvent?.sourcePath) return null;
    return { sourcePath: selectedSequenceEvent.sourcePath };
  }, [selectedSequenceEvent]);

  const selectedEventAbsolutePath = React.useMemo(() => {
    const sourcePath = selectedSequenceEvent?.sourcePath;
    if (!sourcePath) return null;
    if (sourcePath.startsWith('/')) return sourcePath;
    if (!repositoryPath) return sourcePath;
    return `${repositoryPath}/${sourcePath}`;
  }, [selectedSequenceEvent, repositoryPath]);

  const selectedBuilding = React.useMemo(() => {
    const sourcePath = selectedSequenceEvent?.sourcePath;
    if (!sourcePath || !cityData) return null;
    return (
      cityData.buildings.find((b) => b.path === sourcePath) ??
      cityData.buildings.find((b) => b.path.endsWith(`/${sourcePath}`)) ??
      null
    );
  }, [selectedSequenceEvent, cityData]);

  const cityCenter = React.useMemo(() => {
    if (!cityData) return null;
    return {
      x: (cityData.bounds.minX + cityData.bounds.maxX) / 2,
      z: (cityData.bounds.minZ + cityData.bounds.maxZ) / 2,
    };
  }, [cityData]);

  const panelContainerRef = React.useRef<HTMLDivElement | null>(null);
  const leaderLineRef = React.useRef<SequenceLeaderLineHandle | null>(null);
  const detailOverlayRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!tree) {
      setCityData(null);
      return;
    }
    let cancelled = false;
    setIsBuilding(true);
    buildCityDataFromContext({ fileTree: tree, repositoryPath })
      .then((next) => {
        if (!cancelled) setCityData(next);
      })
      .finally(() => {
        if (!cancelled) setIsBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tree, repositoryPath]);

  const rootPath = tree?.metadata?.id ?? '';

  if (!cityData) {
    return <Placeholder building={isBuilding} />;
  }

  return (
    <div
      ref={panelContainerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <FileCityExplorer
        cityData={cityData}
        packageRoot=""
        repoLabel={repoLabel}
        repositoryPath={repositoryPath}
        sequenceSelection={sequenceSelection}
        hideFolderPanels={!!sequencePayload}
        onCameraFrame={(camera, size) => {
          leaderLineRef.current?.onCameraFrame(camera, size);
        }}
        onFileOpen={(cityPath) => {
          const relativePath = stripRootPath(cityPath, rootPath);
          if (isOverlayable(relativePath)) {
            const absolutePath = relativePath.startsWith('/')
              ? relativePath
              : repositoryPath
                ? `${repositoryPath}/${relativePath}`
                : relativePath;
            const fileName = absolutePath.split('/').pop() || relativePath;
            setOverlayFile({ filePath: absolutePath, fileName });
            return;
          }
          events.emit({
            type: 'file:open',
            source: 'file-city-panel',
            timestamp: Date.now(),
            payload: { path: relativePath },
          });
        }}
      />
      {sequencePayload && (
        <SequenceDiagramOverlay
          payload={sequencePayload}
          selectedEventId={sequenceSelectedEventId}
          onNodeClick={setSequenceSelectedEventId}
          onClose={clearSequence}
        />
      )}
      <SequenceLeaderLine
        ref={leaderLineRef}
        containerRef={panelContainerRef}
        building={selectedSequenceEvent ? selectedBuilding : null}
        cityCenter={cityCenter}
        targetRef={detailOverlayRef}
      />

      {selectedSequenceEvent && (
        <SequenceEventExplainerOverlay
          event={selectedSequenceEvent}
          bottomOffset="50%"
        />
      )}
      {selectedSequenceEvent && sequencePayload && (
        <SequenceEventDetailOverlay
          ref={detailOverlayRef}
          event={selectedSequenceEvent}
          absolutePath={selectedEventAbsolutePath}
          bottomOffset="50%"
          position={{
            index: selectedEventIndex + 1,
            total: sequencePayload.events.length,
          }}
          onPrev={
            selectedEventIndex > 0
              ? () =>
                  setSequenceSelectedEventId(
                    sequencePayload.events[selectedEventIndex - 1].id,
                  )
              : undefined
          }
          onNext={
            selectedEventIndex >= 0 &&
            selectedEventIndex < sequencePayload.events.length - 1
              ? () =>
                  setSequenceSelectedEventId(
                    sequencePayload.events[selectedEventIndex + 1].id,
                  )
              : undefined
          }
          onClose={() => setSequenceSelectedEventId(null)}
          onOpenInTab={
            selectedEventAbsolutePath
              ? () => {
                  events.emit({
                    type: 'file:open',
                    source: 'file-overlay',
                    timestamp: Date.now(),
                    payload: { path: selectedEventAbsolutePath },
                  });
                  setSequenceSelectedEventId(null);
                }
              : undefined
          }
        />
      )}
      {overlayFile && (
        <FileOverlay
          filePath={overlayFile.filePath}
          fileName={overlayFile.fileName}
          onClose={() => setOverlayFile(null)}
          onOpenInTab={() => {
            // Emit with a non-`file-city-panel` source so the framework opens a
            // regular file-editor tab instead of routing to `pierre-file`.
            events.emit({
              type: 'file:open',
              source: 'file-overlay',
              timestamp: Date.now(),
              payload: { path: overlayFile.filePath },
            });
            setOverlayFile(null);
          }}
        />
      )}
    </div>
  );
};

const Placeholder: React.FC<{ building: boolean }> = ({ building }) => {
  const { theme } = useTheme();
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
      {building ? 'Building city…' : 'No file tree available'}
    </div>
  );
};
