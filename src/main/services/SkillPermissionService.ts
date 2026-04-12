/**
 * Skill Permission Service
 *
 * Checks and caches GitHub repository permissions for installed skills.
 * Determines if a user can edit a skill based on their push access to the source repository.
 */

import { getSkillLockFileService } from '../skills/skillLockFile';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';

interface PermissionCacheEntry {
  push: boolean;
  timestamp: number;
}

export interface SkillEditPermissionResult {
  canEdit: boolean;
  reason?: string;
}

/**
 * Service for checking skill edit permissions
 */
export class SkillPermissionService {
  private permissionCache: Map<string, PermissionCacheEntry> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private adapter: GitHubAdapter;

  constructor(adapter: GitHubAdapter) {
    this.adapter = adapter;
  }

  /**
   * Check if user can edit a skill based on push permission to source repo
   */
  async checkSkillEditPermission(skillName: string): Promise<SkillEditPermissionResult> {
    try {
      const lockService = getSkillLockFileService();
      const skill = await lockService.getSkill(skillName);

      if (!skill) {
        return {
          canEdit: false,
          reason: 'Skill not found in lock file',
        };
      }

      if (skill.sourceType !== 'github') {
        return {
          canEdit: false,
          reason: 'Only GitHub skills can be edited',
        };
      }

      // Parse source to get owner/repo
      const [owner, repo] = skill.source.split('/');
      if (!owner || !repo) {
        return {
          canEdit: false,
          reason: 'Invalid skill source format',
        };
      }

      // Get repository permissions
      const permissions = await this.getRepoPermissions(owner, repo);

      if (!permissions) {
        return {
          canEdit: false,
          reason: 'Could not fetch repository permissions',
        };
      }

      if (!permissions.push) {
        return {
          canEdit: false,
          reason: 'You do not have push access to this repository',
        };
      }

      return {
        canEdit: true,
      };
    } catch (error) {
      console.error('[SkillPermissionService] Error checking edit permission:', error);
      return {
        canEdit: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get repository permissions (cached)
   */
  async getRepoPermissions(
    owner: string,
    repo: string,
  ): Promise<{ admin: boolean; push: boolean; pull: boolean } | null> {
    const cacheKey = `${owner}/${repo}`;

    // Check cache
    const cached = this.permissionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[SkillPermissionService] Using cached permissions for ${cacheKey}`);
      return {
        admin: false, // We only cache push permission
        push: cached.push,
        pull: true,
      };
    }

    // Fetch from GitHub API
    try {
      const repoInfo = await this.adapter.getRepository(owner, repo);

      if (!repoInfo || !repoInfo.permissions) {
        console.warn(`[SkillPermissionService] No permissions found for ${cacheKey}`);
        return null;
      }

      // Cache the result
      this.permissionCache.set(cacheKey, {
        push: repoInfo.permissions.push,
        timestamp: Date.now(),
      });

      console.log(`[SkillPermissionService] Fetched permissions for ${cacheKey}:`, repoInfo.permissions);

      return {
        admin: repoInfo.permissions.admin || false,
        push: repoInfo.permissions.push,
        pull: repoInfo.permissions.pull,
      };
    } catch (error) {
      console.error(`[SkillPermissionService] Error fetching permissions for ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Clear the permission cache
   * Call this after permission changes or on errors
   */
  clearCache(): void {
    this.permissionCache.clear();
    console.log('[SkillPermissionService] Permission cache cleared');
  }

  /**
   * Clear cache for a specific repository
   */
  clearCacheForRepo(owner: string, repo: string): void {
    const cacheKey = `${owner}/${repo}`;
    this.permissionCache.delete(cacheKey);
    console.log(`[SkillPermissionService] Cleared cache for ${cacheKey}`);
  }
}

// Singleton instance
let instance: SkillPermissionService | null = null;

/**
 * Get the singleton instance of SkillPermissionService
 */
export function getSkillPermissionService(adapter?: GitHubAdapter): SkillPermissionService {
  if (!instance && adapter) {
    instance = new SkillPermissionService(adapter);
  }
  if (!instance) {
    throw new Error('SkillPermissionService not initialized. Call with adapter first.');
  }
  return instance;
}

/**
 * Initialize the service with a GitHub adapter
 */
export function initializeSkillPermissionService(adapter: GitHubAdapter): SkillPermissionService {
  instance = new SkillPermissionService(adapter);
  console.log('[SkillPermissionService] Initialized');
  return instance;
}
