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
import { GitService } from '../../main-process-api/GitService';
import { useAuthUser } from '../../providers/AuthProvider';

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
  const { profile, isAuthenticated, isLoading: authLoading } = useAuthUser();
  const [user, setUser] = useState<UserAboutInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // The GitHub profile comes from the shared AuthProvider (fetched once per
  // session); we only fall back to the local git identity when signed out.
  // Kept above the Home panel (see file header) so a remount doesn't reset it
  // back to a loading state.
  useEffect(() => {
    // Wait for the shared auth/profile resolution so we don't briefly flash the
    // local git identity before the GitHub profile arrives.
    if (authLoading) return;
    if (isAuthenticated && !profile) return;

    let cancelled = false;

    (async () => {
      try {
        const next: UserAboutInfo | null = profile
          ? {
              source: 'github',
              login: profile.login,
              name: profile.name,
              email: profile.email,
              avatar_url: profile.avatar_url,
              html_url: `https://github.com/${profile.login}`,
              bio: profile.bio,
              company: profile.company,
              location: profile.location,
              followers: profile.followers,
              following: profile.following,
              public_repos: profile.public_repos,
              created_at: profile.created_at,
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
  }, [profile, isAuthenticated, authLoading]);

  return { user, loading };
}
