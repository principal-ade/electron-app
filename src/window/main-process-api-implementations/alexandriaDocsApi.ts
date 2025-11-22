import { ipcRenderer } from 'electron';
import type { AlexandriaDocsAPI } from '../../shared/main-process-api-interfaces/AlexandriaDocsAPI';
import { AlexandriaDocsAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaDocsAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

export const alexandriaDocsAPI: AlexandriaDocsAPI = {
  getDocuments: (entry: AlexandriaEntry) =>
    ipcRenderer.invoke(AlexandriaDocsAPIEvent.GET_DOCUMENTS, entry),

  getExcludedDocuments: (entry: AlexandriaEntry) =>
    ipcRenderer.invoke(AlexandriaDocsAPIEvent.GET_EXCLUDED_DOCUMENTS, entry),

  getDocumentsWithExclusions: (entry: AlexandriaEntry) =>
    ipcRenderer.invoke(
      AlexandriaDocsAPIEvent.GET_DOCUMENTS_WITH_EXCLUSIONS,
      entry,
    ),

  getComprehensiveDocuments: (entry: AlexandriaEntry) =>
    ipcRenderer.invoke(
      AlexandriaDocsAPIEvent.GET_COMPREHENSIVE_DOCUMENTS,
      entry,
    ),

  getDocumentsWithFiles: (entry: AlexandriaEntry) =>
    ipcRenderer.invoke(AlexandriaDocsAPIEvent.GET_DOCUMENTS_WITH_FILES, entry),
};
