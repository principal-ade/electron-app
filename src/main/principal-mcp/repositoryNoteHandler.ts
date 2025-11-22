import path from 'path';
import { MemoryPalace } from '@principal-ai/alexandria-core-library';
import type { StoredAnchoredNote } from '@principal-ai/alexandria-core-library';
import { NodeFileSystemAdapter } from '@principal-ai/alexandria-core-library/node';
import { GitService } from '../version-control-providers/GitService';
import type { GitInfo } from '../../shared/types/git.types';
import { RepositoryNote } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import {
  filterNotesByPath,
  sortNotesByRelevance,
  FilteredNote,
} from '../../shared/utils/noteFiltering';

interface NoteRequest {
  id?: string;
  note: string;
  directoryPath: string;
  anchors?: string[];
  tags?: string[];
  confidence?: 'high' | 'medium' | 'low';
  type?: 'decision' | 'pattern' | 'gotcha' | 'explanation';
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

interface NoteResponse {
  success: boolean;
  noteId?: string;
  repository?: {
    remoteUrl: string;
    owner?: string;
    repo?: string;
  };
  relativePath?: string;
  error?: string;
}

class RepositoryNoteHandler {
  private gitService: GitService;
  private memoryInstances: Map<string, MemoryPalace> = new Map();
  private fs = new NodeFileSystemAdapter();

  constructor() {
    this.gitService = new GitService();
  }

  private async getMemoryInstance(
    targetPath: string,
  ): Promise<MemoryPalace | null> {
    const gitInfo = await this.gitService.getGitInfo(targetPath);
    if (!gitInfo || !gitInfo.root) {
      return null;
    }

    // Cache MemoryPalace instances per repository
    if (!this.memoryInstances.has(gitInfo.root)) {
      try {
        // Validate the repository path first
        const validatedPath = MemoryPalace.validateRepositoryPath(
          this.fs,
          gitInfo.root,
        );
        this.memoryInstances.set(
          gitInfo.root,
          new MemoryPalace(validatedPath, this.fs),
        );
      } catch (error) {
        console.error(
          '[RepositoryNoteHandler] Failed to validate repository path:',
          error,
        );
        return null;
      }
    }

    const instance = this.memoryInstances.get(gitInfo.root);
    if (!instance) {
      console.error('[RepositoryNoteHandler] MemoryPalace instance not found after creation');
      return null;
    }
    return instance;
  }

  private convertToRepositoryNote(
    storedNote: StoredAnchoredNote,
    gitInfo: GitInfo,
  ): RepositoryNote {
    // Convert a24z StoredNote to RepositoryNote format for UI compatibility
    // Note: gitInfo is required - we can't have notes without a repository
    const primaryAnchor = storedNote.anchors?.[0] || '.';
    const fullPath = path.join(gitInfo.root, primaryAnchor);

    // Extract confidence and type from metadata if they exist
    const confidence = storedNote.metadata?.confidence || 'medium';
    const type = storedNote.metadata?.type || 'explanation';

    return {
      id: storedNote.id,
      note: storedNote.note,
      fullPath,
      relativePath: primaryAnchor,
      anchors: storedNote.anchors || [],
      tags: storedNote.tags || [],
      confidence: confidence as 'high' | 'medium' | 'low',
      type: type as 'decision' | 'pattern' | 'gotcha' | 'explanation',
      timestamp: storedNote.timestamp || Date.now(),
      metadata: storedNote.metadata || {},
      gitInfo: {
        root: gitInfo.root,
        remoteUrl: gitInfo.remoteUrl || '', // Provide empty string if missing
        branch: gitInfo.branch,
        owner: gitInfo.owner,
        repo: gitInfo.repo,
      },
    };
  }

