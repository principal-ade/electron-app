import type { Repository } from '../../shared/types/repository.types';
import type { GitStatus } from '../../shared/main-process-api-interfaces/GitWatcherAPI';

export type TagType = 'auto' | 'manual';

export interface Tag {
  name: string;
  type: TagType;
  color?: string;
}

// Auto-generated tag definitions
export const AUTO_TAGS = {
  LOCAL: '#local',
  REMOTE: '#remote',
  ACTIVE: '#active',
  STALE: '#stale',
  DIRTY: '#dirty',
  CLEAN: '#clean',
  FORK: '#fork',
  FORK_PARENT: '#fork-parent',
  ARCHIVED: '#archived',
  PRIVATE: '#private',
  PUBLIC: '#public',
} as const;

// Tag colors for different tag types
export const TAG_COLORS: Record<string, string> = {
  [AUTO_TAGS.LOCAL]: '#10b981',     // green
  [AUTO_TAGS.REMOTE]: '#6366f1',    // indigo
  [AUTO_TAGS.ACTIVE]: '#f59e0b',    // amber
  [AUTO_TAGS.STALE]: '#6b7280',     // gray
  [AUTO_TAGS.DIRTY]: '#ef4444',     // red
  [AUTO_TAGS.CLEAN]: '#10b981',     // green
  [AUTO_TAGS.FORK]: '#8b5cf6',      // violet
  [AUTO_TAGS.FORK_PARENT]: '#a855f7', // purple
  [AUTO_TAGS.ARCHIVED]: '#6b7280',  // gray
  [AUTO_TAGS.PRIVATE]: '#f97316',   // orange
  [AUTO_TAGS.PUBLIC]: '#3b82f6',    // blue
  // Manual tags get default color
  default: '#64748b',                // slate
};

/**
 * Generate automatic tags for a repository based on its state
 */
export function generateAutoTags(
  repo: Repository,
  gitStatuses?: Record<string, GitStatus>
): string[] {
  const tags: string[] = [];

  // Local vs Remote
  if (repo.localClones && repo.localClones.length > 0) {
    tags.push(AUTO_TAGS.LOCAL);
    
    // Check git status for each clone
    let hasAnyDirty = false;
    let allClean = true;
    
    repo.localClones.forEach(clone => {
      const status = gitStatuses?.[clone.path];
      if (status && status.isDirty) {
        hasAnyDirty = true;
        allClean = false;
      } else if (!status) {
        allClean = false;
      }
    });
    
    if (hasAnyDirty) {
      tags.push(AUTO_TAGS.DIRTY);
    } else if (allClean) {
      tags.push(AUTO_TAGS.CLEAN);
    }
  } else {
    tags.push(AUTO_TAGS.REMOTE);
  }

  // Activity status (based on last accessed)
  if (repo.lastAccessed) {
    const daysSinceAccess = (Date.now() - repo.lastAccessed) / (1000 * 60 * 60 * 24);
    if (daysSinceAccess <= 7) {
      tags.push(AUTO_TAGS.ACTIVE);
    } else if (daysSinceAccess > 30) {
      tags.push(AUTO_TAGS.STALE);
    }
  }

  // Fork status
  if (repo.isFork) {
    tags.push(AUTO_TAGS.FORK);
  }
  
  // Check if this repo is a parent of any fork
  // This would need to be checked against all repos in the list
  // Will be handled in the ReposView component

  // Archived status
  if (repo.isArchived) {
    tags.push(AUTO_TAGS.ARCHIVED);
  }

  // Private/Public
  if (repo.isPrivate) {
    tags.push(AUTO_TAGS.PRIVATE);
  } else {
    tags.push(AUTO_TAGS.PUBLIC);
  }

  return tags;
}

/**
 * Get color for a tag
 */
export function getTagColor(tagName: string): string {
  return TAG_COLORS[tagName] || TAG_COLORS.default;
}

/**
 * Parse tag string to determine if it's an exclusion
 */
export function parseTagFilter(tagFilter: string): {
  tag: string;
  exclude: boolean;
} {
  if (tagFilter.startsWith('!')) {
    return { tag: tagFilter.slice(1), exclude: true };
  }
  return { tag: tagFilter, exclude: false };
}

/**
 * Filter repositories by tags
 */
export function filterReposByTags(
  repos: Repository[],
  includeTags: string[],
  excludeTags: string[]
): Repository[] {
  if (includeTags.length === 0 && excludeTags.length === 0) {
    return repos.filter(repo => repo != null);
  }

  return repos.filter(repo => {
    if (!repo || !repo.tags) return false;
    
    const repoTags = repo.tags;
    
    // Must have ALL included tags
    if (includeTags.length > 0) {
      const hasAllIncluded = includeTags.every(tag => 
        repoTags.includes(tag)
      );
      if (!hasAllIncluded) return false;
    }
    
    // Must have NONE of excluded tags
    if (excludeTags.length > 0) {
      const hasAnyExcluded = excludeTags.some(tag => 
        repoTags.includes(tag)
      );
      if (hasAnyExcluded) return false;
    }
    
    return true;
  });
}

/**
 * Get count of repos for a specific tag
 */
export function getRepoCountForTag(
  repos: Repository[],
  tag: string
): number {
  return repos.filter(repo => repo && repo.tags && repo.tags.includes(tag)).length;
}

/**
 * Get all unique tags from repositories
 */
export function getAllUniqueTags(repos: Repository[]): string[] {
  const tagSet = new Set<string>();
  repos.forEach(repo => {
    if (repo && repo.tags) {
      repo.tags.forEach(tag => tagSet.add(tag));
    }
  });
  return Array.from(tagSet).sort();
}