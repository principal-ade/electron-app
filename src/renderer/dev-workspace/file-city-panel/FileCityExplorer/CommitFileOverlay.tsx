import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink } from 'lucide-react';
import { FileDiff, type FileDiffMetadata } from '@pierre/diffs/react';
import { parsePatchFiles } from '@pierre/diffs';
import { GitService } from '../../../main-process-api/GitService';

const fileDiffOptions = {
  diffStyle: 'unified',
} as const;

export interface CommitFileOverlayProps {
  repositoryPath: string;
  commitHash: string;
  /** Repo-relative path that was clicked (post-rename). */
  filePath: string;
  onClose: () => void;
  onOpenInTab?: () => void;
}

/**
 * Slide-in overlay that fetches `git show <commit>` once per commit and renders
 * the `FileDiff` for the selected path. Mirrors `FileOverlay`'s visual idiom so
 * commit diffs and file previews feel like the same surface.
 */
export const CommitFileOverlay: React.FC<CommitFileOverlayProps> = ({
  repositoryPath,
  commitHash,
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
    GitService.getCommitDiff(repositoryPath, commitHash)
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
  }, [repositoryPath, commitHash]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Parse once per diffText. Mirrors ReviewCommitPanel's defensive split — a
  // single malformed file header shouldn't drop sibling files.
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

  const selectedDiff = React.useMemo<FileDiffMetadata | null>(() => {
    if (fileDiffs.length === 0) return null;
    const direct = fileDiffs.find((f) => f.name === filePath);
    if (direct) return direct;
    // Rename fallback — clicked path is the new name; parser may report old.
    const byPrev = fileDiffs.find((f) => f.prevName === filePath);
    if (byPrev) return byPrev;
    // Last-resort substring match for path-mangling edge cases.
    return fileDiffs.find((f) => f.name.endsWith(filePath)) ?? null;
  }, [fileDiffs, filePath]);

  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div
      style={{
        // DEBUG: expanded to full pane so the FileDiff can be inspected
        // without the slide-in chrome cramping it. Restore the 50%-width,
        // translucent slide-in once the styling work is done.
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
      }}
    >
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
            fontFamily: theme.fonts.monospace,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={`${filePath} @ ${commitHash.slice(0, 7)}`}
        >
          {fileName}
          <span
            style={{
              color: theme.colors.textTertiary,
              marginLeft: 8,
              fontSize: theme.fontSizes[0],
            }}
          >
            {commitHash.slice(0, 7)}
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

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
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
            No diff for {fileName} in this commit.
          </div>
        )}
      </div>
    </div>
  );
};
