/**
 * Main process handler for Alexandria document management
 */

import { ipcMain } from 'electron';
import type {
  AlexandriaDocsAPI,
  ComprehensiveDocuments,
} from '../../shared/main-process-api-interfaces/AlexandriaDocsAPI';
import { AlexandriaDocsAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaDocsAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
import type { AlexandriaEntry } from '@a24z/core-library';

export class AlexandriaDocsApiEventHandler implements AlexandriaDocsAPI {
  private registryService: AlexandriaRegistryService;

  constructor() {
    this.registryService = AlexandriaRegistryService.getInstance();
  }

  async getDocuments(entry: AlexandriaEntry): Promise<string[]> {
    // Use the entry's name to get documents
    if (!entry.name) {
      throw new Error('Alexandria entry must have a name');
    }
    return this.registryService.getRepositoryDocuments(entry.name);
  }

  async getExcludedDocuments(entry: AlexandriaEntry): Promise<string[]> {
    // Use the entry's name to get excluded documents
    if (!entry.name) {
      throw new Error('Alexandria entry must have a name');
    }
    return this.registryService.getExcludedDocuments(entry.name);
  }

  async getDocumentsWithExclusions(entry: AlexandriaEntry): Promise<{
    documents: string[];
    excluded: string[];
  }> {
    // Use the entry's name to get documents with exclusions
    if (!entry.name) {
      throw new Error('Alexandria entry must have a name');
    }
    return this.registryService.getRepositoryDocumentsWithExclusions(
      entry.name,
    );
  }

  async getComprehensiveDocuments(
    entry: AlexandriaEntry,
  ): Promise<ComprehensiveDocuments> {
    // Use the entry's name to get comprehensive documents (always respecting .gitignore)
    if (!entry.name) {
      throw new Error('Alexandria entry must have a name');
    }
    return this.registryService.getComprehensiveDocuments(entry.name, true);
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

  console.log('[AlexandriaDocs] IPC handlers registered');
}
