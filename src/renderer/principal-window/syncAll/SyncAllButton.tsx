import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ArrowDownToLine, Loader2 } from 'lucide-react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { useSyncAllOptional } from './SyncAllContext';
import { formatAutoSyncInterval } from './autoSyncPrefs';

/**
 * Sky View entry point for the sync-all run: fast-forwards every registered
 * clone that can be safely fast-forwarded, one at a time. Progress surfaces
 * in the titlebar pill; this button only reflects running state.
 */
export const SyncAllButton: React.FC<{ repositories: AlexandriaEntry[] }> = ({
  repositories,
}) => {
  const { theme } = useTheme();
  const syncAll = useSyncAllOptional();
  const isSyncing = syncAll?.isSyncing ?? false;
  const current = syncAll?.current ?? null;
  const start = syncAll?.start;
  const autoSync = syncAll?.autoSync;

  const cloneCount = repositories.filter((r) => r.path).length;
  const autoSuffix =
    autoSync?.enabled && !isSyncing
      ? ` Auto-sync is on (every ${formatAutoSyncInterval(autoSync.intervalMinutes)}).`
      : '';

  return (
    <button
      type="button"
      disabled={isSyncing || cloneCount === 0 || !start}
      onClick={() => {
        if (start) void start(repositories);
      }}
      title={
        isSyncing
          ? current
            ? `Syncing ${current.name} (${current.index}/${current.total})…`
            : 'Syncing registered clones…'
          : cloneCount === 0
            ? 'No registered clones to sync'
            : `Fast-forward all registered clones that can be safely fast-forwarded (${cloneCount} checked one at a time).${autoSuffix}`
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '6px',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`,
        cursor: isSyncing || cloneCount === 0 ? 'default' : 'pointer',
        opacity: isSyncing || cloneCount === 0 ? 0.7 : 1,
        fontSize: theme.fontSizes[1],
        fontWeight: 500,
        fontFamily: theme.fonts.body,
      }}
    >
      {isSyncing ? (
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
      ) : (
        <ArrowDownToLine size={14} />
      )}
      <span>
        {isSyncing && current
          ? `Syncing ${current.index}/${current.total}`
          : 'Sync all'}
      </span>
    </button>
  );
};
