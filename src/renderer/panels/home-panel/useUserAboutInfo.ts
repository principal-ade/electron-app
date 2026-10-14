/**
 * useUserAboutInfo
 *
 * Resolves the Home profile card's data: the GitHub profile when a token /
 * `gh` CLI session is available, otherwise the local git identity
 * (`user.name` / `user.email`), otherwise null.
 *
 * Call this once from a component that stays mounted (WorkspaceShell) and pass
 * the result down. The workspace shell swaps its left panel by `activeView`, so
 * the Home panel remounts on every return — keeping this state above it means
 * the last profile shows immediately instead of flashing the loading skeleton.
 */

import { useEffect, useState } from 'react';
import { GithubService } from '../../main-process-api/GithubService';
import { GitService } from '../../main-process-api/GitService';
import { useAuthState } from '../../hooks/useAuthState';

export type UserAboutSource = 'github' | 'git';

export interface UserAboutInfo {
  /** github = remote profile; git = global git config identity */
  source?: UserAboutSource;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string;
  html_url?: string;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  followers?: number | null;
  following?: number | null;
  public_repos?: number | null;
  created_at?: string | null;
}

export interface UserAboutInfoResult {
  user: UserAboutInfo | null;
  loading: boolean;
}

async function loadGitIdentity(): Promise<UserAboutInfo | null> {
  const dir = process.env.HOME || '/';
  try {
    const [nameResult, emailResult] = await Promise.all([
      GitService.execCommand(dir, ['config', '--global', 'user.name']).catch(
        () => ({ stdout: '' }),
      ),
      GitService.execCommand(dir, ['config', '--global', 'user.email']).catch(
        () => ({ stdout: '' }),
      ),
    ]);
    const name = nameResult.stdout.trim() || null;
    const email = emailResult.stdout.trim() || null;
    if (!name && !email) return null;
    return {
      source: 'git',
      // login is required by the type; use email or name as a stable handle
      login: email || name || 'git',
      name,
      email,
    };
  } catch {
    return null;
  }
}

export function useUserAboutInfo(): UserAboutInfoResult {
  const { user: authUser } = useAuthState();
  const [user, setUser] = useState<UserAboutInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-runs on sign-in / sign-out. Kept above the Home panel (see file header)
  // so a remount doesn't reset it back to a loading state.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const u = await GithubService.getCurrentUser();
        if (cancelled) return;
        const next: UserAboutInfo | null = u
          ? {
              source: 'github',
              login: u.login,
              name: u.name,
              email: u.email,
              avatar_url: u.avatar_url,
              html_url: `https://github.com/${u.login}`,
              bio: u.bio,
              company: u.company,
              location: u.location,
              followers: u.followers,
              following: u.following,
              public_repos: u.public_repos,
              created_at: u.created_at,
            }
          : await loadGitIdentity();
        if (cancelled) return;
        setUser(next);
      } catch {
        if (cancelled) return;
        setUser(await loadGitIdentity());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.login]);

  return { user, loading };
}
