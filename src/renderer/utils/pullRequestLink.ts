import type { AcpLinkedPullRequest } from '../events/portalTabs';

/**
 * Parsing for pull requests a user attaches to an ACP tab. Accepted forms:
 * - `https://github.com/owner/repo/pull/123`
 * - `github.com/owner/repo/pull/123`
 * - `owner/repo/pull/123`
 * - `owner/repo#123`
 */
const URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/i;
const PATH_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)$/;
const SHORT_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)$/;

export function parsePullRequestTarget(
  raw: string,
): AcpLinkedPullRequest | null {
  const value = raw.trim();
  if (!value) return null;

  const match =
    URL_PATTERN.exec(value) ??
    PATH_PATTERN.exec(value) ??
    SHORT_PATTERN.exec(value);
  if (!match) return null;

  const [, owner, repo, numberText] = match;
  const number = Number(numberText);
  if (!Number.isSafeInteger(number) || number <= 0) return null;

  const canonicalOwner = owner.toLowerCase();
  const canonicalRepo = repo.toLowerCase();
  return {
    owner: canonicalOwner,
    repo: canonicalRepo,
    number,
    url: `https://github.com/${canonicalOwner}/${canonicalRepo}/pull/${number}`,
  };
}

/** Display identity for a linked pull request: `owner/repo#123`. */
export function pullRequestLabel(pullRequest: AcpLinkedPullRequest): string {
  return `${pullRequest.owner}/${pullRequest.repo}#${pullRequest.number}`;
}
