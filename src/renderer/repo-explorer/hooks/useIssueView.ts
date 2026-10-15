import { useEffect, useRef, useState } from 'react';
import type { IssueView } from '@industry-theme/file-city-panel';
import { issueViewFromGitHubIssue } from '@industry-theme/file-city-panel/github';
import type { components } from '@octokit/openapi-types';
import { repoExplorerService } from '@repo-explorer/data/repoExplorerService';

type GitHubIssue = components['schemas']['issue'];

interface Result {
  issue: IssueView | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches a GitHub issue and maps it to the `IssueView` shape consumed by
 * FileCityGuidePanel's issue mode, via the panel package's official
 * `issueViewFromGitHubIssue` adapter (typed against `@octokit/openapi-types`,
 * so the GitHub→normalized translation and its quirks live in one place).
 *
 * Mirrors `useCommitView`: returns `null` while idle (no number) or loading,
 * and holds the previously-loaded issue visible while the next one fetches so
 * switching issues doesn't fire the panel's exit animation.
 */
export function useIssueView(
  owner: string,
  repo: string,
  number: number | null,
): Result {
  const [state, setState] = useState<Result>({
    issue: null,
    loading: false,
    error: null,
  });
  const reqId = useRef(0);

  useEffect(() => {
    if (number == null) {
      setState({ issue: null, loading: false, error: null });
      return;
    }
    const id = ++reqId.current;
    // Keep the previously-loaded issue visible while the next one fetches —
    // blanking to null would read to the panel as a dismissal (issue slice →
    // null) and fire the issue-mode exit animation.
    setState((prev) => ({ issue: prev.issue, loading: true, error: null }));

    (async () => {
      try {
        const data = (await repoExplorerService.getIssue(
          owner,
          repo,
          number,
        )) as GitHubIssue | null;
        if (id !== reqId.current) return; // superseded
        if (!data) {
          setState({ issue: null, loading: false, error: null });
          return;
        }

        setState({
          issue: issueViewFromGitHubIssue(data),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (id !== reqId.current) return;
        setState({
          issue: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load issue',
        });
      }
    })();
  }, [owner, repo, number]);

  return state;
}
