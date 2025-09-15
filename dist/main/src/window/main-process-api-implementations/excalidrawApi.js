import { ipcRenderer } from 'electron';
export var ExcalidrawAPIEvents;
(function (ExcalidrawAPIEvents) {
    ExcalidrawAPIEvents["SAVE_DIAGRAM"] = "excalidraw:saveDiagram";
    ExcalidrawAPIEvents["LOAD_DIAGRAM"] = "excalidraw:loadDiagram";
    ExcalidrawAPIEvents["LIST_DIAGRAMS"] = "excalidraw:listDiagrams";
    ExcalidrawAPIEvents["DELETE_DIAGRAM"] = "excalidraw:deleteDiagram";
    ExcalidrawAPIEvents["EXPORT_DIAGRAM"] = "excalidraw:exportDiagram";
})(ExcalidrawAPIEvents || (ExcalidrawAPIEvents = {}));
export const excalidrawAPI = {
    saveDiagram: (diagram) => ipcRenderer.invoke(ExcalidrawAPIEvents.SAVE_DIAGRAM, diagram),
    loadDiagram: (diagramId) => ipcRenderer.invoke(ExcalidrawAPIEvents.LOAD_DIAGRAM, diagramId),
    listDiagrams: (projectPath) => ipcRenderer.invoke(ExcalidrawAPIEvents.LIST_DIAGRAMS, projectPath),
    deleteDiagram: (diagramId) => ipcRenderer.invoke(ExcalidrawAPIEvents.DELETE_DIAGRAM, diagramId),
    exportDiagram: (diagramId, format) => ipcRenderer.invoke(ExcalidrawAPIEvents.EXPORT_DIAGRAM, diagramId, format),
};
