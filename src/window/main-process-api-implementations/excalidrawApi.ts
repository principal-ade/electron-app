import { ipcRenderer } from 'electron';
import type { ExcalidrawAPI, ExcalidrawDiagram   } from '../../shared/main-process-api-interfaces/ExcalidrawAPI';

export enum ExcalidrawAPIEvents {
  SAVE_DIAGRAM = 'excalidraw:saveDiagram',
  LOAD_DIAGRAM = 'excalidraw:loadDiagram',
  LIST_DIAGRAMS = 'excalidraw:listDiagrams',
  DELETE_DIAGRAM = 'excalidraw:deleteDiagram',
  EXPORT_DIAGRAM = 'excalidraw:exportDiagram',
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
};
