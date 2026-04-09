/**
 * Convert SharedGitStatus to File City highlight layers
 *
 * Creates visual highlight layers for modified, staged, untracked, and deleted files
 * that can be displayed on the ArchitectureMapHighlightLayers component.
 */

import type { HighlightLayer } from '@principal-ai/file-city-react';
import type { SharedGitStatus } from '@principal-ai/control-tower-core';

/** Colors for different git status types */
export const GIT_STATUS_COLORS = {
  modified: '#f59e0b', // Amber - files with changes
  staged: '#22c55e', // Green - ready to commit
  untracked: '#3b82f6', // Blue - new files
  deleted: '#ef4444', // Red - removed files
} as const;

/** Layer configuration */
const LAYER_CONFIG = {
  opacity: 1.0, // Full opacity for git status to make changes stand out
  basePriority: 30,
} as const;

/**
 * Convert a SharedGitStatus object to an array of HighlightLayers
 *
 * @param gitStatus - The git status from presence data
 * @param layerIdPrefix - Optional prefix for layer IDs (e.g., "user-123")
 * @returns Array of highlight layers for the File City visualization
 */
export function gitStatusToHighlightLayers(
  gitStatus: SharedGitStatus,
  layerIdPrefix = 'git-status',
): HighlightLayer[] {
  const layers: HighlightLayer[] = [];

  // Staged files - highest priority (ready to commit)
  if (gitStatus.stagedFiles && gitStatus.stagedFiles.length > 0) {
    layers.push({
      id: `${layerIdPrefix}-staged`,
      name: `Staged (${gitStatus.stagedFiles.length})`,
      enabled: true,
      color: GIT_STATUS_COLORS.staged,
      opacity: LAYER_CONFIG.opacity,
      priority: LAYER_CONFIG.basePriority + 3,
      items: gitStatus.stagedFiles.map((path) => ({
        path,
        type: 'file' as const,
        renderStrategy: 'fill' as const,
      })),
    });
  }

  // Modified files - working tree changes
  if (gitStatus.modifiedFiles && gitStatus.modifiedFiles.length > 0) {
    layers.push({
      id: `${layerIdPrefix}-modified`,
      name: `Modified (${gitStatus.modifiedFiles.length})`,
      enabled: true,
      color: GIT_STATUS_COLORS.modified,
      opacity: LAYER_CONFIG.opacity,
      priority: LAYER_CONFIG.basePriority + 2,
      items: gitStatus.modifiedFiles.map((path) => ({
        path,
        type: 'file' as const,
        renderStrategy: 'fill' as const,
      })),
    });
  }

  // Untracked files - new files not yet added
  if (gitStatus.untrackedFiles && gitStatus.untrackedFiles.length > 0) {
    layers.push({
      id: `${layerIdPrefix}-untracked`,
      name: `Untracked (${gitStatus.untrackedFiles.length})`,
      enabled: true,
      color: GIT_STATUS_COLORS.untracked,
      opacity: LAYER_CONFIG.opacity,
      priority: LAYER_CONFIG.basePriority + 1,
      items: gitStatus.untrackedFiles.map((path) => ({
        path,
        type: 'file' as const,
        renderStrategy: 'border' as const,
      })),
    });
  }

  // Deleted files - show with glow effect
  if (gitStatus.deletedFiles && gitStatus.deletedFiles.length > 0) {
    layers.push({
      id: `${layerIdPrefix}-deleted`,
      name: `Deleted (${gitStatus.deletedFiles.length})`,
      enabled: true,
      color: GIT_STATUS_COLORS.deleted,
      opacity: LAYER_CONFIG.opacity,
      priority: LAYER_CONFIG.basePriority,
      items: gitStatus.deletedFiles.map((path) => ({
        path,
        type: 'file' as const,
        renderStrategy: 'glow' as const,
      })),
    });
  }

  return layers;
}

/**
 * Merge multiple users' git status into combined highlight layers
 *
 * When multiple users have changes to the same repo, this merges their
 * file lists and creates aggregate layers.
 *
 * @param gitStatusByUser - Map of userId to their SharedGitStatus
 * @returns Combined highlight layers showing all users' changes
 */
export function mergeGitStatusHighlightLayers(
  gitStatusByUser: Map<string, SharedGitStatus>,
): HighlightLayer[] {
  // Aggregate all files by status type
  const aggregated = {
    staged: new Set<string>(),
    modified: new Set<string>(),
    untracked: new Set<string>(),
    deleted: new Set<string>(),
  };

  for (const [, status] of gitStatusByUser.entries()) {
    status.stagedFiles?.forEach((f) => aggregated.staged.add(f));
    status.modifiedFiles?.forEach((f) => aggregated.modified.add(f));
    status.untrackedFiles?.forEach((f) => aggregated.untracked.add(f));
    status.deletedFiles?.forEach((f) => aggregated.deleted.add(f));
  }

  // Create a synthetic SharedGitStatus from aggregated data
  const merged: SharedGitStatus = {
    branch: '',
    isDirty: aggregated.modified.size > 0 || aggregated.staged.size > 0,
    hasUntracked: aggregated.untracked.size > 0,
    hasStaged: aggregated.staged.size > 0,
    ahead: 0,
    behind: 0,
    stagedFiles: Array.from(aggregated.staged),
    modifiedFiles: Array.from(aggregated.modified),
    untrackedFiles: Array.from(aggregated.untracked),
    deletedFiles: Array.from(aggregated.deleted),
  };

  return gitStatusToHighlightLayers(merged, 'git-status-merged');
}
