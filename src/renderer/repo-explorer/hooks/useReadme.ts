import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReadmeView } from '@industry-theme/file-city-panel';
import { repoExplorerService } from '../data/repoExplorerService';

interface Result {
  readme: ReadmeView | null;
  loading: boolean;
  error: string | null;
}

async function fetchReadmeContent(
  owner: string,
  repo: string,
  path: string,
  sha?: string | null,
): Promise<string> {
  const data = await repoExplorerService.readFile(
    owner,
    repo,
    path,
    sha ?? undefined,
  );
  return data.content;
}

function isMarkdown(path: string): boolean {
  return /\.mdx?$/i.test(path);
}

/**
 * Fetches a repo file's markdown and maps it to the `ReadmeView` shape consumed
 * by FileCityGuidePanel's native readme mode (markdown left + city + file-type
 * legend). Mirrors {@link useCommitView}: pass the README path to load it, or
 * `null` to idle. Reads HEAD via the same GitHub file API the source drawer
 * uses, base64-decoding the response.
 */
export function useReadme(
  owner: string,
  repo: string,
  path: string | null,
  sha?: string | null,
): Result {
  const [state, setState] = useState<Result>({
    readme: null,
    loading: false,
    error: null,
  });
  const reqId = useRef(0);

  const onNavigate = useCallback(
    async (href: string) => {
      const clean = href.startsWith('/') ? href.slice(1) : href;
      if (!isMarkdown(clean)) return null;
      try {
        const content = await fetchReadmeContent(owner, repo, clean, sha);
        return { path: clean, content };
      } catch {
        return null;
      }
    },
    [owner, repo, sha],
  );

  useEffect(() => {
    if (!path) {
      setState({ readme: null, loading: false, error: null });
      return;
    }
    const id = ++reqId.current;
    setState((prev) => ({ readme: prev.readme, loading: true, error: null }));

    (async () => {
      try {
        const content = await fetchReadmeContent(owner, repo, path, sha);
        if (id !== reqId.current) return;

        const basePath = path.includes('/')
          ? path.slice(0, path.lastIndexOf('/'))
          : '';
        setState({
          readme: {
            content,
            path,
            repositoryInfo: { owner, repo, branch: sha ?? 'HEAD', basePath },
            onNavigate,
          },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (id !== reqId.current) return;
        setState({
          readme: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load README',
        });
      }
    })();
  }, [owner, repo, path, sha, onNavigate]);

  return state;
}
