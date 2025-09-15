import { v4 as uuidv4 } from 'uuid';
export class ExcalidrawStorageService {
    static async saveDiagram(name, data, projectPath, diagramId) {
        const id = diagramId || uuidv4();
        const diagram = {
            id,
            name,
            projectPath,
            isRepoAgnostic: !projectPath,
            createdAt: diagramId ? new Date() : new Date(),
            updatedAt: new Date(),
            data: {
                type: 'excalidraw',
                version: 2,
                source: window.appName,
                elements: data.elements || [],
                appState: data.appState || {},
                files: data.files || {},
                libraryItems: data.libraryItems || [],
            },
        };
        const result = await window.mainProcess.excalidraw.saveDiagram(diagram);
        if (!result.success) {
            throw new Error(result.error || 'Failed to save diagram');
        }
        return id;
    }
    static async loadDiagram(diagramId) {
        const result = await window.mainProcess.excalidraw.loadDiagram(diagramId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to load diagram');
        }
        return result.data || null;
    }
    static async listDiagrams(projectPath) {
        const result = await window.mainProcess.excalidraw.listDiagrams(projectPath);
        if (!result.success) {
            throw new Error(result.error || 'Failed to list diagrams');
        }
        return result.data || [];
    }
    static async deleteDiagram(diagramId) {
        const result = await window.mainProcess.excalidraw.deleteDiagram(diagramId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete diagram');
        }
    }
    static async exportDiagram(diagramId, format) {
        const result = await window.mainProcess.excalidraw.exportDiagram(diagramId, format);
        if (!result.success) {
            throw new Error(result.error || 'Failed to export diagram');
        }
        return result.data || null;
    }
    static generateThumbnail(elements, appState) {
        // This would need to be implemented using Excalidraw's export functionality
        // For now, return null
        return null;
    }
    /**
     * Creates a default ExcalidrawDiagramData structure for new diagrams
     */
    static createDefaultDiagramData() {
        return {
            type: 'excalidraw',
            version: 2,
            source: 'PrincipleMD',
            elements: [],
            appState: {},
            files: {},
            libraryItems: []
        };
    }
}
