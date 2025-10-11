/**
 * Renderer-side service for Alexandria document management
 * Communicates with main process via IPC using window.mainProcess
 */

import type { AlexandriaEntry } from '@a24z/core-library';
import type {
  AlexandriaDocsWithExclusions,
  ComprehensiveDocuments,
} from '../../shared/main-process-api-interfaces/AlexandriaDocsAPI';

export class AlexandriaDocsService {
  /**
   * Get all markdown documents for a repository
   * These are the overview documents associated with CodebaseViews
   * @param entry - The Alexandria repository entry
   * @returns Array of document paths relative to repository root
   */
  static async getDocuments(entry: AlexandriaEntry): Promise<string[]> {
    return window.mainProcess.alexandriaDocs.getDocuments(entry);
  }

  /**
   * Get excluded document files from Alexandria configuration
   * These are markdown files that should not be tracked or indexed
   * @param entry - The Alexandria repository entry
   * @returns Array of excluded file paths
   */
  static async getExcludedDocuments(entry: AlexandriaEntry): Promise<string[]> {
    return window.mainProcess.alexandriaDocs.getExcludedDocuments(entry);
  }

  /**
   * Get all markdown documents with exclusions applied
   * @param entry - The Alexandria repository entry
   * @returns Object with documents and excluded paths
   */
  static async getDocumentsWithExclusions(
    entry: AlexandriaEntry,
  ): Promise<AlexandriaDocsWithExclusions> {
    return window.mainProcess.alexandriaDocs.getDocumentsWithExclusions(entry);
  }

  /**
   * Get comprehensive document information including tracked and untracked
   * @param entry - The Alexandria repository entry
   * @returns Object with tracked, untracked, excluded, and all document paths
   */
  static async getComprehensiveDocuments(
    entry: AlexandriaEntry,
  ): Promise<ComprehensiveDocuments> {
    return window.mainProcess.alexandriaDocs.getComprehensiveDocuments(entry);
  }
}
