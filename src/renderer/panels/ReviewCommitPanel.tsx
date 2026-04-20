/**
 * ReviewCommitPanel
 *
 * Panel for reviewing commit diffs using @pierre/diffs library
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileDiff, type FileDiffMetadata } from '@pierre/diffs/react';
import { parsePatchFiles } from '@pierre/diffs';
import { GitService } from '../main-process-api/GitService';
import type { ActivityCommit } from '../hooks/useActivityFeed';

export interface ReviewCommitPanelProps {
  repoPath: string;
  repoName: string;
  commit: ActivityCommit;
}

export const ReviewCommitPanel: React.FC<ReviewCommitPanelProps> = ({
  repoPath,
  repoName,
  commit,
}) => {
  const { theme } = useTheme();
  const [diffText, setDiffText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDiff = async () => {
      setLoading(true);
      setError(null);
      try {
        const diff = await GitService.getCommitDiff(repoPath, commit.hash);
        setDiffText(diff);
      } catch (err) {
        console.error('Failed to load commit diff:', err);
        setError(err instanceof Error ? err.message : 'Failed to load diff');
      } finally {
        setLoading(false);
      }
    };

    loadDiff();
  }, [repoPath, commit.hash]);

  // Parse the patch into individual file diffs
  const fileDiffs = useMemo<FileDiffMetadata[]>(() => {
    if (!diffText) return [];
    try {
      const parsedPatches = parsePatchFiles(diffText);
      // Flatten all files from all patches
      return parsedPatches.flatMap(patch => patch.files);
    } catch (err) {
      console.error('Failed to parse patch:', err);
      return [];
    }
  }, [diffText]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 16,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {repoName}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.monospace,
          }}
        >
          {commit.hash.substring(0, 7)}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[2],
            marginTop: 8,
          }}
        >
          {commit.message}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            marginTop: 4,
          }}
        >
          {commit.author} &bull; {new Date(commit.date).toLocaleString()}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: theme.colors.background,
        }}
      >
        {loading && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            Loading diff...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: theme.colors.error,
            }}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && fileDiffs.length > 0 && (
          <div style={{ padding: 16 }}>
            {fileDiffs.map((fileDiff) => (
              <div
                key={`${fileDiff.prevName || ''}-${fileDiff.name}`}
                style={{ marginBottom: 16 }}
              >
                <FileDiff
                  fileDiff={fileDiff}
                  options={{
                    diffStyle: 'unified',
                  }}
                  style={{
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts.monospace,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && fileDiffs.length === 0 && diffText && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            No changes in this commit
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewCommitPanel;
