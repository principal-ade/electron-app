/**
 * Main process handler for Alexandria document management
 */

import { ipcMain } from 'electron';
import type {
  AlexandriaDocsAPI,
  ComprehensiveDocuments,
  DocumentsWithFiles,
  DocumentWithFiles,
} from '../../shared/main-process-api-interfaces/AlexandriaDocsAPI';
import { AlexandriaDocsAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaDocsAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

export class AlexandriaDocsApiEventHandler implements AlexandriaDocsAPI {
  private registryService: AlexandriaRegistryService;

  constructor() {
    this.registryService = AlexandriaRegistryService.getInstance();
  }

  async getDocuments(entry: AlexandriaEntry): Promise<string[]> {
    if (!entry.path) {
      throw new Error('Alexandria entry must have a path');
    }
    return this.registryService.getRepositoryDocuments(entry.path);
  }

  async getExcludedDocuments(entry: AlexandriaEntry): Promise<string[]> {
    if (!entry.path) {
      throw new Error('Alexandria entry must have a path');
    }
    return this.registryService.getExcludedDocuments(entry.path);
  }

  async getDocumentsWithExclusions(entry: AlexandriaEntry): Promise<{
    documents: string[];
    excluded: string[];
  }> {
    if (!entry.path) {
      throw new Error('Alexandria entry must have a path');
    }
    return this.registryService.getRepositoryDocumentsWithExclusions(
      entry.path,
    );
  }

  async getComprehensiveDocuments(
    entry: AlexandriaEntry,
  ): Promise<ComprehensiveDocuments> {
    if (!entry.path) {
      throw new Error('Alexandria entry must have a path');
    }
    return this.registryService.getComprehensiveDocuments(entry.path, true);
  }

  async getDocumentsWithFiles(
    entry: AlexandriaEntry,
  ): Promise<DocumentsWithFiles> {
    if (!entry.path) {
      throw new Error('Alexandria entry must have a path');
    }

    // Get comprehensive documents first
    const comprehensive = await this.getComprehensiveDocuments(entry);

    // Get all CodebaseViews for this repository
    const codebaseViews = await this.registryService.getCodebaseViews(
      entry.path,
    );

    // Build mapping of overview document paths to their files
    const filesMap = new Map<string, string[]>();

    for (const view of codebaseViews) {
      // Get all files from all reference groups
      const allFiles: string[] = [];
      if (view.referenceGroups) {
        Object.values(view.referenceGroups).forEach((group) => {
          if (group.files) {
            allFiles.push(...group.files);
          }
        });
      }

      // Map the overview document to these files
      if (view.overviewPath && allFiles.length > 0) {
        filesMap.set(view.overviewPath, allFiles);
      }
    }

    // Build the document list with files
    const documents: DocumentWithFiles[] = [];

    // Add tracked documents
    for (const relativePath of comprehensive.tracked) {
      const fullPath = `${entry.path}/${relativePath}`.replace(/\/+/g, '/');
      documents.push({
        path: fullPath,
        relativePath,
        isTracked: true,
        files: filesMap.get(relativePath) || [],
      });
    }

    // Add untracked documents
    for (const relativePath of comprehensive.untracked) {
      const fullPath = `${entry.path}/${relativePath}`.replace(/\/+/g, '/');
      documents.push({
        path: fullPath,
        relativePath,
        isTracked: false,
      });
    }

    return { documents };
  }

  /**
   * Clean up handlers when shutting down
   */
  destroy(): void {
    // Remove all handlers using enum values
    ipcMain.removeHandler(AlexandriaDocsAPIEvent.GET_DOCUMENTS);
    ipcMain.removeHandler(AlexandriaDocsAPIEvent.GET_EXCLUDED_DOCUMENTS);
    ipcMain.removeHandler(AlexandriaDocsAPIEvent.GET_DOCUMENTS_WITH_EXCLUSIONS);
    ipcMain.removeHandler(AlexandriaDocsAPIEvent.GET_COMPREHENSIVE_DOCUMENTS);
    ipcMain.removeHandler(AlexandriaDocsAPIEvent.GET_DOCUMENTS_WITH_FILES);
  }
}

/**
 * Register Alexandria Docs IPC handlers
 */
export function registerAlexandriaDocsHandlers(): void {
  const handler = new AlexandriaDocsApiEventHandler();

  // Register all IPC handlers using enum values
  ipcMain.handle(
    AlexandriaDocsAPIEvent.GET_DOCUMENTS,
    (_, entry: AlexandriaEntry) => handler.getDocuments(entry),
  );

  ipcMain.handle(
    AlexandriaDocsAPIEvent.GET_EXCLUDED_DOCUMENTS,
    (_, entry: AlexandriaEntry) => handler.getExcludedDocuments(entry),
  );

  ipcMain.handle(
    AlexandriaDocsAPIEvent.GET_DOCUMENTS_WITH_EXCLUSIONS,
    (_, entry: AlexandriaEntry) => handler.getDocumentsWithExclusions(entry),
  );

  ipcMain.handle(
    AlexandriaDocsAPIEvent.GET_COMPREHENSIVE_DOCUMENTS,
    (_, entry: AlexandriaEntry) => handler.getComprehensiveDocuments(entry),
  );

  ipcMain.handle(
    AlexandriaDocsAPIEvent.GET_DOCUMENTS_WITH_FILES,
    (_, entry: AlexandriaEntry) => handler.getDocumentsWithFiles(entry),
  );

  console.log('[AlexandriaDocs] IPC handlers registered');
}
