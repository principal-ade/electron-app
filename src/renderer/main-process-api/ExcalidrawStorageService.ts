import { v4 as uuidv4 } from 'uuid';
import { AppState as ExcalidrawAppState } from "@excalidraw/excalidraw/types";

import { ExcalidrawDiagram, ExcalidrawDiagramData } from '../../shared/main-process-api-interfaces/ExcalidrawAPI';

export interface DiagramListItem {
  id: string;
  name: string;
  projectPath?: string;
  isRepoAgnostic: boolean;
  createdAt: Date;
  updatedAt: Date;
  thumbnail?: string;
}

export class ExcalidrawStorageService {
  static async saveDiagram(
    name: string,
    data: ExcalidrawDiagramData,
    projectPath?: string,
    diagramId?: string,
  ): Promise<string> {
    const id = diagramId || uuidv4();
    const diagram: ExcalidrawDiagram = {
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

  static async loadDiagram(diagramId: string): Promise<ExcalidrawDiagram | null> {
    const result = await window.mainProcess.excalidraw.loadDiagram(diagramId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to load diagram');
    }

    return result.data || null;
  }

  static async listDiagrams(projectPath?: string): Promise<DiagramListItem[]> {
    const result = await window.mainProcess.excalidraw.listDiagrams(projectPath);
    if (!result.success) {
      throw new Error(result.error || 'Failed to list diagrams');
    }

    return result.data || [];
  }

  static async deleteDiagram(diagramId: string): Promise<void> {
    const result = await window.mainProcess.excalidraw.deleteDiagram(diagramId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete diagram');
    }
  }

  static async exportDiagram(
    diagramId: string,
    format: 'png' | 'svg' | 'json',
  ): Promise<Blob | null> {
    const result = await window.mainProcess.excalidraw.exportDiagram(diagramId, format);
    if (!result.success) {
      throw new Error(result.error || 'Failed to export diagram');
    }

    return result.data || null;
  }

  static generateThumbnail(elements: any[], appState: any): string | null {
    // This would need to be implemented using Excalidraw's export functionality
    // For now, return null
    return null;
  }

  /**
   * Creates a default ExcalidrawDiagramData structure for new diagrams
   */
  static createDefaultDiagramData(): ExcalidrawDiagramData {
    return {
      type: 'excalidraw',
      version: 2,
      source: 'PrincipleMD',
      elements: [],
      appState: {} as ExcalidrawAppState,
      files: {},
      libraryItems: []
    };
  }
}

