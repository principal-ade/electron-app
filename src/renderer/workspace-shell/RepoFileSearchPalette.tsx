/**
 * RepoFileSearchPalette
 *
 * A Cmd+Shift+F overlay for the workspace terminal: type to fuzzy-search every
 * file in the git repository the active terminal is sitting in, then open the
 * highlighted file in a viewer tab.
 *
 * Data comes from the same file-tree infrastructure the rest of the app uses —
 * `RepositoryMonitoringService.getFileTree(repoPath)` — whose `allFiles[].path`
 * is repo-relative, so selecting a file joins it back onto the repo root.
 *
 * Rendered through a portal so it floats above the panel layout regardless of
 * where the shell mounts it.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import type { FileInfo } from '@principal-ai/repository-abstraction';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

export interface RepoFileSearchPaletteProps {
  /** Absolute path to the git repository root to search. */
  repoPath: string;
  /** Display label for the repo (usually the root directory's basename). */
  repoLabel: string;
  /** Close the palette without choosing a file. */
  onClose: () => void;
  /** Open the chosen file (absolute path). */
  onSelectFile: (absolutePath: string, file: FileInfo) => void;
}

/** Join a repo root and a repo-relative path into an absolute path. */
function joinRepoPath(root: string, relative: string): string {
  if (!relative) return root;
  const base = root.endsWith('/') ? root.slice(0, -1) : root;
  const rel = relative.startsWith('/') ? relative.slice(1) : relative;
  return `${base}/${rel}`;
}

interface FuzzyMatch {
  indices: number[];
  score: number;
}

/**
 * Subsequence match with light weighting: consecutive runs, matches at path
 * segment boundaries, and matches in the basename all score higher, and long
 * paths are penalized. Returns `null` when the query isn't a subsequence.
 */
function fuzzyMatch(text: string, query: string): FuzzyMatch | null {
  if (!query) return { indices: [], score: 0 };
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let cursor = 0;
  let lastMatch = -1;

  for (let qi = 0; qi < lowerQuery.length; qi++) {
    const qc = lowerQuery[qi];
    let found = -1;
    while (cursor < lowerText.length) {
      if (lowerText[cursor] === qc) {
        found = cursor;
        break;
      }
      cursor++;
    }
    if (found === -1) return null;

    if (found === lastMatch + 1) score += 8;
    const prev = found > 0 ? lowerText[found - 1] : '/';
    if (prev === '/' || prev === '-' || prev === '_' || prev === '.')
      score += 6;
    if (lastMatch >= 0) score -= Math.min(found - lastMatch - 1, 6);

    indices.push(found);
    lastMatch = found;
    cursor = found + 1;
  }

  // Prefer basename matches and shorter paths.
  const slash = lowerText.lastIndexOf('/');
  if ((indices[0] ?? 0) > slash) score += 12;
  score -= Math.min(text.length / 10, 20);
  return { indices, score };
}

/** Render `text` with the fuzzy-matched character positions emphasized. */
function renderHighlighted(
  text: string,
  indices: number[],
  highlightColor: string,
): React.ReactNode {
  if (indices.length === 0) return text;
  const set = new Set(indices);
  const nodes: React.ReactNode[] = [];
  let runStart = 0;
  let runMatched = set.has(0);
  for (let i = 1; i <= text.length; i++) {
    const matched = i < text.length ? set.has(i) : !runMatched;
    if (i === text.length || matched !== runMatched) {
      const chunk = text.slice(runStart, i);
      nodes.push(
        runMatched ? (
          <span
            key={runStart}
            style={{ color: highlightColor, fontWeight: 600 }}
          >
            {chunk}
          </span>
        ) : (
          chunk
        ),
      );
      runStart = i;
      runMatched = matched;
    }
  }
  return <>{nodes}</>;
}

const MAX_RESULTS = 100;

