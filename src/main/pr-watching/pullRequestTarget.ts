/**
 * Parse the ways a user or agent might refer to a GitHub pull request:
 *
 * - https://github.com/owner/repo/pull/123 (optionally with /files, ?query, #fragment)
 * - owner/repo#123
 * - owner/repo/pull/123
 */

export interface PullRequestTarget {
  owner: string;
  repo: string;
  number: number;
  /** `owner/repo#number`, lowercased for stable identity. */
  id: string;
  url: string;
}

const OWNER = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
const REPO = '[A-Za-z0-9_.-]+?';
const NUMBER = '[1-9][0-9]{0,9}';

const PATTERNS = [
  new RegExp(
    `^(?:https?://)?(?:www\\.)?github\\.com/(${OWNER})/(${REPO})/pull/(${NUMBER})(?:/[^?#]*)?(?:[?#].*)?$`,
    'i',
  ),
  new RegExp(`^(${OWNER})/(${REPO})#(${NUMBER})$`),
  new RegExp(`^(${OWNER})/(${REPO})/pull/(${NUMBER})/?$`),
];

export function pullRequestId(
  owner: string,
  repo: string,
  number: number,
): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}#${number}`;
}

export function parsePullRequestTarget(
  value: unknown,
): PullRequestTarget | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const [, owner, rawRepo, rawNumber] = match;
    const repo = rawRepo.replace(/\.git$/i, '');
    if (!repo || repo === '.' || repo === '..') return undefined;
    const number = Number(rawNumber);
    if (!Number.isSafeInteger(number) || number <= 0) return undefined;
    return {
      owner,
      repo,
      number,
      id: pullRequestId(owner, repo, number),
      url: `https://github.com/${owner}/${repo}/pull/${number}`,
    };
  }
  return undefined;
}
