import { ipcMain, app, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { ExcalidrawAPIEvents } from '../../window/main-process-api-implementations/excalidrawApi';
import {
  ExcalidrawDiagram,
  ExcalidrawDiagramData,
} from '../../shared/main-process-api-interfaces/ExcalidrawAPI';
import { MemoryPalace, NodeFileSystemAdapter } from '@a24z/core-library';

class ExcalidrawHandlers {
  private storageDir: string;

  private indexPath: string;

  private index: Map<string, any>;

  private memoryInstances: Map<string, MemoryPalace> = new Map();
  private fs = new NodeFileSystemAdapter();

  constructor() {
    this.storageDir = path.join(app.getPath('userData'), 'excalidraw-files');
    this.indexPath = path.join(this.storageDir, 'index.json');
    this.index = new Map();
    this.initialize().catch((error) => {
      console.error('Failed to initialize ExcalidrawHandlers:', error);
    });
  }

  private async initialize() {
    // Create storage directory if it doesn't exist
    await fs.ensureDir(this.storageDir);

    // Load existing index
    await this.loadIndex();
  }

  private async loadIndex() {
    try {
      if (await fs.pathExists(this.indexPath)) {
        try {
          const data = await fs.readJson(this.indexPath);
          this.index = new Map(Object.entries(data.diagrams || {}));
        } catch (parseError) {
          console.error(
            'Failed to parse index.json, creating backup and starting fresh:',
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
          );

          // Backup the corrupted file
          const backupPath = `${this.indexPath}.backup.${Date.now()}`;
          try {
            await fs.copy(this.indexPath, backupPath);
            console.log(`Backed up corrupted index to: ${backupPath}`);
          } catch (backupError) {
            console.error('Failed to backup corrupted index:', backupError);
          }

          // Start with a fresh index
          this.index = new Map();

          // Try to recover by scanning the directory for existing diagrams
          await this.recoverIndexFromFiles();
        }
      } else {
        this.index = new Map();
      }
    } catch (error) {
      console.error('Failed to load index:', error);
      this.index = new Map();
    }
  }

  private async recoverIndexFromFiles() {
    try {
      console.log('Attempting to recover index from existing diagram files...');

      // Check repo-agnostic directory
      const repoAgnosticDir = path.join(this.storageDir, 'repo-agnostic');
      if (await fs.pathExists(repoAgnosticDir)) {
        const files = await fs.readdir(repoAgnosticDir);
        for (const file of files) {
          if (file.endsWith('.excalidraw')) {
            try {
              const filePath = path.join(repoAgnosticDir, file);
              const data = await fs.readJson(filePath);
              const id = file.replace('.excalidraw', '');

              this.index.set(id, {
                id,
                name: data.name || 'Recovered Diagram',
                isRepoAgnostic: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              console.log(`Recovered diagram: ${id}`);
            } catch (err) {
              console.error(`Failed to recover ${file}:`, err);
            }
          }
        }
      }

      // Check project-specific directories
      const dirs = await fs.readdir(this.storageDir);
      for (const dir of dirs) {
        if (dir !== 'repo-agnostic' && !dir.startsWith('index.json')) {
          const projectDir = path.join(this.storageDir, dir);
          try {
            const stat = await fs.stat(projectDir);

            if (stat.isDirectory()) {
              const files = await fs.readdir(projectDir);
              for (const file of files) {
                if (file.endsWith('.excalidraw')) {
                  try {
                    const filePath = path.join(projectDir, file);
                    const data = await fs.readJson(filePath);
                    const id = file.replace('.excalidraw', '');

                    this.index.set(id, {
                      id,
                      name: data.name || 'Recovered Diagram',
                      isRepoAgnostic: false,
                      projectHash: dir,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });

                    console.log(`Recovered project diagram: ${id}`);
                  } catch (err) {
                    console.error(`Failed to recover ${file}:`, err);
                  }
                }
              }
            }
          } catch {
            // Skip non-directories or inaccessible paths
          }
        }
      }

      // Save the recovered index
      if (this.index.size > 0) {
        await this.saveIndex();
        console.log(`Recovered ${this.index.size} diagrams`);
      }
    } catch (error) {
      console.error('Failed to recover index from files:', error);
    }
  }

  private async saveIndex() {
    try {
      const indexData = {
        version: 1,
        diagrams: Object.fromEntries(this.index),
      };
      await fs.writeJson(this.indexPath, indexData, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save index:', error);
    }
  }

  private getProjectHash(projectPath: string): string {
    return crypto.createHash('md5').update(projectPath).digest('hex');
  }

  private getDiagramPath(diagram: ExcalidrawDiagram): string {
    if (diagram.isRepoAgnostic) {
      return path.join(
        this.storageDir,
        'repo-agnostic',
        `${diagram.id}.excalidraw`,
      );
    }
    if (diagram.projectPath) {
      const projectHash = this.getProjectHash(diagram.projectPath);
      return path.join(
        this.storageDir,
        projectHash,
        `${diagram.id}.excalidraw`,
      );
    }
    throw new Error('Invalid diagram configuration');
  }

  async saveDiagram(event: IpcMainInvokeEvent, diagram: ExcalidrawDiagram) {
    try {
      const filePath = this.getDiagramPath(diagram);
      await fs.ensureDir(path.dirname(filePath));

      // Save the diagram file
      await fs.writeJson(filePath, diagram, { spaces: 2 });

      // Update index with serializable data
      this.index.set(diagram.id, {
        id: diagram.id,
        name: diagram.name,
        projectPath: diagram.projectPath,
        isRepoAgnostic: diagram.isRepoAgnostic,
        createdAt:
          diagram.createdAt instanceof Date
            ? diagram.createdAt.toISOString()
            : diagram.createdAt,
        updatedAt:
          diagram.updatedAt instanceof Date
            ? diagram.updatedAt.toISOString()
            : diagram.updatedAt,
        filePath,
      });

      await this.saveIndex();

      return { success: true };
    } catch (error) {
      console.error('Failed to save diagram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async loadDiagram(event: IpcMainInvokeEvent, diagramId: string) {
    try {
      const indexEntry = this.index.get(diagramId);
      if (!indexEntry) {
        return { success: false, error: 'Diagram not found' };
      }

      const diagram = await fs.readJson(indexEntry.filePath);
      return { success: true, data: diagram };
    } catch (error) {
      console.error('Failed to load diagram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listDiagrams(event: IpcMainInvokeEvent, projectPath?: string) {
    try {
      const diagrams = [];

      for (const [_id, entry] of Array.from(this.index)) {
        // If projectPath is provided, only include diagrams from that project or repo-agnostic ones
        if (projectPath) {
          if (entry.projectPath !== projectPath && !entry.isRepoAgnostic) {
            continue;
          }
        }

        diagrams.push({
          id: entry.id,
          name: entry.name,
          projectPath: entry.projectPath,
          isRepoAgnostic: entry.isRepoAgnostic,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        });
      }

      return { success: true, data: diagrams };
    } catch (error) {
      console.error('Failed to list diagrams:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteDiagram(event: IpcMainInvokeEvent, diagramId: string) {
    try {
      const indexEntry = this.index.get(diagramId);
      if (!indexEntry) {
        return { success: false, error: 'Diagram not found' };
      }

      // Delete the file
      await fs.remove(indexEntry.filePath);

      // Remove from index
      this.index.delete(diagramId);
      await this.saveIndex();

      return { success: true };
    } catch (error) {
      console.error('Failed to delete diagram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async exportDiagram(
    event: IpcMainInvokeEvent,
    diagramId: string,
    format: 'png' | 'svg' | 'json',
  ) {
    try {
      const diagram = await this.loadDiagram(event, diagramId);
      if (!diagram.success) {
        return diagram;
      }

      // For JSON export, return the diagram data as-is
      if (format === 'json') {
        return { success: true, data: diagram.data };
      }

      // For PNG/SVG export, we would need to use Excalidraw's export functionality
      // This would typically be done on the renderer side
      return {
        success: false,
        error: 'PNG/SVG export should be handled on the renderer side',
      };
    } catch (error) {
      console.error('Failed to export diagram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Alexandria/MemoryPalace methods
  private getMemoryInstance(repositoryPath: string): MemoryPalace | null {
    try {
      // Cache MemoryPalace instances per repository
      if (!this.memoryInstances.has(repositoryPath)) {
        // Validate the repository path first
        const validatedPath = MemoryPalace.validateRepositoryPath(
          this.fs,
          repositoryPath,
        );
        this.memoryInstances.set(
          repositoryPath,
          new MemoryPalace(validatedPath, this.fs),
        );
      }
      return this.memoryInstances.get(repositoryPath) || null;
    } catch (error) {
      console.error(
        '[ExcalidrawHandlers] Failed to get MemoryPalace instance:',
        error,
      );
      return null;
    }
  }

  async saveAlexandriaDiagram(
    event: IpcMainInvokeEvent,
    name: string,
    data: ExcalidrawDiagramData,
    repositoryPath: string,
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return {
          success: false,
          error: 'Failed to initialize Alexandria storage',
        };
      }

      // Ensure name has .excalidraw extension
      const fileName = name.endsWith('.excalidraw')
        ? name
        : `${name}.excalidraw`;

      // Save the drawing using MemoryPalace public method
      memory.saveDrawing(fileName, JSON.stringify(data, null, 2));

      return { success: true, fileName };
    } catch (error) {
      console.error(
        '[ExcalidrawHandlers] Failed to save Alexandria diagram:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async loadAlexandriaDiagram(
    event: IpcMainInvokeEvent,
    fileName: string,
    repositoryPath: string,
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return {
          success: false,
          error: 'Failed to initialize Alexandria storage',
        };
      }

      // Load the drawing using MemoryPalace public method
      const content = memory.loadDrawing(fileName);

      if (!content) {
        return { success: false, error: 'Diagram not found in Alexandria' };
      }

      // Parse and return the data
      const data = JSON.parse(content);
      return { success: true, data };
    } catch (error) {
      console.error(
        '[ExcalidrawHandlers] Failed to load Alexandria diagram:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listAlexandriaDiagrams(
    event: IpcMainInvokeEvent,
    repositoryPath: string,
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return {
          success: false,
          error: 'Failed to initialize Alexandria storage',
        };
      }

      // List drawings with metadata using MemoryPalace public method
      const drawings = memory.listDrawingsWithMetadata();

      // Convert to the expected format, loading each drawing to get its actual name
      const diagrams = [];
      for (const drawing of drawings.filter(
        (d) => d.format === 'excalidraw' || d.name.endsWith('.excalidraw'),
      )) {
        try {
          // Load the drawing content to get the name from appState
          const content = memory.loadDrawing(drawing.name);
          let displayName = drawing.name.replace('.excalidraw', ''); // fallback to filename

          if (content) {
            try {
              const data = JSON.parse(content);
              // Use the name from appState if available
              if (data.appState && data.appState.name) {
                displayName = data.appState.name;
              }
            } catch (parseErr) {
              console.warn(
                `Failed to parse drawing ${drawing.name}:`,
                parseErr,
              );
            }
          }

          diagrams.push({
            id: drawing.id,
            name: displayName,
            projectPath: repositoryPath,
            isRepoAgnostic: false,
            createdAt: new Date(drawing.created),
            updatedAt: new Date(drawing.modified),
          });
        } catch (err) {
          console.error(`Failed to process drawing ${drawing.name}:`, err);
        }
      }

      return { success: true, data: diagrams };
    } catch (error) {
      console.error(
        '[ExcalidrawHandlers] Failed to list Alexandria diagrams:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async deleteAlexandriaDiagram(
    event: IpcMainInvokeEvent,
    fileName: string,
    repositoryPath: string,
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return {
          success: false,
          error: 'Failed to initialize Alexandria storage',
        };
      }

      // Delete the drawing using MemoryPalace public method
      const success = memory.deleteDrawing(fileName);

      return { success };
    } catch (error) {
      console.error(
        '[ExcalidrawHandlers] Failed to delete Alexandria diagram:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  registerHandlers() {
    // Existing app-data handlers
    ipcMain.handle(
      ExcalidrawAPIEvents.SAVE_DIAGRAM,
      this.saveDiagram.bind(this),
    );
    ipcMain.handle(
      ExcalidrawAPIEvents.LOAD_DIAGRAM,
      this.loadDiagram.bind(this),
    );
    ipcMain.handle(
      ExcalidrawAPIEvents.LIST_DIAGRAMS,
      this.listDiagrams.bind(this),
    );
    ipcMain.handle(
      ExcalidrawAPIEvents.DELETE_DIAGRAM,
      this.deleteDiagram.bind(this),
    );
    ipcMain.handle(
      ExcalidrawAPIEvents.EXPORT_DIAGRAM,
      this.exportDiagram.bind(this),
    );

    // New Alexandria handlers
    ipcMain.handle(
      ExcalidrawAPIEvents.SAVE_ALEXANDRIA_DIAGRAM,
      this.saveAlexandriaDiagram.bind(this),
    );
    ipcMain.handle(
      ExcalidrawAPIEvents.LOAD_ALEXANDRIA_DIAGRAM,
      this.loadAlexandriaDiagram.bind(this),
    );
    ipcMain.handle(
      ExcalidrawAPIEvents.LIST_ALEXANDRIA_DIAGRAMS,
      this.listAlexandriaDiagrams.bind(this),
    );
    ipcMain.handle(
      ExcalidrawAPIEvents.DELETE_ALEXANDRIA_DIAGRAM,
      this.deleteAlexandriaDiagram.bind(this),
    );
  }
}

export const excalidrawHandlers = new ExcalidrawHandlers();
