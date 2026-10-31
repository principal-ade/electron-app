import type { RemoteDriftInfo } from '@principal-ai/repository-monitoring-server';
import { getRemoteDriftStatus } from './remoteDriftStatus';

const drift: RemoteDriftInfo = {
  defaultBranch: 'main',
  trackingSha: 'a'.repeat(40),
  remoteSha: 'a'.repeat(40),
  moved: false,
  checkedAt: 1000,
};

describe('remote drift status', () => {
  it('leaves the existing cache display alone before any probe', () => {
    expect(getRemoteDriftStatus(undefined)).toBeNull();
  });

  it('shows synced only for matching known commits and preserves check time', () => {
    expect(getRemoteDriftStatus(drift)).toEqual({
      kind: 'synced',
      label: 'Synced',
      title: expect.stringContaining(
        'does not describe the checked-out branch',
      ),
      checkedAt: 1000,
    });
  });

  it('shows a remote change for different commits without trusting moved', () => {
    expect(
      getRemoteDriftStatus({
        ...drift,
        remoteSha: 'b'.repeat(40),
        moved: false,
      }),
    ).toMatchObject({ kind: 'changed', label: 'Remote changed' });
  });

  it.each([
    { trackingSha: null },
    { remoteSha: null },
    { trackingSha: null, remoteSha: null },
    { trackingSha: '' },
    { remoteSha: '' },
  ])('does not claim synced with missing commits: %p', (missing) => {
    expect(getRemoteDriftStatus({ ...drift, ...missing })).toMatchObject({
      kind: 'unknown',
      label: 'Unknown',
    });
  });

  it('does not claim synced after a failed probe even if commits match', () => {
    expect(
      getRemoteDriftStatus({ ...drift, error: 'Network timeout' }),
    ).toEqual({
      kind: 'error',
      label: 'Check failed',
      title: 'Network timeout',
      checkedAt: 1000,
    });
  });

  it('shows synced after a successful fetch has reconciled the tracking ref', () => {
    expect(getRemoteDriftStatus({ ...drift, fetchedAt: 2000 })).toMatchObject({
      kind: 'synced',
      checkedAt: 1000,
    });
  });
});
