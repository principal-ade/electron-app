/**
 * IPC API interface for Alexandria document management
 * Provides access to documents associated with CodebaseViews
 */

import type { AlexandriaEntry } from '@a24z/core-library';

export enum AlexandriaDocsAPIEvent {
  GET_DOCUMENTS = 'alexandria-docs:get-documents',
  GET_EXCLUDED_DOCUMENTS = 'alexandria-docs:get-excluded-documents',
  GET_DOCUMENTS_WITH_EXCLUSIONS = 'alexandria-docs:get-documents-with-exclusions',
}

export interface AlexandriaDocsWithExclusions {
  documents: string[];
  excluded: string[];
}

export interface AlexandriaDocsAPI {
  /**
   * Get all markdown documents for a repository
   * These are the overview documents associated with CodebaseViews
   * @param entry - The Alexandria repository entry
   * @returns Array of document paths relative to repository root
   */
  getDocuments(entry: AlexandriaEntry): Promise<string[]>;

  /**
   * Get excluded document files from Alexandria configuration
   * These are markdown files that should not be tracked or indexed
   * @param entry - The Alexandria repository entry
   * @returns Array of excluded file paths
   */
  getExcludedDocuments(entry: AlexandriaEntry): Promise<string[]>;

  /**
   * Get all markdown documents with exclusions applied
   * @param entry - The Alexandria repository entry
   * @returns Object with documents and excluded paths
   */
  getDocumentsWithExclusions(
    entry: AlexandriaEntry,
  ): Promise<AlexandriaDocsWithExclusions>;
}
