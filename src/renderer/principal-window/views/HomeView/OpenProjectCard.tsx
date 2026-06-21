import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ArrowDown, ArrowUp, FolderGit2, GitBranch } from 'lucide-react';
import { GitService } from '../../../main-process-api/GitService';

type ThemeShape = ReturnType<typeof useTheme>['theme'];

/** One open project window the home view surfaces so you can jump back to it. */
export interface OpenProjectEntry {
  /** Local repo path — the click target and git-status source. */
  key: string;
  /** Last-segment label, e.g. "electron-app". */
  label: string;
  /** GitHub owner login, when known; drives the avatar. */
  ownerLogin?: string;
}

/** Parsed `git status --porcelain=v1 --branch` summary. */
interface GitStatusSummary {
  branch: string;
  ahead: number;
  behind: number;
  /** Working-tree entries (staged + unstaged + untracked). */
  changed: number;
}

/**
 * Parse the porcelain v1 `--branch` output: the first `## …` line carries the
 * branch + optional `[ahead N, behind M]`; every remaining line is one changed
 * path. No network — counts come straight from the local index/worktree.
 */
function parseStatus(stdout: string): GitStatusSummary {
  const lines = stdout.split('\n').filter((l) => l.length > 0);
  let branch = 'detached';
  let ahead = 0;
  let behind = 0;
  let changed = 0;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      const header = line.slice(3);
      const aheadMatch = header.match(/ahead (\d+)/);
      const behindMatch = header.match(/behind (\d+)/);
      if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
      if (behindMatch) behind = parseInt(behindMatch[1], 10);
      // Strip the tracking suffix `[ahead …]` and the `...upstream` part.
      const namePart = header.replace(/ \[.*\]$/, '');
      if (namePart.startsWith('No commits yet on ')) {
        branch = namePart.slice('No commits yet on '.length);
      } else if (namePart.startsWith('HEAD (no branch)')) {
        branch = 'detached';
      } else {
        branch = namePart.split('...')[0];
      }
    } else {
      changed += 1;
    }
  }
  return { branch, ahead, behind, changed };
}

function useGitStatus(path: string): GitStatusSummary | null {
  const [status, setStatus] = React.useState<GitStatusSummary | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await GitService.execCommand(path, [
          'status',
          '--porcelain=v1',
          '--branch',
        ]);
        if (!cancelled) setStatus(parseStatus(result.stdout));
      } catch {
        // Not a git repo / git unavailable — leave null so the card just shows
        // its name.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);
  return status;
}

/**
 * Compact card for a project that currently has a window open. Shows the repo
 * identity plus a live git-status line (branch, ahead/behind, changed files).
 * Clicking focuses the existing window (the caller routes through
 * `openDevWorkspace`, which focuses rather than re-creates).
 */
export function OpenProjectCard({
  entry,
  theme,
  onClick,
}: {
  entry: OpenProjectEntry;
  theme: ThemeShape;
  onClick: () => void;
}) {
  const status = useGitStatus(entry.key);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Focus ${entry.label}`}
      style={{
        width: '100%',
        minWidth: 0,
        padding: '12px 14px',
        borderRadius: 12,
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.backgroundSecondary,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        textAlign: 'left',
        transition: 'border-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        {entry.ownerLogin ? (
          <img
            src={`https://github.com/${entry.ownerLogin}.png?size=40`}
            alt={entry.ownerLogin}
            width={18}
            height={18}
            style={{
              borderRadius: 5,
              flex: '0 0 auto',
              border: `1px solid ${theme.colors.border}`,
            }}
          />
        ) : (
          <FolderGit2 size={16} color={theme.colors.textSecondary} />
        )}
        <span
          style={{
            fontWeight: theme.fontWeights.semibold,
            fontSize: theme.fontSizes[2],
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {entry.label}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: theme.colors.textTertiary,
          fontFamily: theme.fonts.monospace,
          fontSize: theme.fontSizes[0],
          minWidth: 0,
        }}
      >
        {status ? (
          <>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                minWidth: 0,
              }}
            >
              <GitBranch size={12} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {status.branch}
              </span>
            </span>
            {status.ahead > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <ArrowUp size={12} />
                {status.ahead}
              </span>
            )}
            {status.behind > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <ArrowDown size={12} />
                {status.behind}
              </span>
            )}
            <span
              style={{
                marginLeft: 'auto',
                flex: '0 0 auto',
                color:
                  status.changed > 0
                    ? theme.colors.warning
                    : theme.colors.textTertiary,
              }}
            >
              {status.changed > 0 ? `${status.changed} changed` : 'clean'}
            </span>
          </>
        ) : (
          <span>—</span>
        )}
      </div>
    </button>
  );
}
