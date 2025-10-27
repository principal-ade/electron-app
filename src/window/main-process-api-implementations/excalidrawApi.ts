import { ipcRenderer } from 'electron';
import type {
  ExcalidrawAPI,
  ExcalidrawDiagram,
  ExcalidrawDiagramData,
} from '../../shared/main-process-api-interfaces/ExcalidrawAPI';

export enum ExcalidrawAPIEvents {
  SAVE_DIAGRAM = 'excalidraw:saveDiagram',
  LOAD_DIAGRAM = 'excalidraw:loadDiagram',
  LIST_DIAGRAMS = 'excalidraw:listDiagrams',
  DELETE_DIAGRAM = 'excalidraw:deleteDiagram',
  EXPORT_DIAGRAM = 'excalidraw:exportDiagram',
  // Alexandria storage events
  SAVE_ALEXANDRIA_DIAGRAM = 'excalidraw:saveAlexandriaDiagram',
  LOAD_ALEXANDRIA_DIAGRAM = 'excalidraw:loadAlexandriaDiagram',
  LIST_ALEXANDRIA_DIAGRAMS = 'excalidraw:listAlexandriaDiagrams',
  DELETE_ALEXANDRIA_DIAGRAM = 'excalidraw:deleteAlexandriaDiagram',
}

export const excalidrawAPI: ExcalidrawAPI = {
  saveDiagram: (diagram: ExcalidrawDiagram) =>
    ipcRenderer.invoke(ExcalidrawAPIEvents.SAVE_DIAGRAM, diagram),
  loadDiagram: (diagramId: string) =>
    ipcRenderer.invoke(ExcalidrawAPIEvents.LOAD_DIAGRAM, diagramId),
  listDiagrams: (projectPath?: string) =>
    ipcRenderer.invoke(ExcalidrawAPIEvents.LIST_DIAGRAMS, projectPath),
  deleteDiagram: (diagramId: string) =>
    ipcRenderer.invoke(ExcalidrawAPIEvents.DELETE_DIAGRAM, diagramId),
  exportDiagram: (diagramId: string, format: 'png' | 'svg' | 'json') =>
    ipcRenderer.invoke(ExcalidrawAPIEvents.EXPORT_DIAGRAM, diagramId, format),
  // Alexandria storage methods
  saveAlexandriaDiagram: (
    name: string,
    data: ExcalidrawDiagramData,
    repositoryPath: string,
    diagramId?: string,
  ) =>
    ipcRenderer.invoke(
      ExcalidrawAPIEvents.SAVE_ALEXANDRIA_DIAGRAM,
      name,
      data,
      repositoryPath,
      diagramId,
    ),
  loadAlexandriaDiagram: (fileName: string, repositoryPath: string) =>
    ipcRenderer.invoke(
      ExcalidrawAPIEvents.LOAD_ALEXANDRIA_DIAGRAM,
      fileName,
      repositoryPath,
    ),
  listAlexandriaDiagrams: (repositoryPath: string) =>
    ipcRenderer.invoke(
      ExcalidrawAPIEvents.LIST_ALEXANDRIA_DIAGRAMS,
      repositoryPath,
    ),
  deleteAlexandriaDiagram: (fileName: string, repositoryPath: string) =>
    ipcRenderer.invoke(
      ExcalidrawAPIEvents.DELETE_ALEXANDRIA_DIAGRAM,
      fileName,
      repositoryPath,
    ),
};
