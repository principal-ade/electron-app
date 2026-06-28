/**
 * Host-general parsing of a git remote URL into `{ owner, repo, host }`.
 *
 * Unlike `githubUrlParser.parseGitHubUrl` (which is github.com-only and exists
 * for the "clone from GitHub" flow), this util extracts owner/repo from a
 * remote on ANY host — github.com, gitlab.com, bitbucket.org, self-hosted, or
 * an `ssh://`/`scp`-style remote. It is the single source of truth for the
 * owner/repo extraction that was previously copy-pasted across the repo
 * scanner, the event server, and the clone modal.
 *
 * Pure string utility — no Node `path` dependency — so it is import-safe from
 * both the main process and the renderer.
 */

export interface ParsedGitRemote {
  owner: string;
  repo: string;
  /**
   * Hostname when it can be determined from the URL (e.g. `github.com`,
   * `gitlab.com`, a self-hosted host). Empty string for the `gh:owner/repo`
   * shorthand, which carries no host.
   */
  host: string;
}

/** GitHub CLI shorthand: `gh:owner/repo`. */
const GH_SHORTHAND = /^gh:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/;

/**
 * URL with an explicit scheme: `https://`, `http://`, `git://`, `ssh://`.
 * Tolerates an embedded `user@` and a `:port`. Captures host, owner, and the
 * remaining path as repo (a `.git` suffix and a trailing slash are dropped).
 */
const SCHEME_URL =
  /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/([^/]+)\/(.+?)(?:\.git)?\/?$/i;

/** scp-style SSH remote: `[user@]host:owner/repo(.git)?`. */
const SCP_LIKE = /^(?:[^@/]+@)?([^/:]+):([^/]+)\/(.+?)(?:\.git)?\/?$/;

/**
 * Parse a git remote URL into its owner, repo, and host. Returns `null` when
 * the input is empty or doesn't look like a remote URL — callers that want a
 * sentinel (e.g. `''` or `{}`) apply it themselves.
 *
 * Recognized forms (host-general):
 * - `https://host/owner/repo(.git)?`, `http://`, `git://`, `ssh://git@host/owner/repo`
 * - `[user@]host:owner/repo(.git)?` (scp-style SSH)
 * - `gh:owner/repo` (GitHub CLI shorthand; host reported as `github.com`)
 *
 * Bare `owner/repo` shorthand is intentionally NOT matched — it's ambiguous
 * with arbitrary paths. Callers that need that fallback handle it locally.
 */
export function parseGitRemoteUrl(
  input: string | null | undefined,
): ParsedGitRemote | null {
  if (!input) return null;
  const url = input.trim();
  if (!url) return null;

  const gh = url.match(GH_SHORTHAND);
  if (gh) return { owner: gh[1], repo: gh[2], host: 'github.com' };

  const scheme = url.match(SCHEME_URL);
  if (scheme) return { owner: scheme[2], repo: scheme[3], host: scheme[1] };

  // scp-style has no scheme; the guard keeps it from grabbing a scheme URL
  // whose `://` was somehow not matched above.
  if (!url.includes('://')) {
    const scp = url.match(SCP_LIKE);
    if (scp) return { owner: scp[2], repo: scp[3], host: scp[1] };
  }

  return null;
}
