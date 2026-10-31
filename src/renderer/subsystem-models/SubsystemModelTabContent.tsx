import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { SubsystemModelHydrated } from '@principal-ai/subsystems-core';
import { SubsystemModelService } from '../main-process-api/SubsystemModelService';
import { useFileWatch } from '../hooks/useFileWatch';
import { SubsystemModelGraph } from './SubsystemModelGraph';

export const SubsystemModelTabContent: React.FC<{ modelId: string }> = ({
  modelId,
}) => {
  const { theme } = useTheme();
  const [model, setModel] = useState<SubsystemModelHydrated | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);

  // `initial` drives the spinner; a reload from the file watcher swaps the
  // graph in place so the view does not flash while an agent rewrites the file.
  const loadModel = useCallback(
    async (initial: boolean) => {
      if (initial) setLoading(true);
      setError(null);
      try {
        const result = await SubsystemModelService.get(modelId);
        if (!result) {
          setError('This subsystem model could not be found or is invalid.');
          setModel(null);
          return;
        }
        setModel(result);
      } catch (loadError) {
        console.error(
          '[SubsystemModelTabContent] Failed to load model:',
          loadError,
        );
        setError('Could not load this subsystem model.');
        setModel(null);
      } finally {
        if (initial) setLoading(false);
      }
    },
    [modelId],
  );

  useEffect(() => {
    let cancelled = false;
    setFilePath(null);
    void loadModel(true);
    void SubsystemModelService.getFilePath(modelId)
      .then((path) => {
        if (!cancelled) setFilePath(path);
      })
      .catch(() => {
        if (!cancelled) setFilePath(null);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, loadModel]);

  const reloadModel = useCallback(() => void loadModel(false), [loadModel]);
  useFileWatch(filePath, reloadModel, { enabled: !!filePath });

  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          height: '100%',
          placeItems: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.background,
        }}
      >
        Loading subsystem model…
      </div>
    );
  }

  if (error || !model) {
    return (
      <div
        role="alert"
        style={{
          display: 'grid',
          height: '100%',
          placeItems: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.background,
        }}
      >
        {error ?? 'Subsystem model unavailable.'}
      </div>
    );
  }

  return <SubsystemModelGraph model={model} />;
};