  async storeNote(request: NoteRequest): Promise<NoteResponse> {
    try {
      const { note, directoryPath, metadata } = request;

      // Get git information
      const gitInfo = await this.gitService.getGitInfo(directoryPath);
      if (!gitInfo || !gitInfo.root) {
        return {
          success: false,
          error: 'Directory is not part of a git repository',
        };
      }

      // For local repos without remotes, we still want to allow notes
      // but we'll use an empty string for remoteUrl
      if (!gitInfo.remoteUrl) {
        console.warn(
          '[RepositoryNoteHandler] Repository has no remote URL, using local repository',
        );
      }

      // Get a24z memory instance
      const memory = await this.getMemoryInstance(directoryPath);
      if (!memory) {
        return {
          success: false,
          error: 'Could not initialize memory for repository',
        };
      }

      // Calculate relative path
      const relativePath = path.relative(gitInfo.root, directoryPath) || '.';

      // Prepare anchors - a24z expects relative paths
      const anchors = request.anchors || [relativePath];
      const normalizedAnchors = anchors
        .map((anchor) => {
          if (path.isAbsolute(anchor)) {
            return path.relative(gitInfo.root, anchor);
          }
          return anchor;
        })
        .filter((a) => a && !a.startsWith('..'));

      // Use MemoryPalace to save the note
      const savedNote = memory.saveNote({
        note,
        anchors:
          normalizedAnchors.length > 0 ? normalizedAnchors : [relativePath],
        tags: request.tags || ['general'],
        metadata: {
          ...metadata,
          directoryPath,
          relativePath,
          confidence: request.confidence || 'medium',
          type: request.type || 'explanation',
        },
      });

      return {
        success: true,
        noteId: savedNote.note.id,
        repository: {
          remoteUrl: gitInfo.remoteUrl || '',
          owner: gitInfo.owner || '',
          repo: gitInfo.repo || '',
        },
        relativePath,
      };
    } catch (error) {
      console.error('[RepositoryNoteHandler] Error storing note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getNotesForRepository(remoteUrl: string): Promise<RepositoryNote[]> {
    try {
      // This is tricky without a local path
      // For now, return empty array - UI should use getNotesForPath instead
      console.log(
        '[RepositoryNoteHandler] getNotesForRepository called with:',
        remoteUrl,
      );
      return [];
    } catch (error) {
      console.error('[RepositoryNoteHandler] Error getting notes:', error);
      return [];
    }
  }

  async getNotesForPath(
    targetPath: string,
    includeParentNotes: boolean = true,
  ): Promise<{
    notes: FilteredNote[];
    repository?: { remoteUrl: string; owner?: string; repo?: string };
  }> {
    try {
      // Get git info
      const gitInfo = await this.gitService.getGitInfo(targetPath);
      if (!gitInfo || !gitInfo.remoteUrl) {
        return { notes: [] };
      }

      // Get a24z memory instance
      const memory = await this.getMemoryInstance(targetPath);
      if (!memory) {
        return { notes: [] };
      }

      // Calculate relative path
      const targetRelativePath = path.relative(gitInfo.root, targetPath) || '.';

      // Use MemoryPalace to get notes
      const storedNotes = memory.getNotes(includeParentNotes);

      // Convert to RepositoryNote format
      const repositoryNotes = storedNotes.map((note) =>
        this.convertToRepositoryNote(note, gitInfo),
      );

      // Filter and sort notes using existing utilities
      const filteredNotes = filterNotesByPath(
        repositoryNotes,
        targetRelativePath,
        includeParentNotes,
      );
      const sortedNotes = sortNotesByRelevance(filteredNotes);

      return {
        notes: sortedNotes,
        repository: {
          remoteUrl: gitInfo.remoteUrl,
          owner: gitInfo.owner,
          repo: gitInfo.repo,
        },
      };
    } catch (error) {
      console.error(
        '[RepositoryNoteHandler] Error getting notes for path:',
        error,
      );
      return { notes: [] };
    }
  }

  async deleteNote(noteId: string, targetPath: string): Promise<boolean> {
    try {
      const memory = await this.getMemoryInstance(targetPath);
      if (!memory) {
        return false;
      }

      // Use MemoryPalace's deleteNoteById method
      return memory.deleteNoteById(noteId);
    } catch (error) {
      console.error('[RepositoryNoteHandler] Error deleting note:', error);
      return false;
    }
  }

  async updateNote(
    noteId: string,
    targetPath: string,
    _updates: Partial<
      Pick<RepositoryNote, 'note' | 'metadata' | 'tags' | 'confidence' | 'type'>
    >,
  ): Promise<boolean> {
    try {
      const memory = await this.getMemoryInstance(targetPath);
      if (!memory) {
        return false;
      }

      // @principal-ai/alexandria-core-library doesn't expose an update method directly
      console.warn(
        '[RepositoryNoteHandler] Note update not directly supported by @principal-ai/alexandria-core-library',
      );

      // For now, return false as updates aren't supported
      // You could implement this by directly manipulating the JSON file if needed
      return false;
    } catch (error) {
      console.error('[RepositoryNoteHandler] Error updating note:', error);
      return false;
    }
  }

  async getAllNotesForPath(targetPath: string): Promise<StoredAnchoredNote[]> {
    try {
      const memory = await this.getMemoryInstance(targetPath);
      if (!memory) {
        return [];
      }

      // Get all notes for the repository
      return memory.getNotes(true);
    } catch (error) {
      console.error('[RepositoryNoteHandler] Error getting all notes:', error);
      return [];
    }
  }

  async getUsedTags(targetPath: string): Promise<string[]> {
    try {
      const memory = await this.getMemoryInstance(targetPath);
      if (!memory) {
        return [];
      }

      return memory.getUsedTags();
    } catch (error) {
      console.error('[RepositoryNoteHandler] Error getting used tags:', error);
      return [];
    }
  }

  async getGuidance(targetPath: string): Promise<string | null> {
    try {
      const memory = await this.getMemoryInstance(targetPath);
      if (!memory) {
        return null;
      }

      return memory.getGuidance();
    } catch (error) {
      console.error('[RepositoryNoteHandler] Error getting guidance:', error);
      return null;
    }
  }
}

// Export singleton instance
export const repositoryNoteHandler = new RepositoryNoteHandler();
