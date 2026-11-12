import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, FolderGit2, Loader2 } from 'lucide-react';
import { useSyncAllOptional } from './SyncAllContext';

function RepoAvatar({
  owner,
  avatarUrl,
}: {
  owner?: string;
  avatarUrl?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!owner || broken) {
    return <FolderGit2 size={14} style={{ flexShrink: 0 }} />;
  }
  return (
    <img
      src={avatarUrl ?? `https://github.com/${owner}.png?size=64`}
      alt=""
      width={18}
      height={18}
      style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
      onError={() => setBroken(true)}
    />
  );
}

/**
 * Titlebar pill that walks the sync-all run one repo at a time: rounded
 * square owner avatar + repo name + "Syncing i/n". Idle renders nothing; the
 * completion summary lingers briefly after the run.
 */
export const SyncAllIndicator: React.FC = () => {
  const { theme } = useTheme();
  const syncAll = useSyncAllOptional();
  if (!syncAll) return null;
  const { isSyncing, current, summary } = syncAll;

  if (!isSyncing && !summary) return null;

  if (isSyncing && current) {
    return (
      <div
        role="status"
        aria-live="polite"
        title={`Syncing ${current.name} (${current.index}/${current.total}) — ${current.path}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '6px',
          backgroundColor: theme.colors.backgroundSecondary,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
          fontSize: theme.fontSizes[1],
          fontWeight: 500,
          fontFamily: theme.fonts.body,
          whiteSpace: 'nowrap',
          maxWidth: 320,
          overflow: 'hidden',
          WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
        }}
      >
        <RepoAvatar owner={current.owner} avatarUrl={current.avatarUrl} />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {current.name}
        </span>
        <span style={{ color: theme.colors.textSecondary, flexShrink: 0 }}>
          Syncing {current.index}/{current.total}…
        </span>
        <Loader2
          size={14}
          style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
        />
      </div>
    );
  }

  if (!isSyncing && summary) {
    const label =
      summary.total === 0
        ? 'Nothing to sync'
        : summary.fastForwarded > 0
          ? `Synced ${summary.fastForwarded}/${summary.total}`
          : `Checked ${summary.total} — up to date`;
    return (
      <div
        role="status"
        title={
          `Sync all finished: ${summary.fastForwarded} fast-forwarded, ` +
          `${summary.upToDate} up to date, ${summary.skipped} skipped, ` +
          `${summary.failed} failed.`
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '6px',
          backgroundColor: theme.colors.backgroundSecondary,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
          fontSize: theme.fontSizes[1],
          fontWeight: 500,
          fontFamily: theme.fonts.body,
          whiteSpace: 'nowrap',
          WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
        }}
      >
        <Check size={14} color={theme.colors.success ?? theme.colors.primary} />
        <span>{label}</span>
      </div>
    );
  }

  return null;
};
