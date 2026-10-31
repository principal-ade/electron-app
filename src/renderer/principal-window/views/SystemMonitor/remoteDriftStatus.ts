import type { RemoteDriftInfo } from '@principal-ai/repository-monitoring-server';

interface RemoteDriftStatus {
  kind: 'synced' | 'changed' | 'unknown' | 'error';
  label: string;
  title: string;
  checkedAt: number;
}

export function getRemoteDriftStatus(
  drift: RemoteDriftInfo | undefined,
): RemoteDriftStatus | null {
  if (!drift) return null;

  const checkedAt = drift.checkedAt;
  if (drift.error) {
    return {
      kind: 'error',
      label: 'Check failed',
      title: drift.error,
      checkedAt,
    };
  }
  if (!drift.trackingSha || !drift.remoteSha) {
    return {
      kind: 'unknown',
      label: 'Unknown',
      title:
        'Both the remote commit and local tracking commit are needed to compare.',
      checkedAt,
    };
  }

  const synced = drift.trackingSha === drift.remoteSha;
  return {
    kind: synced ? 'synced' : 'changed',
    label: synced ? 'Synced' : 'Remote changed',
    title: synced
      ? `origin/${drift.defaultBranch} matches its local tracking ref at the last check. This does not describe the checked-out branch or uncommitted changes.`
      : `origin/${drift.defaultBranch} differs from its local tracking ref at the last check.`,
    checkedAt,
  };
}
