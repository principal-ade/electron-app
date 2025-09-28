import type { AlexandriaEntry } from '@a24z/core-library';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';

export interface OrganizationInfo {
  name: string;
  type: 'local' | 'github' | 'remote';
  repositoryCount: number;
  avatarUrl?: string;
}

export interface GroupedRepositories {
  organizations: Map<string, OrganizationInfo>;
  repositoriesByOrg: Map<string, (AlexandriaEntry | EnhancedAlexandriaEntry)[]>;
}

/**
 * Extract organization name from a repository
 */
export function extractOrganization(repo: AlexandriaEntry | EnhancedAlexandriaEntry): string {
  // First try GitHub owner
  if (repo.github?.owner) {
    return repo.github.owner;
  }

  // Then try parsing remote URL
  if (repo.remoteUrl) {
    // Handle different Git URL formats
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    // https://gitlab.com/owner/repo.git
    const patterns = [
      /github\.com[/:]([\w-]+)\//,
      /gitlab\.com[/:]([\w-]+)\//,
      /bitbucket\.org[/:]([\w-]+)\//,
    ];

    for (const pattern of patterns) {
      const match = repo.remoteUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  // Default to "Local" for repositories without remote
  return 'Local';
}

/**
 * Determine organization type based on repository information
 */
export function getOrganizationType(repo: AlexandriaEntry | EnhancedAlexandriaEntry): OrganizationInfo['type'] {
  if (repo.github?.owner) {
    return 'github';
  }
  if (repo.remoteUrl) {
    return 'remote';
  }
  return 'local';
}

/**
 * Group repositories by organization
 */
export function groupRepositoriesByOrganization(
  repositories: (AlexandriaEntry | EnhancedAlexandriaEntry)[]
): GroupedRepositories {
  const organizations = new Map<string, OrganizationInfo>();
  const repositoriesByOrg = new Map<string, (AlexandriaEntry | EnhancedAlexandriaEntry)[]>();

  for (const repo of repositories) {
    const orgName = extractOrganization(repo);
    const orgType = getOrganizationType(repo);

    // Update organization info
    if (!organizations.has(orgName)) {
      organizations.set(orgName, {
        name: orgName,
        type: orgType,
        repositoryCount: 0,
      });
    }

    const orgInfo = organizations.get(orgName);
    if (orgInfo) {
      orgInfo.repositoryCount++;
    }

    // Group repositories
    if (!repositoriesByOrg.has(orgName)) {
      repositoriesByOrg.set(orgName, []);
    }
    const orgRepos = repositoriesByOrg.get(orgName);
    if (orgRepos) {
      orgRepos.push(repo);
    }
  }

  // Sort repositories within each organization alphabetically by name
  for (const [, repos] of repositoriesByOrg) {
    repos.sort((a, b) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }

  return { organizations, repositoriesByOrg };
}

/**
 * Get the last activity timestamp for a repository
 */
export function getRepositoryLastActivity(repo: AlexandriaEntry | EnhancedAlexandriaEntry): number {
  const enhanced = repo as EnhancedAlexandriaEntry;
  if (enhanced.mostRecentChange) {
    return new Date(enhanced.mostRecentChange).getTime();
  }
  if (repo.github?.lastCommit) {
    return new Date(repo.github.lastCommit).getTime();
  }
  if (repo.registeredAt) {
    return new Date(repo.registeredAt).getTime();
  }
  return 0;
}

/**
 * Sort organizations by type and name
 */
export function sortOrganizations(organizations: OrganizationInfo[]): OrganizationInfo[] {
  return organizations.sort((a, b) => {
    // First sort by type: github > remote > local
    const typeOrder = { github: 0, remote: 1, local: 2 };
    const typeDiff = typeOrder[a.type] - typeOrder[b.type];
    if (typeDiff !== 0) return typeDiff;

    // Then sort alphabetically, but keep "Local" at the end
    if (a.name === 'Local') return 1;
    if (b.name === 'Local') return -1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/**
 * Format relative time from a date string or Date
 */
export function getRelativeTime(date: string | Date | undefined): string {
  if (!date) return 'Never';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);

  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}