import { FileTree } from '@principal-ai/repository-abstraction';

/**
 * File Tree Source Model
 *
 * Simplified source model for managing multiple file trees from different sources.
 * Focuses on the primary use cases: local clones and remote branches (mainly GitHub).
 */

// Source types - what we actually use
export type SourceType = 'local' | 'remote';

// Location types - how we reference the source
export type LocationType = 'path' | 'branch' | 'tag' | 'commit' | 'working';

// Provider types - kept simple, expand only when needed
export type ProviderType = 'github' | 'gitlab' | 'generic' | 'local';

/**
 * Core file tree source descriptor
 * Represents a source that can be resolved to a FileSystemTree
 */
export interface FileTreeSource {
  // Identity
  id: string; // Simple unique ID (e.g., "local-/path/to/repo" or "github-owner-repo-main")
  type: SourceType; // 'local' or 'remote'

  // Repository identity (aligns with Repository type)
  owner: string; // Repository owner/organization
  name: string; // Repository name
  remoteUrl: string; // The remote URL (for both local clones and remote sources)

  // Source location
  location: string; // Path for local, branch/tag/commit for remote
  locationType: LocationType; // How to interpret the location

  // Display & UI
  label: string; // Human-friendly display name
  color?: string; // Optional color for UI differentiation
  icon?: string; // Optional icon identifier

  // State & metadata
  isTemporary?: boolean; // True for unsaved/experimental sources
  isDefault?: boolean; // True for the default source in a set
  lastAccessed?: number; // Timestamp of last access
  createdAt?: number; // When this source was created

  // Provider info (optional, mainly for remotes)
  provider?: ProviderType; // Which provider (github, gitlab, etc.)
  apiUrl?: string; // API endpoint for remote sources

  // Additional metadata
  metadata?: {
    currentBranch?: string; // For local working copies
    commitSha?: string; // Specific commit if locked to one
    isDirty?: boolean; // For local sources with uncommitted changes
    subdir?: string; // If focusing on a subdirectory (monorepo support)
    [key: string]: unknown; // Extensible for future needs
  };
}

export interface FileTreeStats {
  fileCount: number;
  directoryCount: number;
  loadedAt: number;
}

/**
 * Extended source with loaded tree data
 */
export interface LoadedFileTreeSource extends FileTreeSource {
  tree: FileTree; // The loaded FileSystemTree
  treeStats: FileTreeStats;
  filterLayers?: any[]; // Filter layers that were applied
}

/**
 * Factory functions for creating sources
 */
export const createFileTreeSource = {
  /**
   * Create a local file tree source (working copy)
   */
  localWorkingCopy(
    path: string,
    owner: string,
    repo: string,
    remoteUrl: string,
    currentBranch?: string,
  ): FileTreeSource {
    return {
      id: `local-${path}`,
      type: 'local',
      owner,
      name: repo,
      remoteUrl,
      location: path,
      locationType: 'working',
      label: `Local: ${repo}${currentBranch ? ` (${currentBranch})` : ''}`,
      provider: 'local',
      metadata: {
        currentBranch,
      },
    };
  },

  /**
   * Create a remote branch source (GitHub, etc.)
   */
  remoteBranch(
    owner: string,
    repo: string,
    remoteUrl: string,
    branch: string,
    provider: ProviderType = 'github',
  ): FileTreeSource {
    return {
      id: `${provider}-${owner}-${repo}-${branch}`,
      type: 'remote',
      owner,
      name: repo,
      remoteUrl,
      location: branch,
      locationType: 'branch',
      label: `${repo}@${branch}`,
      provider,
      apiUrl: provider === 'github' ? 'https://api.github.com' : undefined,
    };
  },

  /**
   * Create a remote tag source
   */
  remoteTag(
    owner: string,
    repo: string,
    remoteUrl: string,
    tag: string,
    provider: ProviderType = 'github',
  ): FileTreeSource {
    return {
      id: `${provider}-${owner}-${repo}-tag-${tag}`,
      type: 'remote',
      owner,
      name: repo,
      remoteUrl,
      location: tag,
      locationType: 'tag',
      label: `${repo}@${tag}`,
      provider,
      apiUrl: provider === 'github' ? 'https://api.github.com' : undefined,
    };
  },

  /**
   * Create a remote commit source
   */
  remoteCommit(
    owner: string,
    repo: string,
    remoteUrl: string,
    commitSha: string,
    provider: ProviderType = 'github',
  ): FileTreeSource {
    const shortSha = commitSha.substring(0, 7);
    return {
      id: `${provider}-${owner}-${repo}-commit-${shortSha}`,
      type: 'remote',
      owner,
      name: repo,
      remoteUrl,
      location: commitSha,
      locationType: 'commit',
      label: `${repo}@${shortSha}`,
      provider,
      apiUrl: provider === 'github' ? 'https://api.github.com' : undefined,
      metadata: {
        commitSha,
      },
    };
  },

  /**
   * Create a temporary/experimental source
   */
  temporary(
    baseSource: FileTreeSource,
    location: string,
    locationType: LocationType,
  ): FileTreeSource {
    return {
      ...baseSource,
      id: `temp-${baseSource.id}-${Date.now()}`,
      location,
      locationType,
      label: `${baseSource.label} (temporary)`,
      isTemporary: true,
      createdAt: Date.now(),
    };
  },
};

/**
 * Type guards
 */
export const isLocalSource = (source: FileTreeSource): boolean =>
  source.type === 'local';
export const isRemoteSource = (source: FileTreeSource): boolean =>
  source.type === 'remote';
export const isTemporarySource = (source: FileTreeSource): boolean =>
  source.isTemporary === true;
export const isGitHubSource = (source: FileTreeSource): boolean =>
  source.provider === 'github';

/**
 * Utility functions
 */
export function getSourceDisplayName(source: FileTreeSource): string {
  if (source.label) return source.label;

  const prefix = source.type === 'local' ? 'Local: ' : '';
  const suffix =
    source.locationType === 'branch'
      ? `@${source.location}`
      : source.locationType === 'tag'
        ? `@${source.location}`
        : source.locationType === 'commit'
          ? `@${source.location.substring(0, 7)}`
          : '';

  return `${prefix}${source.name}${suffix}`;
}

export function getSourceIdentifier(source: FileTreeSource): string {
  // Returns a stable identifier for deduplication
  if (source.type === 'local') {
    return `local:${source.location}`;
  }
  return `${source.provider}:${source.owner}/${source.name}:${source.locationType}:${source.location}`;
}

export function shouldCacheSource(source: FileTreeSource): boolean {
  // Temporary sources might not need caching, or need shorter TTL
  return !source.isTemporary;
}

export function getSourceCacheTTL(source: FileTreeSource): number {
  // Cache TTL in milliseconds
  if (source.isTemporary) return 5 * 60 * 1000; // 5 minutes for temporary
  if (source.type === 'local') return 10 * 60 * 1000; // 10 minutes for local
  if (source.locationType === 'commit') return 60 * 60 * 1000; // 1 hour for commits (immutable)
  return 30 * 60 * 1000; // 30 minutes default
}

/**
 * Source comparison for sorting
 */
export function compareFileTreeSources(
  a: FileTreeSource,
  b: FileTreeSource,
): number {
  // Sort order: default first, then local, then remote, then by label
  if (a.isDefault && !b.isDefault) return -1;
  if (!a.isDefault && b.isDefault) return 1;
  if (a.type === 'local' && b.type === 'remote') return -1;
  if (a.type === 'remote' && b.type === 'local') return 1;
  return a.label.localeCompare(b.label);
}
