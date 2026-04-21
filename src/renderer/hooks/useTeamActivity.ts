import { useMemo } from 'react';
import type { ActivityCommit } from './useActivityFeed';
import type { CoworkerWithOrg } from './useOrganizationsAndCoworkers';

export interface TeamActivityResult {
  /** Set of GitHub usernames with recent activity */
  activeUsers: Set<string>;
  /** Set of organization logins with recent activity */
  activeOrganizations: Set<string>;
}

/**
 * Hook to determine which team members and organizations have recent activity
 * based on commit data
 */
export function useTeamActivity(
  commits: ActivityCommit[],
  coworkers: CoworkerWithOrg[]
): TeamActivityResult {
  return useMemo(() => {
    const activeUsers = new Set<string>();
    const activeOrganizations = new Set<string>();

    // Create a map of emails to GitHub usernames from coworkers
    // Note: This requires the GitHub API to provide email info, which may not always be available
    // For now, we'll try to match by comparing commit author emails with coworker data

    // For each commit, try to match the author to a coworker
    commits.forEach((commit) => {
      // Try to find a matching coworker by email or username
      const matchingCoworker = coworkers.find((coworker) => {
        // Match by username (if author name matches GitHub login)
        if (commit.author.toLowerCase() === coworker.login.toLowerCase()) {
          return true;
        }

        // Match by email if available
        // GitHub emails often follow the pattern: username@users.noreply.github.com
        if (commit.authorEmail.includes('@users.noreply.github.com')) {
          const emailUsername = commit.authorEmail.split('@')[0];
          if (emailUsername.toLowerCase() === coworker.login.toLowerCase()) {
            return true;
          }
        }

        return false;
      });

      if (matchingCoworker) {
        // Mark this user as active
        activeUsers.add(matchingCoworker.login);

        // Mark all their organizations as active
        matchingCoworker.organizations.forEach((org) => {
          activeOrganizations.add(org);
        });
      }
    });

    return {
      activeUsers,
      activeOrganizations,
    };
  }, [commits, coworkers]);
}
