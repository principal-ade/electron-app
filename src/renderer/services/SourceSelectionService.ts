import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource } from '../types/file-tree-source';
import { createFileTreeSource } from '../types/file-tree-source';
import { parseGitHubUrl } from "@principal-ai/repository-abstraction";

/**
 * Service for managing which source is selected for a repository
 * Handles both local clones and remote branches/tags/commits
 */
export class SourceSelectionService {
  private static STORAGE_KEY_PREFIX = 'selected_source_';
  
  /**
   * Get the storage key for a repository
   */
  private static getStorageKey(remoteUrl: string): string {
    const sanitized = remoteUrl.replace(/[^a-zA-Z0-9]/g, '_');
    return `${this.STORAGE_KEY_PREFIX}${sanitized}`;
  }
  
  /**
   * Get all available sources for a repository
   */
  static getAvailableSources(repository: Repository): FileTreeSource[] {
    const sources: FileTreeSource[] = [];
    
    // Use repository fields directly - these are required fields
    const owner = repository.owner;
    const repo = repository.name;
    
    if (!owner || !repo) {
      throw new Error(`Repository missing required fields: owner="${owner}", name="${repo}". Repository: ${JSON.stringify(repository)}`);
    }
    
    // Add local clone sources
    if (repository.localClones && repository.localClones.length > 0) {
      repository.localClones.forEach((clone) => {
        const source = createFileTreeSource.localWorkingCopy(
          clone.path,
          owner,
          repo,
          repository.remoteUrl,
          clone.currentBranch
        );
        source.id = `local-${clone.path}`;
        sources.push(source);
      });
    }
    
    // Add default remote branch source
    const defaultBranch = repository.metadata?.defaultBranch || 'main';
    const remoteSource = createFileTreeSource.remoteBranch(
      owner,
      repo,
      repository.remoteUrl,
      defaultBranch
    );
    sources.push(remoteSource);
    
    return sources;
  }
  
  /**
   * Get the default source for a repository
   * Priority: first local clone > remote default branch
   */
  static getDefaultSource(repository: Repository): FileTreeSource | null {
    const availableSources = this.getAvailableSources(repository);
    
    if (availableSources.length === 0) {
      return null;
    }
    
    // Prefer first local clone if available
    const localSource = availableSources.find(s => s.type === 'local');
    if (localSource) {
      return localSource;
    }
    
    // Fall back to remote source
    return availableSources.find(s => s.type === 'remote') || availableSources[0];
  }
  
  /**
   * Get the selected source for a repository
   * Returns stored selection or default if no selection is stored
   */
  static getSelectedSource(repository: Repository): FileTreeSource | null {
    const availableSources = this.getAvailableSources(repository);
    
    if (availableSources.length === 0) {
      return null;
    }
    
    try {
      const stored = localStorage.getItem(this.getStorageKey(repository.remoteUrl));
      if (stored) {
        const storedSourceId = stored;
        // Find the stored source in available sources
        const foundSource = availableSources.find(s => s.id === storedSourceId);
        if (foundSource) {
          return foundSource;
        }
      }
    } catch (error) {
      console.error('Failed to get selected source:', error);
    }
    
    // Fall back to default
    return this.getDefaultSource(repository);
  }
  
  /**
   * Set the selected source for a repository
   */
  static setSelectedSource(remoteUrl: string, sourceId: string): void {
    try {
      localStorage.setItem(this.getStorageKey(remoteUrl), sourceId);
    } catch (error) {
      console.error('Failed to set selected source:', error);
    }
  }
  
  /**
   * Clear selection for a repository (will fall back to default)
   */
  static clearSelection(remoteUrl: string): void {
    try {
      localStorage.removeItem(this.getStorageKey(remoteUrl));
    } catch (error) {
      console.error('Failed to clear selection:', error);
    }
  }
  
  /**
   * Check if a specific source is selected
   */
  static isSourceSelected(repository: Repository, sourceId: string): boolean {
    const selectedSource = this.getSelectedSource(repository);
    return selectedSource?.id === sourceId;
  }
  
  /**
   * Get user-friendly display name for a source
   */
  static getSourceDisplayName(source: FileTreeSource): string {
    if (source.type === 'local') {
      const cloneName = source.location.split('/').slice(-1)[0] || 'Local Clone';
      const branch = source.metadata?.currentBranch ? ` (${source.metadata.currentBranch})` : '';
      return `${cloneName}${branch}`;
    } else {
      const branch = source.location;
      return `${source.name}@${branch}`;
    }
  }
  
  /**
   * Get source type display name
   */
  static getSourceTypeDisplayName(source: FileTreeSource): string {
    if (source.type === 'local') {
      return 'Local Clone';
    } else {
      switch (source.locationType) {
        case 'branch': return 'Remote Branch';
        case 'tag': return 'Remote Tag';
        case 'commit': return 'Remote Commit';
        default: return 'Remote Source';
      }
    }
  }
  
  /**
   * Create a new remote branch source and optionally select it
   */
  static createRemoteBranchSource(
    repository: Repository,
    branchName: string,
    makeSelected: boolean = false
  ): FileTreeSource | null {
    const repoInfo = parseGitHubUrl(repository.remoteUrl);
    const owner = repoInfo?.owner || repository.owner;
    const repo = repoInfo?.repo || repository.name;
    
    if (!owner || !repo) {
      return null;
    }
    
    const source = createFileTreeSource.remoteBranch(
      owner,
      repo,
      repository.remoteUrl,
      branchName
    );
    
    if (makeSelected) {
      this.setSelectedSource(repository.remoteUrl, source.id);
    }
    
    return source;
  }
  
  /**
   * Create a new remote tag source and optionally select it
   */
  static createRemoteTagSource(
    repository: Repository,
    tagName: string,
    makeSelected: boolean = false
  ): FileTreeSource | null {
    const repoInfo = parseGitHubUrl(repository.remoteUrl);
    const owner = repoInfo?.owner || repository.owner;
    const repo = repoInfo?.repo || repository.name;
    
    if (!owner || !repo) {
      return null;
    }
    
    const source = createFileTreeSource.remoteTag(
      owner,
      repo,
      repository.remoteUrl,
      tagName
    );
    
    if (makeSelected) {
      this.setSelectedSource(repository.remoteUrl, source.id);
    }
    
    return source;
  }
  
  /**
   * Get sources grouped by type for UI display
   */
  static getGroupedSources(repository: Repository): {
    local: FileTreeSource[];
    remote: FileTreeSource[];
  } {
    const sources = this.getAvailableSources(repository);
    
    return {
      local: sources.filter(s => s.type === 'local'),
      remote: sources.filter(s => s.type === 'remote')
    };
  }
}