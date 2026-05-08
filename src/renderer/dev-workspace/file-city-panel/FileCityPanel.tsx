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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <FileCityExplorer
        cityData={cityData}
        packageRoot=""
        repoLabel={repoLabel}
        repositoryPath={repositoryPath}
        events={events}
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
