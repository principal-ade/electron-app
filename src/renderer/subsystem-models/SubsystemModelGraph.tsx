import React, { useCallback, useEffect, useState } from 'react';
import {
  PierreFileView,
  PierreSnippetView,
  PierreTrailCodeView,
  SubsystemComponentGraph,
  purlRepoKey,
  type SubsystemOpenFileOptions,
  type TrailViewerContext,
} from '@principal-ai/subsystems-react';
import type { SubsystemModelHydrated } from '@principal-ai/subsystems-core';
import '@xyflow/react/dist/style.css';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { repoPurlFromEntry } from '../../shared/topics/repoPurl';

function normalizeModelPath(file: string): string {
  const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split('/').some((part) => part === '..')
  ) {
    throw new Error(`Invalid repository-relative model path: ${file}`);
  }
  return normalized;
}

function joinRepositoryPath(root: string, relativePath: string): string {
  const separator = root.includes('\\') ? '\\' : '/';
  const normalizedRoot = root.replace(/[\\/]+$/, '');
  return `${normalizedRoot}${separator}${relativePath.replace(/\//g, separator)}`;
}

export const SubsystemModelGraph: React.FC<{
  model: SubsystemModelHydrated;
}> = ({ model }) => {
  const [layoutDirection, setLayoutDirection] = useState<
    'horizontal' | 'vertical' | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    void UserPreferencesService.getPreferences().then((preferences) => {
      if (!isMounted) return;
      setLayoutDirection(
        preferences.subsystemModelLayoutDirection === 'horizontal'
          ? 'horizontal'
          : 'vertical',
      );
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const readFile = useCallback(
    async (file: string, purl?: string): Promise<string> => {
      const relativePath = normalizeModelPath(file);
      const fileKey = relativePath.toLowerCase();
      const modelPurls = purl
        ? [purl]
        : [
            ...model.components
              .filter(
                (component) =>
                  component.file
                    .replace(/\\/g, '/')
                    .replace(/^\.\//, '')
                    .toLowerCase() === fileKey,
              )
              .map((component) => component.purl),
            ...(model.trails ?? [])
              .flatMap((trail) => trail.steps)
              .filter(
                (step) =>
                  step.file
                    .replace(/\\/g, '/')
                    .replace(/^\.\//, '')
                    .toLowerCase() === fileKey,
              )
              .map((step) => step.purl),
          ];
      const modelRepoKeys = new Set(
        modelPurls.map(purlRepoKey).filter((key): key is string => key != null),
      );
      if (modelRepoKeys.size !== 1) {
        throw new Error(
          modelRepoKeys.size === 0
            ? `No repository is associated with ${file}`
            : `The repository for ${file} is ambiguous`,
        );
      }

      const repoKey = [...modelRepoKeys][0];
      if (!repoKey) throw new Error(`No repository is associated with ${file}`);
      const repositories = await AlexandriaService.getRepositories();
      const matches = repositories.filter((repository) => {
        const identity = repoPurlFromEntry(repository);
        return identity != null && purlRepoKey(identity) === repoKey;
      });
      if (matches.length !== 1) {
        throw new Error(
          matches.length === 0
            ? `Repository ${repoKey} is not registered locally`
            : `Repository ${repoKey} has multiple local checkouts`,
        );
      }

      const result = await FileSystemService.readFile(
        joinRepositoryPath(matches[0].path, relativePath),
      );
      if (!result) throw new Error(`File not found: ${file}`);
      return result.content;
    },
    [model],
  );

  const renderFileViewer = useCallback(
    (file: string, options?: SubsystemOpenFileOptions) => {
      const startLine = options?.startLine;
      if (startLine != null && !options?.fullFile) {
        return (
          <PierreSnippetView
            filePath={file}
            fileName={file.split('/').pop() ?? file}
            startLine={startLine}
            endLine={options?.endLine ?? startLine}
            focusLine={startLine}
            contextLines={40}
            readFile={(path) => readFile(path)}
          />
        );
      }
      return (
        <PierreFileView
          filePath={file}
          fileName={file.split('/').pop() ?? file}
          readFile={(path) => readFile(path)}
          focusLine={options?.fullFile ? startLine : undefined}
        />
      );
    },
    [readFile],
  );

  const renderTrailViewer = useCallback(
    (context: TrailViewerContext) => (
      <PierreTrailCodeView
        trail={context.trail}
        stepIndex={context.stepIndex}
        readFile={readFile}
        contextLines={8}
        onOpenFile={context.onOpenFile}
        resolveSymbol={context.resolveSymbol}
        onSymbolClick={context.onSymbolClick}
        onVisibleStepChange={context.onVisibleStepChange}
      />
    ),
    [readFile],
  );

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      {layoutDirection && (
        <SubsystemComponentGraph
          components={model.components}
          trails={model.trails}
          title={model.title}
          description={model.description}
          notes={model.notes}
          defaultLayoutDirection={layoutDirection}
          persistKey={model.id ?? model.title}
          renderFileViewer={renderFileViewer}
          renderTrailViewer={renderTrailViewer}
        />
      )}
    </div>
  );
};
