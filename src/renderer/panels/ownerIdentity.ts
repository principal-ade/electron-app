/**
 * ownerIdentity
 *
 * Resolves the human-facing label + avatar for an owner group header — the way
 * the Home rail and the Projects list group repositories. The grouping key
 * stays the GitHub login (`owner/name` keys, org ordering, `you`/`member`
 * badges all compare logins); only the label the header renders changes:
 *
 *   - the signed-in user's own account → their GitHub display name
 *   - an org the user belongs to       → the org's display name (enriched from
 *     `GET /orgs/{login}` in the main process and cached by githubProjectsStore)
 *   - anything else (third-party user owners, "Untracked") → the login
 *
 * Third-party *user* owners have no display name in the repo payload
 * (`GitHubRepository.owner` only carries login/avatar_url/type), so they stay on
 * their login until we resolve profiles for them.
 */

import type { GitHubOrganization } from '../../shared/main-process-api-interfaces/GitHubAPI';

/** Everything needed to turn an owner login into a display label. */
export interface OwnerDirectory {
  /** Signed-in user's login, when authenticated. */
  selfLogin: string | null;
  /** Signed-in user's GitHub display name (`GitHubUser.name`), when known. */
  selfName?: string | null;
  /** Signed-in user's avatar, when known. */
  selfAvatarUrl?: string;
  /** Orgs the signed-in user belongs to (with display names), from the graph store. */
  orgs: GitHubOrganization[];
}

export interface OwnerIdentity {
  /** The label to render in the section header. */
  label: string;
  /** Owner avatar when known; undefined lets the header card fall back to `https://github.com/{login}.png`. */
  avatarUrl?: string;
  /** True when this group is the signed-in user's own account. */
  isSelf: boolean;
  /** True when this group is one of the signed-in user's orgs. */
  isMemberOrg: boolean;
  /** Set when `label` is a display name, so the header can surface the login on hover. */
  login?: string;
}

/**
 * Resolve an owner login (the grouping key) into the label + avatar to show for
 * its section. Never throws and never fetches — the display names come from data
 * already in the session (auth profile + cached orgs).
 */
export function resolveOwnerIdentity(
  login: string,
  directory: OwnerDirectory,
): OwnerIdentity {
  const isSelf =
    directory.selfLogin !== null &&
    login.toLowerCase() === directory.selfLogin.toLowerCase();

  if (isSelf) {
    const name = directory.selfName?.trim();
    return {
      label: name || login,
      avatarUrl: directory.selfAvatarUrl,
      isSelf: true,
      isMemberOrg: false,
      login: name ? login : undefined,
    };
  }

  const org = directory.orgs.find(
    (o) => o.login.toLowerCase() === login.toLowerCase(),
  );
  if (!org) {
    return { label: login, isSelf: false, isMemberOrg: false };
  }

  const name = org.name?.trim();
  return {
    label: name || login,
    avatarUrl: org.avatar_url,
    isSelf: false,
    isMemberOrg: true,
    login: name ? login : undefined,
  };
}
