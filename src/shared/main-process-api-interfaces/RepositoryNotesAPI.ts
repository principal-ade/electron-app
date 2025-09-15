
import type { GitInfo } from '../types/git.types';

/**
 * Repository note structure
 * Stores notes with associated directory paths and git information
 */

export interface RepositoryNote {
  id: string;
  note: string;
  fullPath: string; // Full absolute path to the directory
  relativePath: string; // Relative path from git root
  anchors?: string[]; // All paths this note relates to (set-based approach)
  tags?: string[]; // Semantic tags for categorization
  confidence?: 'high' | 'medium' | 'low'; // Confidence level of the knowledge
  type?: 'decision' | 'pattern' | 'gotcha' | 'explanation'; // Type of knowledge
  gitInfo: GitInfo;
  timestamp: number;
  metadata?: Record<string, unknown>;
  deleted?: boolean; // Soft delete flag
}

export enum RepositoryNotesAPIEvent {
  GET_FOR_REPOSITORY = 'repository-notes:get-for-repository',
  GET_FOR_PATH = 'repository-notes:get-for-path',
  STORE_NOTE = 'repository-notes:store',
  DELETE_NOTE = 'repository-notes:delete',
  UPDATE_NOTE = 'repository-notes:update',
}

export interface StoreNoteRequest {
  note: string;
  directoryPath: string;
  anchors?: string[]; // All paths this note relates to
  tags?: string[]; // Semantic tags for categorization
  confidence?: 'high' | 'medium' | 'low'; // Confidence level of the knowledge
  type?: 'decision' | 'pattern' | 'gotcha' | 'explanation'; // Type of knowledge
  metadata?: Record<string, unknown>;
}

export interface StoreNoteResponse {
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

export interface GetNotesForPathResponse {
  notes: Array<RepositoryNote & { isParentDirectory?: boolean; pathDistance?: number }>;
  repository?: {
    remoteUrl: string;
    owner?: string;
    repo?: string;
  };
}

export interface RepositoryNotesAPI {
  // Get all notes for a repository
  getNotesForRepository: (remoteUrl: string) => Promise<RepositoryNote[]>;
  
  // Get notes for a specific path (file or directory)
  getNotesForPath: (path: string, includeParentNotes?: boolean) => Promise<GetNotesForPathResponse>;
  
  // Store a new note
  storeNote: (request: StoreNoteRequest) => Promise<StoreNoteResponse>;
  
  // Delete a note
  deleteNote: (remoteUrl: string, noteId: string) => Promise<boolean>;
  
  // Update an existing note
  updateNote: (remoteUrl: string, noteId: string, updates: Partial<Pick<RepositoryNote, 'note' | 'metadata'>>) => Promise<boolean>;
}