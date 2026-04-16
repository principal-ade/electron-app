import { useState, useEffect, useCallback } from 'react';
import { GithubService } from '../main-process-api/GithubService';
import type { GitHubOrganization, GitHubOrgMember } from '../../shared/main-process-api-interfaces/GitHubAPI';

export interface CoworkerWithOrg extends GitHubOrgMember {
  organizations: string[]; // List of org logins this member belongs to
}

export interface UseOrganizationsAndCoworkersResult {
  organizations: GitHubOrganization[];
  coworkers: CoworkerWithOrg[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch user's organizations and aggregate all members as coworkers
 */
export function useOrganizationsAndCoworkers(): UseOrganizationsAndCoworkersResult {
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([]);
  const [coworkers, setCoworkers] = useState<CoworkerWithOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch user's organizations
      const orgs = await GithubService.getUserOrganizations();
      setOrganizations(orgs);

      // Fetch members from all organizations
      const membersByOrg = await Promise.all(
        orgs.map(async (org) => {
          try {
            const members = await GithubService.getOrgMembers(org.login);
            return { org: org.login, members };
          } catch (err) {
            console.warn(`Failed to fetch members for org ${org.login}:`, err);
            return { org: org.login, members: [] };
          }
        })
      );

      // Aggregate and deduplicate members
      const membersMap = new Map<string, CoworkerWithOrg>();

      membersByOrg.forEach(({ org, members }) => {
        members.forEach((member) => {
          const existing = membersMap.get(member.login);
          if (existing) {
            // Add org to existing member's org list
            if (!existing.organizations.includes(org)) {
              existing.organizations.push(org);
            }
          } else {
            // Create new coworker entry
            membersMap.set(member.login, {
              ...member,
              organizations: [org],
            });
          }
        });
      });

      // Convert to array and sort by login
      const coworkersList = Array.from(membersMap.values()).sort((a, b) =>
        a.login.localeCompare(b.login)
      );

      setCoworkers(coworkersList);
    } catch (err) {
      console.error('Failed to fetch organizations and coworkers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    organizations,
    coworkers,
    loading,
    error,
    refresh: fetchData,
  };
}
