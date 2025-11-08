/**
 * IPC API interface for Alexandria document management
 * Provides access to documents associated with CodebaseViews
 */

import type { AlexandriaEntry } from '@a24z/core-library';

export enum AlexandriaDocsAPIEvent {
  GET_DOCUMENTS = 'alexandria-docs:get-documents',
  GET_EXCLUDED_DOCUMENTS = 'alexandria-docs:get-excluded-documents',
  GET_DOCUMENTS_WITH_EXCLUSIONS = 'alexandria-docs:get-documents-with-exclusions',
  GET_COMPREHENSIVE_DOCUMENTS = 'alexandria-docs:get-comprehensive-documents',
  GET_DOCUMENTS_WITH_FILES = 'alexandria-docs:get-documents-with-files',
}

export interface AlexandriaDocsWithExclusions {
  documents: string[];
  excluded: string[];
}

export interface ComprehensiveDocuments {
  tracked: string[];
  untracked: string[];
  excluded: string[];
  all: string[];
}

export interface DocumentWithFiles {
  /** Full path to the document */
  path: string;
  /** Relative path from repository root */
  relativePath: string;
  /** Whether this document is tracked (in a CodebaseView) */
  isTracked: boolean;
  /** Files associated with this document from CodebaseView (only if tracked) */
  files?: string[];
}

export interface DocumentsWithFiles {
  documents: DocumentWithFiles[];
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

  /**
   * Get comprehensive document information including tracked and untracked
   * @param entry - The Alexandria repository entry
   * @returns Object with tracked, untracked, excluded, and all document paths
   */
  getComprehensiveDocuments(
    entry: AlexandriaEntry,
  ): Promise<ComprehensiveDocuments>;

  /**
   * Get all documents with their associated CodebaseView files
   * @param entry - The Alexandria repository entry
   * @returns Object with documents and their associated files
   */
  getDocumentsWithFiles(entry: AlexandriaEntry): Promise<DocumentsWithFiles>;
}
