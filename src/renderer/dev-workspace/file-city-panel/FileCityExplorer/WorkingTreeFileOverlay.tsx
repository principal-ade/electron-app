import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink } from 'lucide-react';
import { FileDiff, type FileDiffMetadata } from '@pierre/diffs/react';
import { parsePatchFiles } from '@pierre/diffs';
import { GitService } from '../../../main-process-api/GitService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';

/**
 * Synthesize a unified-diff patch for an untracked file so the FileDiff
 * pipeline can render it as all-additions. Mirrors the format
 * `git diff --no-index /dev/null <file>` produces.
 */
function buildUntrackedFilePatch(
  filePath: string,
  content: string,
): string {
  const hasTrailingNewline = content.endsWith('\n');
  const split = content.split('\n');
  // `"a\nb\n".split("\n")` → ["a","b",""] — drop the trailing empty so it
  // doesn't render as a phantom blank line.
  const lines = hasTrailingNewline ? split.slice(0, -1) : split;
  const header = [
    `diff --git a/${filePath} b/${filePath}`,
    'new file mode 100644',
    'index 0000000..0000000',
    '--- /dev/null',
    `+++ b/${filePath}`,
  ].join('\n');
  if (lines.length === 0) {
    return header + '\n';
  }
  const body = lines.map((line) => `+${line}`).join('\n');
  const tail = hasTrailingNewline ? '\n' : '\n\\ No newline at end of file\n';
  return `${header}\n@@ -0,0 +1,${lines.length} @@\n${body}${tail}`;
}

const fileDiffOptions = {
  diffStyle: 'unified',
  disableFileHeader: true,
} as const;

export interface WorkingTreeFileOverlayProps {
  repositoryPath: string;
  /** Repo-relative path that was clicked. */
  filePath: string;
  onClose: () => void;
  onOpenInTab?: () => void;
}

/**
 * Slide-in twin of `CommitFileOverlay` but driven by `git diff HEAD` instead
 * of `git show <sha>`. Untracked files won't have hunks (no HEAD baseline) —
 * the empty state handles that case.
 */
export const WorkingTreeFileOverlay: React.FC<WorkingTreeFileOverlayProps> = ({
  repositoryPath,
  filePath,
  onClose,
  onOpenInTab,
}) => {
  const { theme } = useTheme();
  const [diffText, setDiffText] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    GitService.getWorkingTreeDiff(repositoryPath)
      .then((text) => {
        if (cancelled) return;
        setDiffText(text);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load diff');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repositoryPath]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Per-chunk parse mirrors `CommitFileOverlay` — one malformed file header
  // shouldn't drop sibling files.
  const fileDiffs = React.useMemo<FileDiffMetadata[]>(() => {
    if (!diffText) return [];
    const chunks = diffText
      .split(/(?=^diff --git )/m)
      .filter((c) => c.trim().length > 0);
    if (chunks.length === 0) {
      try {
        return parsePatchFiles(diffText).flatMap((p) => p.files);
      } catch {
        return [];
      }
    }
    const out: FileDiffMetadata[] = [];
    for (const chunk of chunks) {
      try {
        const parsed = parsePatchFiles(chunk);
        out.push(...parsed.flatMap((p) => p.files));
      } catch {
        /* skip unparseable file */
      }
    }
    return out;
  }, [diffText]);

  const trackedDiff = React.useMemo<FileDiffMetadata | null>(() => {
    if (fileDiffs.length === 0) return null;
    const direct = fileDiffs.find((f) => f.name === filePath);
    if (direct) return direct;
    const byPrev = fileDiffs.find((f) => f.prevName === filePath);
    if (byPrev) return byPrev;
    return fileDiffs.find((f) => f.name.endsWith(filePath)) ?? null;
  }, [fileDiffs, filePath]);

  // Fallback for untracked files — `git diff HEAD` skips them, so once the
  // patch finishes loading and didn't include this path, read the file off
  // disk and synthesize an all-additions patch.
  const [untrackedDiff, setUntrackedDiff] =
    React.useState<FileDiffMetadata | null>(null);
  React.useEffect(() => {
    setUntrackedDiff(null);
    if (loading) return;
    if (trackedDiff) return;
    let cancelled = false;
    const absPath = filePath.startsWith('/')
      ? filePath
      : `${repositoryPath.replace(/\/+$/, '')}/${filePath}`;
    FileSystemService.readFile(absPath)
      .then((result) => {
        if (cancelled || !result) return;
        const patch = buildUntrackedFilePatch(filePath, result.content);
        try {
          const parsed = parsePatchFiles(patch).flatMap((p) => p.files);
          if (parsed[0]) setUntrackedDiff(parsed[0]);
        } catch {
          /* fall through to empty state */
        }
      })
      .catch(() => {
        /* file unreadable — empty state will show */
      });
    return () => {
      cancelled = true;
    };
  }, [loading, trackedDiff, filePath, repositoryPath]);

  const selectedDiff = trackedDiff ?? untrackedDiff;

  const fileName = filePath.split('/').pop() || filePath;

  const { additions, deletions } = React.useMemo(() => {
    if (!selectedDiff) return { additions: 0, deletions: 0 };
    let a = 0;
    let d = 0;
    for (const hunk of selectedDiff.hunks) {
      a += hunk.additionLines;
      d += hunk.deletionLines;
    }
    return { additions: a, deletions: d };
  }, [selectedDiff]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '50%',
        backgroundColor: `color-mix(in srgb, ${theme.colors.background} 88%, transparent)`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRight: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
        animation: 'workingTreeFileOverlaySlideIn 220ms ease-out',
      }}
    >
      <style>{`
        @keyframes workingTreeFileOverlaySlideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontFamily: theme.fonts.monospace,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
          title={`${filePath} (working tree)`}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {fileName}
          </span>
          {selectedDiff && (additions > 0 || deletions > 0) && (
            <span
              style={{
                fontSize: theme.fontSizes[0],
                flexShrink: 0,
                display: 'inline-flex',
                gap: 6,
              }}
            >
              <span style={{ color: theme.colors.success }}>+{additions}</span>
              <span style={{ color: theme.colors.error }}>−{deletions}</span>
            </span>
          )}
          <span
            style={{
              color: theme.colors.textTertiary,
              fontSize: theme.fontSizes[0],
              flexShrink: 0,
            }}
          >
            working tree
          </span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onOpenInTab && (
            <button
              type="button"
              onClick={onOpenInTab}
              aria-label="Open in tab"
              title="Open in tab"
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                lineHeight: 0,
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: theme.fontSizes[3],
              lineHeight: 1,
              padding: '2px 8px',
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            Loading diff…
          </div>
        )}
        {!loading && error && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: theme.colors.error,
            }}
          >
            {error}
          </div>
        )}
        {!loading && !error && selectedDiff && (
          <FileDiff
            fileDiff={selectedDiff}
            options={fileDiffOptions}
            style={{
              display: 'block',
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.monospace,
              ['--diffs-light-bg' as string]: theme.colors.background,
              ['--diffs-dark-bg' as string]: theme.colors.background,
            }}
          />
        )}
        {!loading && !error && !selectedDiff && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            No working-tree diff for {fileName} (untracked or unchanged).
          </div>
        )}
      </div>
    </div>
  );
};
