import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { SubsystemModelHydrated } from '@principal-ai/subsystems-core';
import { SubsystemModelService } from '../main-process-api/SubsystemModelService';
import { SubsystemModelGraph } from './SubsystemModelGraph';

export const SubsystemModelTabContent: React.FC<{ modelId: string }> = ({
  modelId,
}) => {
  const { theme } = useTheme();
  const [model, setModel] = useState<SubsystemModelHydrated | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void SubsystemModelService.get(modelId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError('This subsystem model could not be found or is invalid.');
          setModel(null);
          return;
        }
        setModel(result);
      })
      .catch((loadError) => {
        console.error(
          '[SubsystemModelTabContent] Failed to load model:',
          loadError,
        );
        if (!cancelled) {
          setError('Could not load this subsystem model.');
          setModel(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelId]);

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
