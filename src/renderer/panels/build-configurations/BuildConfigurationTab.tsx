/**
 * BuildConfigurationTab
 *
 * Live tab container over BuildConfigurationTabContent: loads the config
 * through the TIPC router, grants through SecretsService (values pass
 * through renderer memory only in transit to main, never stored), and
 * surfaces agent secret requests as an inline banner.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  BuildRunStatus,
  StoredBuildConfiguration,
} from '../../../shared/build-configurations/types';
import {
  resolveBuildCheckoutDir,
  secretStoreRepoId,
} from '../../../shared/build-configurations/types';
import type { BuildSecretsRequestedEvent } from '../../../shared/build-configurations/events';
import { BuildConfigurationService } from '../../main-process-api/BuildConfigurationService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { SecretsService } from '../../main-process-api/SecretsService';
import {
  BuildConfigurationTabContent,
  type BuildConfigurationView,
} from './BuildConfigurationTabContent';

export interface BuildConfigurationTabProps {
  configId: string;
}

function toView(
  config: StoredBuildConfiguration,
  grantedKeys: Set<string>,
): BuildConfigurationView {
  return {
    id: config.id,
    name: config.name,
    repo: config.repo,
    checkout: config.checkout,
    command: config.command,
    secrets: config.secrets.map((secret) => ({
      ...secret,
      granted: grantedKeys.has(secret.env),
    })),
    confirmed: config.secretConfirmation !== null,
  };
}

function SecretsRequestedBanner({
  missing,
  onDismiss,
}: {
  missing: string[];
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '0 auto 12px',
        maxWidth: 720,
        padding: '10px 14px',
        border: `1px solid ${theme.colors.warning}60`,
        borderRadius: 8,
        background: `${theme.colors.warning}12`,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        color: theme.colors.text,
        lineHeight: 1.5,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        An agent requested {missing.length === 1 ? 'a secret' : 'secrets'} for
        this build:{' '}
        <span style={{ fontFamily: theme.fonts.monospace }}>
          {missing.join(', ')}
        </span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          padding: '4px 12px',
          background: 'none',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[0],
          color: theme.colors.text,
          whiteSpace: 'nowrap',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

export const BuildConfigurationTab: React.FC<BuildConfigurationTabProps> = ({
  configId,
}) => {
  const { theme } = useTheme();
  const [config, setConfig] = useState<StoredBuildConfiguration | null>(null);
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set());
  const [buildsDirectory, setBuildsDirectory] = useState<string | null>(null);
  const [requested, setRequested] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const repoId = useMemo(() => secretStoreRepoId(configId), [configId]);

  const refresh = useCallback(async () => {
    const [loaded, metadata] = await Promise.all([
      BuildConfigurationService.get(configId),
      SecretsService.getMetadata(repoId),
    ]);
    if (!loaded) {
      setError('Build configuration not found.');
      return;
    }
    setConfig(loaded);
    setGrantedKeys(new Set(metadata?.keys ?? []));
  }, [configId, repoId]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setConfig(null);
    UserPreferencesService.getPreferences()
      .then((prefs) => setBuildsDirectory(prefs.buildsDirectory ?? null))
      .catch(() => setBuildsDirectory(null));
    refresh().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(
    () =>
      BuildConfigurationService.onSecretsRequested(
        (event: BuildSecretsRequestedEvent) => {
          if (event.configId === configId && event.missing.length > 0) {
            setRequested(event.missing);
          }
        },
      ),
    [configId],
  );

  const handleSaveSecret = useCallback(
    async (env: string, value: string) => {
      if (!config) return;
      // The value passes through memory only in transit to main; the form
      // clears immediately and nothing here retains it.
      const result = await SecretsService.update({
        repoId,
        repoPath: config.name,
        secrets: { [env]: value },
      });
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to save the secret.');
      }
      await refresh();
    },
    [config, repoId, refresh],
  );

  const handleClearSecret = useCallback(
    async (env: string) => {
      const result = await SecretsService.removeKeys(repoId, [env]);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to clear the secret.');
      }
      await refresh();
    },
    [repoId, refresh],
  );

  // SecretRow fires sync callbacks; surface async failures inline.
  const [actionError, setActionError] = useState<string | null>(null);
  const saveSecret = useCallback(
    (env: string, value: string) => {
      setActionError(null);
      void handleSaveSecret(env, value).catch((err: unknown) =>
        setActionError(err instanceof Error ? err.message : String(err)),
      );
    },
    [handleSaveSecret],
  );
  const clearSecret = useCallback(
    (env: string) => {
      setActionError(null);
      void handleClearSecret(env).catch((err: unknown) =>
        setActionError(err instanceof Error ? err.message : String(err)),
      );
    },
    [handleClearSecret],
  );

  const applySecrets = useCallback(
    (
      next: Array<{ env: string; label: string; required: boolean }>,
      dropGrantsFor: string[] = [],
    ) => {
      if (!config) return;
      setActionError(null);
      void BuildConfigurationService.updateSecrets(config.id, next)
        .then(async (updated) => {
          if (!updated) {
            setActionError('Build configuration not found.');
            return;
          }
          setConfig(updated);
          if (dropGrantsFor.length > 0) {
            await SecretsService.removeKeys(repoId, dropGrantsFor).catch(
              () => {},
            );
          }
          await refresh();
        })
        .catch((err: unknown) =>
          setActionError(err instanceof Error ? err.message : String(err)),
        );
    },
    [config, repoId, refresh],
  );

  const addSecret = useCallback(
    (decl: { env: string; label: string; required: boolean }) => {
      if (!config) return;
      applySecrets([
        ...config.secrets.map(({ env, label, required }) => ({
          env,
          label,
          required,
        })),
        decl,
      ]);
    },
    [config, applySecrets],
  );

  const removeSecretDecl = useCallback(
    (env: string) => {
      if (!config) return;
      const remaining = config.secrets
        .filter((secret) => secret.env !== env)
        .map(({ env: name, label, required }) => ({
          env: name,
          label,
          required,
        }));
      applySecrets(remaining, [env]);
    },
    [config, applySecrets],
  );

  const editSecretDecl = useCallback(
    (
      oldEnv: string,
      decl: { env: string; label: string; required: boolean },
    ) => {
      if (!config) return;
      const next = config.secrets.map((secret) =>
        secret.env === oldEnv ? decl : secret,
      );
      // A renamed declaration leaves its old grant behind; drop it so no
      // orphaned value lingers under build:<configId>.
      applySecrets(next, decl.env === oldEnv ? [] : [oldEnv]);
    },
    [config, applySecrets],
  );

  const reorderSecrets = useCallback(
    (from: number, to: number) => {
      if (!config) return;
      const next = config.secrets.map(({ env, label, required }) => ({
        env,
        label,
        required,
      }));
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      applySecrets(next);
    },
    [config, applySecrets],
  );

  // Run command: start via TIPC, then poll the registry until terminal.
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<
    BuildRunStatus | 'starting' | 'expired' | null
  >(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isStoppingRun, setIsStoppingRun] = useState(false);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      try {
        const record = await BuildConfigurationService.getRun(runId);
        if (cancelled) return;
        if (!record) {
          setRunStatus('expired');
        } else if (record.status === 'running') {
          setRunStatus(record.status);
          return;
        } else {
          setRunStatus(record.status);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setRunError(
            `Could not poll the run: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      if (timer) clearInterval(timer);
    };
    void poll();
    timer = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [runId]);

  const view = config ? toView(config, grantedKeys) : null;
  const requiredMissing =
    view?.secrets.filter((secret) => secret.required && !secret.granted) ?? [];
  const runsIn = config
    ? resolveBuildCheckoutDir({
        checkoutPath: config.checkout.path,
        cwd: config.command.cwd,
        repo: config.repo,
        buildsDirectory,
      })
    : null;
  const canRun =
    !!view?.confirmed && requiredMissing.length === 0 && runsIn !== null;
  const runTitle = !view
    ? undefined
    : !view.confirmed
      ? 'Confirm the secrets below to enable running'
      : requiredMissing.length > 0
        ? `Grant first: ${requiredMissing.map((secret) => secret.env).join(', ')}`
        : runsIn === null
          ? 'Set a builds directory in Settings → General, or set an explicit checkout path'
          : 'Run this build in a terminal';

  const confirmSecrets = useCallback(() => {
    setActionError(null);
    setRunError(null);
    BuildConfigurationService.confirmSecrets(configId).then(
      (updated) => {
        if (!updated) {
          setActionError('Build configuration not found.');
          return;
        }
        setConfig(updated);
      },
      (err: unknown) => {
        setActionError(err instanceof Error ? err.message : String(err));
      },
    );
  }, [configId]);

  const startRun = useCallback(() => {
    setRunError(null);
    setRunId(null);
    setRunStatus('starting');
    BuildConfigurationService.run(configId).then(
      (result) => {
        if (result.ok) {
          setRunId(result.runId);
          setRunStatus(result.status);
        } else {
          setRunStatus(null);
          setRunError(
            result.code === 'secrets-missing'
              ? `Missing secrets: ${(result.missing ?? []).join(', ')}. Grant them above, then run again.`
              : result.code === 'not-confirmed'
                ? 'Confirm the secrets below, then run again.'
                : result.code === 'no-window'
                  ? 'No live window to host the build terminal.'
                  : result.error,
          );
        }
      },
      (err: unknown) => {
        setRunStatus(null);
        setRunError(err instanceof Error ? err.message : String(err));
      },
    );
  }, [configId]);

  const stopRun = useCallback(async () => {
    if (!runId || runStatus !== 'running') return;
    setIsStoppingRun(true);
    setRunError(null);
    try {
      const record = await BuildConfigurationService.stopRun(runId);
      if (!record) {
        setRunStatus('expired');
        setRunError('The build run is no longer available to stop.');
      } else {
        setRunStatus(record.status);
      }
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStoppingRun(false);
    }
  }, [runId, runStatus]);

  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: 24,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          color: theme.colors.error,
          background: theme.colors.background,
          height: '100%',
        }}
      >
        {error}
      </div>
    );
  }
  if (!config) {
    return (
      <div
        style={{
          padding: 24,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          color: theme.colors.textMuted,
          background: theme.colors.background,
          height: '100%',
        }}
      >
        Loading build configuration…
      </div>
    );
  }
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: theme.colors.background,
      }}
    >
      <div style={{ paddingTop: 16 }}>
        {requested && (
          <SecretsRequestedBanner
            missing={requested}
            onDismiss={() => setRequested(null)}
          />
        )}
      </div>
      {runError && (
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            role="alert"
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              color: runError ? theme.colors.error : theme.colors.textSecondary,
            }}
          >
            {runError}
          </div>
        </div>
      )}
      {actionError && (
        <div
          role="alert"
          style={{
            maxWidth: 720,
            margin: '0 auto 12px',
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            color: theme.colors.error,
          }}
        >
          {actionError}
        </div>
      )}
      <BuildConfigurationTabContent
        config={toView(config, grantedKeys)}
        buildsDirectory={buildsDirectory}
        onSaveSecret={saveSecret}
        onClearSecret={clearSecret}
        onConfirmSecrets={confirmSecrets}
        onRunBuild={startRun}
        runStatus={runStatus}
        onStopBuild={stopRun}
        stopBuildDisabled={runStatus !== 'running' || isStoppingRun}
        stopBuildPending={isStoppingRun}
        runBuildDisabled={!canRun}
        runBuildTitle={runTitle}
        onAddSecret={addSecret}
        onRemoveSecret={removeSecretDecl}
        onEditSecret={editSecretDecl}
        onReorderSecrets={reorderSecrets}
      />
    </div>
  );
};

export default BuildConfigurationTab;
