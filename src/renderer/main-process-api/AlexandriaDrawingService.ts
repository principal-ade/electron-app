import { ExcalidrawDiagramData } from '../../shared/main-process-api-interfaces/ExcalidrawAPI';
import type { DiagramListItem } from './ExcalidrawStorageService';

/**
 * Service for managing Excalidraw drawings in Alexandria (.alexandria/drawings/)
 * Uses IPC to communicate with main process MemoryPalace instance
 */
export class AlexandriaDrawingService {
  /**
   * Save an Excalidraw diagram to Alexandria storage
   * @param name - Display name for the diagram (stored in metadata)
   * @param data - Excalidraw diagram data
   * @param repositoryPath - Repository path
   * @param diagramId - Optional diagram ID (UUID). If not provided, a new UUID will be generated
   * @returns The diagram ID (UUID)
   */
  static async saveDiagram(
    name: string,
    data: ExcalidrawDiagramData,
    repositoryPath: string,
    diagramId?: string,
  ): Promise<string> {
    try {
      const result = await window.mainProcess.excalidraw.saveAlexandriaDiagram(
        name,
        data,
        repositoryPath,
        diagramId,
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to save diagram');
      }

      // Return the diagram ID (UUID), not the filename
      return (
        result.diagramId || result.fileName?.replace('.excalidraw', '') || name
      );
    } catch (error) {
      console.error('Failed to save diagram to Alexandria:', error);
      throw new Error(
        `Failed to save diagram: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Load an Excalidraw diagram from Alexandria storage
   */
  static async loadDiagram(
    fileName: string,
    repositoryPath: string,
  ): Promise<ExcalidrawDiagramData | null> {
    try {
      const result = await window.mainProcess.excalidraw.loadAlexandriaDiagram(
        fileName,
        repositoryPath,
      );

      if (!result.success) {
        console.error('Failed to load diagram from Alexandria:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('Failed to load diagram from Alexandria:', error);
      return null;
    }
  }

  /**
   * List all Excalidraw diagrams in Alexandria storage
   */
  static async listDiagrams(
    repositoryPath: string,
  ): Promise<DiagramListItem[]> {
    try {
      const result =
        await window.mainProcess.excalidraw.listAlexandriaDiagrams(
          repositoryPath,
        );

      if (!result.success) {
        console.error('Failed to list diagrams from Alexandria:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Failed to list diagrams from Alexandria:', error);
      return [];
    }
  }

  /**
   * Delete an Excalidraw diagram from Alexandria storage
   */
  static async deleteDiagram(
    fileName: string,
    repositoryPath: string,
  ): Promise<boolean> {
    try {
      const result =
        await window.mainProcess.excalidraw.deleteAlexandriaDiagram(
          fileName,
          repositoryPath,
        );

      if (result.success) {
        // Emit deletion event
        const { diagramEventBus, DIAGRAM_EVENTS } = await import(
          '../services/DiagramEventBus'
        );
        const diagramId = fileName.replace('.excalidraw', '');
        diagramEventBus.emit(DIAGRAM_EVENTS.DIAGRAM_DELETED, {
          id: diagramId,
          projectPath: repositoryPath,
        });
      }

      return result.success;
    } catch (error) {
      console.error('Failed to delete diagram from Alexandria:', error);
      return false;
    }
  }

  /**
   * Rename an Excalidraw diagram in Alexandria storage
   * Note: This is currently not implemented via IPC
   */
  static async renameDiagram(
    oldName: string,
    newName: string,
    repositoryPath: string,
  ): Promise<boolean> {
    // This would need to be implemented in the main process handler
    // For now, we can do it by loading, deleting old, and saving new
    try {
      const data = await this.loadDiagram(oldName, repositoryPath);
      if (!data) {
        return false;
      }

      await this.saveDiagram(newName, data, repositoryPath);
      await this.deleteDiagram(oldName, repositoryPath);

      return true;
    } catch (error) {
      console.error('Failed to rename diagram in Alexandria:', error);
      return false;
    }
  }

  /**
   * Check if a diagram exists in Alexandria storage
   */
  static async diagramExists(
    fileName: string,
    repositoryPath: string,
  ): Promise<boolean> {
    try {
      const diagrams = await this.listDiagrams(repositoryPath);
      const nameWithoutExt = fileName.replace('.excalidraw', '');
      return diagrams.some(
        (d) => d.name === nameWithoutExt || d.name === fileName,
      );
    } catch (error) {
      console.error('Failed to check diagram existence in Alexandria:', error);
      return false;
    }
  }
}
