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
import { GithubService } from '../main-process-api/GithubService';
import type { ActivityCommit } from '../hooks/useActivityFeed';

export interface ReviewCommitPanelProps {
  repoPath: string;
  repoName: string;
  githubOwner?: string;
  githubRepoName?: string;
  commit: ActivityCommit;
}

export const ReviewCommitPanel: React.FC<ReviewCommitPanelProps> = ({
  repoPath,
  repoName,
  githubOwner,
  githubRepoName,
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
        const diff = repoPath
          ? await GitService.getCommitDiff(repoPath, commit.hash)
          : githubOwner && githubRepoName
            ? await GithubService.getCommitDiff(githubOwner, githubRepoName, commit.hash)
            : '';
        setDiffText(diff);
      } catch (err) {
        console.error('Failed to load commit diff:', err);
        setError(err instanceof Error ? err.message : 'Failed to load diff');
      } finally {
        setLoading(false);
      }
    };

    loadDiff();
  }, [repoPath, githubOwner, githubRepoName, commit.hash]);

  // Parse the patch into individual file diffs.
  // We split on `diff --git` ourselves and parse each file separately so a single
  // malformed file header (quoted paths, combined-merge diffs, etc.) doesn't make
  // the upstream parser drop every file in the patch.
  const fileDiffs = useMemo<FileDiffMetadata[]>(() => {
    if (!diffText) return [];
    const chunks = diffText.split(/(?=^diff --git )/m).filter(c => c.trim().length > 0);
    if (chunks.length === 0) {
      try {
        return parsePatchFiles(diffText).flatMap(p => p.files);
      } catch (err) {
        console.warn('Failed to parse patch:', err);
        return [];
      }
    }
    const out: FileDiffMetadata[] = [];
    for (const chunk of chunks) {
      try {
        const parsed = parsePatchFiles(chunk);
        out.push(...parsed.flatMap(p => p.files));
      } catch (err) {
        console.warn('Skipping unparseable file in diff:', err);
      }
    }
    return out;
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
