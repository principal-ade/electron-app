/**
 * Skill Update Service
 *
 * Provides comprehensive update checking and management for installed skills.
 * Coordinates between the lock file service and GitHub API to detect and apply updates.
 */

import { getSkillLockFileService } from './skillLockFile';
import { fetchSkillFolderHash, fetchMultipleSkillFolderHashes } from './githubTreeSha';
import type {
  SkillUpdateCheckResult,
  InstalledSkillInfo,
} from '../../shared/main-process-api-interfaces/SkillLockAPI';

// Cache for update check results (5 minute TTL)
const UPDATE_CACHE_TTL = 5 * 60 * 1000;
let updateCache: {
  results: SkillUpdateCheckResult[];
  timestamp: number;
} | null = null;

/**
 * Service for checking and applying skill updates
 */
export class SkillUpdateService {
  private lockService = getSkillLockFileService();

  /**
   * Check for updates on all installed skills
   * Uses caching to avoid excessive API calls
   */
  async checkAllUpdates(forceRefresh = false): Promise<SkillUpdateCheckResult[]> {
    // Check cache
    if (!forceRefresh && updateCache && Date.now() - updateCache.timestamp < UPDATE_CACHE_TTL) {
      console.log('[SkillUpdate] Returning cached update results');
      return updateCache.results;
    }

    console.log('[SkillUpdate] Checking for updates on all installed skills');

    const skills = await this.lockService.getAllSkills();
    const results: SkillUpdateCheckResult[] = [];

    // Group skills by source for efficient batch fetching
    const skillsBySource = new Map<string, InstalledSkillInfo[]>();

    for (const skill of skills) {
      if (skill.sourceType !== 'github') {
        // Non-GitHub skills can't be checked automatically
        results.push({
          name: skill.name,
          installedHash: skill.skillFolderHash,
          latestHash: skill.skillFolderHash,
          hasUpdate: false,
          sourceUrl: skill.sourceUrl,
          error: 'Update checking only supported for GitHub sources',
        });
        continue;
      }

      // Branch is not stored in lock file per add-skill convention, default to 'main'
      const key = `${skill.source}@main`;
      if (!skillsBySource.has(key)) {
        skillsBySource.set(key, []);
      }
      skillsBySource.get(key)!.push(skill);
    }

    // Fetch updates for each source
    for (const [key, sourceSkills] of skillsBySource) {
      const [source, branch] = key.split('@');
      const [owner, repo] = source.split('/');

      if (!owner || !repo) {
        for (const skill of sourceSkills) {
          results.push({
            name: skill.name,
            installedHash: skill.skillFolderHash,
            latestHash: skill.skillFolderHash,
            hasUpdate: false,
            sourceUrl: skill.sourceUrl,
            error: 'Invalid source format',
          });
        }
        continue;
      }

      const skillPaths = sourceSkills
        .map((s) => s.skillPath)
        .filter((p): p is string => !!p);

      try {
        const hashResults = await fetchMultipleSkillFolderHashes({
          owner,
          repo,
          branch: branch || 'main',
          skillPaths,
        });

        for (const skill of sourceSkills) {
          const hashResult = skill.skillPath ? hashResults.get(skill.skillPath) : undefined;

          if (!hashResult || !hashResult.success) {
            results.push({
              name: skill.name,
              installedHash: skill.skillFolderHash,
              latestHash: skill.skillFolderHash,
              hasUpdate: false,
              sourceUrl: skill.sourceUrl,
              error: hashResult?.error || 'Failed to fetch current hash',
            });
          } else {
            results.push({
              name: skill.name,
              installedHash: skill.skillFolderHash,
              latestHash: hashResult.sha!,
              hasUpdate: skill.skillFolderHash !== hashResult.sha,
              sourceUrl: skill.sourceUrl,
            });
          }
        }
      } catch (error) {
        // Handle fetch errors for the entire source
        for (const skill of sourceSkills) {
          results.push({
            name: skill.name,
            installedHash: skill.skillFolderHash,
            latestHash: skill.skillFolderHash,
            hasUpdate: false,
            sourceUrl: skill.sourceUrl,
            error: error instanceof Error ? error.message : 'Network error',
          });
        }
      }
    }

    // Update cache
    updateCache = {
      results,
      timestamp: Date.now(),
    };

    const updatesAvailable = results.filter((r) => r.hasUpdate).length;
    console.log(`[SkillUpdate] Check complete: ${updatesAvailable} updates available out of ${results.length} skills`);

    return results;
  }

  /**
   * Check if a specific skill has an update available
   */
  async checkSkillUpdate(name: string): Promise<SkillUpdateCheckResult | null> {
    const skill = await this.lockService.getSkill(name);
    if (!skill) {
      return null;
    }

    if (skill.sourceType !== 'github') {
      return {
        name,
        installedHash: skill.skillFolderHash,
        latestHash: skill.skillFolderHash,
        hasUpdate: false,
        sourceUrl: skill.sourceUrl,
        error: 'Update checking only supported for GitHub sources',
      };
    }

    const [owner, repo] = skill.source.split('/');
    if (!owner || !repo || !skill.skillPath) {
      return {
        name,
        installedHash: skill.skillFolderHash,
        latestHash: skill.skillFolderHash,
        hasUpdate: false,
        sourceUrl: skill.sourceUrl,
        error: 'Invalid skill source or path',
      };
    }

    const hashResult = await fetchSkillFolderHash({
      owner,
      repo,
      branch: 'main', // Branch not stored in lock file per add-skill convention
      skillPath: skill.skillPath,
    });

    if (!hashResult.success || !hashResult.sha) {
      return {
        name,
        installedHash: skill.skillFolderHash,
        latestHash: skill.skillFolderHash,
        hasUpdate: false,
        sourceUrl: skill.sourceUrl,
        error: hashResult.error || 'Failed to fetch current hash',
      };
    }

    return {
      name,
      installedHash: skill.skillFolderHash,
      latestHash: hashResult.sha,
      hasUpdate: skill.skillFolderHash !== hashResult.sha,
      sourceUrl: skill.sourceUrl,
    };
  }

  /**
   * Get count of skills with available updates
   */
  async getUpdateCount(): Promise<number> {
    const results = await this.checkAllUpdates();
    return results.filter((r) => r.hasUpdate).length;
  }

  /**
   * Get list of skills with available updates
   */
  async getSkillsWithUpdates(): Promise<SkillUpdateCheckResult[]> {
    const results = await this.checkAllUpdates();
    return results.filter((r) => r.hasUpdate);
  }

  /**
   * Clear the update cache
   * Call this after installing or updating skills
   */
  clearCache(): void {
    updateCache = null;
    console.log('[SkillUpdate] Cache cleared');
  }

  /**
   * Update the lock file entry after a successful skill update
   * Note: The actual file download should be done through the INSTALL_SKILL handler
   */
  async markSkillUpdated(name: string, newHash: string): Promise<boolean> {
    return this.lockService.updateSkill({
      name,
      updates: {
        skillFolderHash: newHash,
      },
    });
  }
}

// Singleton instance
let instance: SkillUpdateService | null = null;

/**
 * Get the singleton instance of SkillUpdateService
 */
export function getSkillUpdateService(): SkillUpdateService {
  if (!instance) {
    instance = new SkillUpdateService();
  }
  return instance;
}