export const RepoFileSearchPalette: React.FC<RepoFileSearchPaletteProps> = ({
  repoPath,
  repoLabel,
  onClose,
  onSelectFile,
}) => {
  const { theme } = useTheme();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Load (and cache-hit) the repo's file tree once per repo.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    RepositoryMonitoringService.getFileTree(repoPath)
      .then((tree) => {
        if (!active) return;
        if (!tree) {
          setError('Could not read the file tree for this repository.');
          setFiles([]);
        } else {
          setFiles(tree.allFiles);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[RepoFileSearchPalette] getFileTree failed:', err);
        setError('Could not read the file tree for this repository.');
        setFiles([]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repoPath]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Score + filter. Empty query shows the first N files in path order.
  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return files
        .slice()
        .sort((a, b) => a.path.localeCompare(b.path))
        .slice(0, MAX_RESULTS)
        .map((file) => ({ file, indices: [] as number[] }));
    }
    return files
      .map((file) => {
        const match = fuzzyMatch(file.path, trimmed);
        return match ? { file, ...match } : null;
      })
      .filter(
        (r): r is { file: FileInfo; indices: number[]; score: number } =>
          r !== null,
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.file.path.length - b.file.path.length ||
          a.file.path.localeCompare(b.file.path),
      )
      .slice(0, MAX_RESULTS)
      .map((r) => ({ file: r.file, indices: r.indices }));
  }, [files, query]);

  // Keep the selection valid + scrolled into view as results change.
  useEffect(() => {
    setSelectedIndex((prev) =>
      results.length === 0 ? 0 : Math.min(prev, results.length - 1),
    );
  }, [results]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const choose = (index: number) => {
    const hit = results[index];
    if (!hit) return;
    onSelectFile(joinRepoPath(repoPath, hit.file.path), hit.file);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length === 0 ? 0 : (prev + 1) % results.length,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length === 0 ? 0 : (prev - 1 + results.length) % results.length,
      );
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length === 0 ? 0 : Math.min(prev + 10, results.length - 1),
      );
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 10, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(selectedIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  // Escape anywhere (e.g. focus escaped the input) should still dismiss.
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onWindowKeyDown, true);
    return () => window.removeEventListener('keydown', onWindowKeyDown, true);
  }, [onClose]);

  const content = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '15vh',
        background: 'rgba(0, 0, 0, 0.35)',
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '680px',
          maxWidth: '90vw',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 6,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          fontFamily: theme.fonts.body,
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 160,
            }}
            title={repoPath}
          >
            {repoLabel}
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files by name or path…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: theme.colors.backgroundSecondary || '#1e1e1e',
              border: `1px solid ${theme.colors.border || '#3e3e3e'}`,
              borderRadius: 4,
              color: theme.colors.text || '#ffffff',
              fontSize: theme.fontSizes[3],
              fontFamily: theme.fonts.body,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 60 }}>
          {loading ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
              }}
            >
              Loading files…
            </div>
          ) : error ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
              }}
            >
              {error}
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
              }}
            >
              {files.length === 0 ? 'No files found.' : 'No matching files.'}
            </div>
          ) : (
            results.map((hit, index) => {
              const isSelected = index === selectedIndex;
              const lastSlash = hit.file.path.lastIndexOf('/');
              const dir =
                lastSlash >= 0 ? hit.file.path.slice(0, lastSlash) : '';
              const nameStart = lastSlash + 1;
              const nameIndices = hit.indices
                .filter((i) => i >= nameStart)
                .map((i) => i - nameStart);
              return (
                <div
                  key={hit.file.path}
                  ref={isSelected ? selectedRef : null}
                  onClick={() => choose(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    padding: '6px 14px',
                    cursor: 'pointer',
                    background: isSelected
                      ? theme.colors.backgroundSecondary
                      : 'transparent',
                    borderLeft: isSelected
                      ? `2px solid ${theme.colors.primary}`
                      : '2px solid transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.fontSizes[3],
                      color: theme.colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={hit.file.path}
                  >
                    {renderHighlighted(
                      hit.file.name || hit.file.path,
                      nameIndices,
                      theme.colors.primary,
                    )}
                  </span>
                  {dir && (
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        direction: 'rtl',
                        textAlign: 'left',
                      }}
                      title={dir}
                    >
                      {dir}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            padding: '6px 14px',
            background: theme.colors.backgroundSecondary,
            borderTop: `1px solid ${theme.colors.border}`,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
          {files.length > 0 && (
            <span style={{ marginLeft: 'auto' }}>
              {results.length}
              {files.length > results.length ? ` of ${files.length}` : ''} files
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default RepoFileSearchPalette;
