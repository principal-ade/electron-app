import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Check,
  CircleDot,
  EyeOff,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  LoaderCircle,
  X,
} from 'lucide-react';
import type { WatchedPullRequest } from '../../../shared/main-process-api-interfaces/PullRequestWatchAPI';
import { PullRequestWatchService } from '../../main-process-api/PullRequestWatchService';
import { ShellService } from '../../main-process-api/ShellService';

/** One-line status for a watched PR: what a glance at the row should answer. */
export function describePullRequestStatus(pr: WatchedPullRequest): string {
  if (pr.state === 'merged') return 'Merged';
  if (pr.state === 'closed') return 'Closed';
  const parts: string[] = [];
  if (pr.draft) parts.push('Draft');
  switch (pr.checks.status) {
    case 'pending':
      parts.push(
        `Checks running (${pr.checks.passed + pr.checks.failed}/${pr.checks.total})`,
      );
      break;
    case 'failure':
      parts.push(
        `${pr.checks.failed} check${pr.checks.failed === 1 ? '' : 's'} failed`,
      );
      break;
    case 'success':
      parts.push('Checks passed');
      break;
    default:
      break;
  }
  switch (pr.review) {
    case 'approved':
      parts.push('Approved');
      break;
    case 'changes_requested':
      parts.push('Changes requested');
      break;
    case 'pending':
      parts.push('Review pending');
      break;
    default:
      break;
  }
  if (pr.mergeable === false) parts.push('Conflicts');
  if (pr.pollError) parts.push('Status unavailable');
  return parts.join(' · ') || 'Open';
}

/** A watched pull request. Clicking opens it on GitHub in the browser. */
export const HomePullRequestRow: React.FC<{
  pullRequest: WatchedPullRequest;
}> = ({ pullRequest: pr }) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = `${pr.owner}/${pr.repo}#${pr.number}`;
  const open = () => {
    void ShellService.openExternal(pr.url);
  };
  const unwatch = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await PullRequestWatchService.unwatch(pr.id);
      if (!result.success) setError(result.error ?? 'Could not unwatch.');
    } catch {
      setError('Could not unwatch. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const stateIcon = (() => {
    if (pr.state === 'merged')
      return <GitMerge size={13} color={theme.colors.primary} />;
    if (pr.state === 'closed')
      return <GitPullRequestClosed size={13} color={theme.colors.error} />;
    if (pr.draft)
      return (
        <GitPullRequestDraft size={13} color={theme.colors.textSecondary} />
      );
    return <GitPullRequest size={13} color={theme.colors.success} />;
  })();

  const checksIcon = (() => {
    if (pr.state !== 'open') return null;
    switch (pr.checks.status) {
      case 'pending':
        return (
          <LoaderCircle
            size={12}
            color={theme.colors.warning}
            aria-label="Checks running"
          />
        );
      case 'failure':
        return (
          <X size={12} color={theme.colors.error} aria-label="Checks failed" />
        );
      case 'success':
        return (
          <Check
            size={12}
            color={theme.colors.success}
            aria-label="Checks passed"
          />
        );
      default:
        return null;
    }
  })();

  const reviewIcon =
    pr.state === 'open' && pr.review === 'changes_requested' ? (
      <CircleDot
        size={12}
        color={theme.colors.error}
        aria-label="Changes requested"
      />
    ) : pr.state === 'open' && pr.review === 'approved' ? (
      <CircleDot size={12} color={theme.colors.success} aria-label="Approved" />
    ) : null;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${label} in browser`}
        title={`${label}\n${describePullRequestStatus(pr)}`}
        onClick={open}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px 8px 14px',
          cursor: 'pointer',
          background: hovered ? theme.colors.backgroundSecondary : undefined,
        }}
      >
        {stateIcon}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
            }}
          >
            {pr.title}
          </span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[0],
            }}
          >
            {label} · {describePullRequestStatus(pr)}
          </span>
        </span>
        {checksIcon}
        {reviewIcon}
        <button
          type="button"
          aria-label={`Stop watching ${label}`}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            void unwatch();
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: theme.colors.textSecondary,
            display: 'inline-flex',
            alignItems: 'center',
            padding: 4,
            cursor: busy ? 'wait' : 'pointer',
            visibility: hovered ? 'visible' : 'hidden',
          }}
        >
          <EyeOff size={13} />
        </button>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            color: theme.colors.error,
            fontSize: theme.fontSizes[0],
            padding: '0 14px 6px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};
