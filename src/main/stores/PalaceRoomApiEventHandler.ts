/**
 * Main process handler for Palace Room management
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  MemoryPalace,
  NodeFileSystemAdapter,
  PalaceRoom,
  CreatePalaceRoomOptions,
  UpdatePalaceRoomOptions,
  PalacePortal,
  AlexandriaEntry,
  DrawingMetadata,
} from '@a24z/core-library';
import type {
  PalaceRoomAPI,
  PalaceRoomWithRepository,
  CreatePortalOptions,
} from '../../shared/main-process-api-interfaces/PalaceRoomAPI';
import { PalaceRoomAPIEvent } from '../../shared/main-process-api-interfaces/PalaceRoomAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';

export class PalaceRoomApiEventHandler implements PalaceRoomAPI {
  private memoryPalaces: Map<string, MemoryPalace> = new Map();
  private registryService: AlexandriaRegistryService;

  constructor() {
    this.registryService = AlexandriaRegistryService.getInstance();
  }

  /**
   * Get or create a MemoryPalace instance for a repository
   */
  private getMemoryPalace(repositoryPath: string): MemoryPalace {
    if (!this.memoryPalaces.has(repositoryPath)) {
      const fs = new NodeFileSystemAdapter();
      const palace = new MemoryPalace(repositoryPath, fs);
      this.memoryPalaces.set(repositoryPath, palace);
    }
    return this.memoryPalaces.get(repositoryPath)!;
  }

  /**
   * Broadcast Palace Room events to all windows
   */
  private broadcastPalaceRoomEvent(
    eventType: PalaceRoomAPIEvent,
    data: any
  ): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(eventType, data);
      }
    });
  }

  async listAllPalaceRooms(): Promise<PalaceRoomWithRepository[]> {
    const repositories = await this.registryService.getRepositories();
    const results: PalaceRoomWithRepository[] = [];

    for (const repo of repositories) {
      try {
        const palace = this.getMemoryPalace(repo.path);
        const rooms = palace.listPalaceRooms();
        results.push({ repository: repo, rooms });
      } catch (error) {
        console.error(`Failed to load palace rooms from ${repo.name}:`, error);
      }
    }

    return results;
  }

  async listPalaceRooms(repositoryPath: string): Promise<PalaceRoom[]> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      return palace.listPalaceRooms();
    } catch (error) {
      console.error(`Failed to list palace rooms from ${repositoryPath}:`, error);
      return [];
    }
  }

  async getPalaceRoom(repositoryPath: string, roomId: string): Promise<PalaceRoom | null> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      return palace.getPalaceRoom(roomId);
    } catch (error) {
      console.error(`Failed to get palace room ${roomId}:`, error);
      return null;
    }
  }

  async createPalaceRoom(
    repositoryPath: string,
    options: CreatePalaceRoomOptions
  ): Promise<PalaceRoom | null> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      const result = palace.createPalaceRoom(options);

      if (result.success && result.palaceRoom) {
        this.broadcastPalaceRoomEvent(PalaceRoomAPIEvent.ROOM_CREATED, {
          repositoryPath,
          room: result.palaceRoom,
        });
        return result.palaceRoom;
      } else {
        console.error(`Failed to create palace room: ${result.error}`);
        return null;
      }
    } catch (error) {
      console.error(`Failed to create palace room:`, error);
      return null;
    }
  }

  async updatePalaceRoom(
    repositoryPath: string,
    roomId: string,
    options: UpdatePalaceRoomOptions
  ): Promise<PalaceRoom | null> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      const result = palace.updatePalaceRoom(roomId, options);

      if (result.success && result.palaceRoom) {
        this.broadcastPalaceRoomEvent(PalaceRoomAPIEvent.ROOM_UPDATED, {
          repositoryPath,
          room: result.palaceRoom,
        });
        return result.palaceRoom;
      } else {
        console.error(`Failed to update palace room: ${result.error}`);
        return null;
      }
    } catch (error) {
      console.error(`Failed to update palace room:`, error);
      return null;
    }
  }

  async deletePalaceRoom(repositoryPath: string, roomId: string): Promise<boolean> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      const success = palace.deletePalaceRoom(roomId);

      if (success) {
        this.broadcastPalaceRoomEvent(PalaceRoomAPIEvent.ROOM_DELETED, {
          repositoryPath,
          roomId,
        });
      }

      return success;
    } catch (error) {
      console.error(`Failed to delete palace room:`, error);
      return false;
    }
  }


  async addPortalToRoom(
    repositoryPath: string,
    roomId: string,
    options: CreatePortalOptions
  ): Promise<PalacePortal | null> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);

      const portalOptions = {
        name: options.portalName,
        description: options.description || `Portal to ${options.targetRepositoryPath}`,
        target: {
          type: 'local' as const,
          path: options.targetRepositoryPath,
        },
        displayMode: 'linked' as const,
        syncStrategy: 'on-demand' as const,
        referenceType: 'full' as const,
      };

      const portal = palace.addPortalToRoom(roomId, portalOptions);

      if (portal) {
        this.broadcastPalaceRoomEvent(PalaceRoomAPIEvent.ROOM_UPDATED, {
          repositoryPath,
          roomId,
        });
      }

      return portal;
    } catch (error) {
      console.error(`Failed to add portal:`, error);
      return null;
    }
  }

  async removePortalFromRoom(
    repositoryPath: string,
    roomId: string,
    portalId: string
  ): Promise<boolean> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      const success = palace.removePortalFromRoom(roomId, portalId);

      if (success) {
        this.broadcastPalaceRoomEvent(PalaceRoomAPIEvent.ROOM_UPDATED, {
          repositoryPath,
          roomId,
        });
      }

      return success;
    } catch (error) {
      console.error(`Failed to remove portal:`, error);
      return false;
    }
  }

  async listPortalsInRoom(repositoryPath: string, roomId: string): Promise<PalacePortal[]> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      return palace.listPortalsInRoom(roomId);
    } catch (error) {
      console.error(`Failed to list portals:`, error);
      return [];
    }
  }

  async getAvailablePortalTargets(currentRepositoryPath: string): Promise<AlexandriaEntry[]> {
    const repositories = await this.registryService.getRepositories();
    return repositories.filter(repo => repo.path !== currentRepositoryPath);
  }

  // Drawing management methods

  async addDrawingToRoom(
    repositoryPath: string,
    roomId: string,
    drawingName: string
  ): Promise<boolean> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      palace.addDrawingToPalaceRoom(roomId, drawingName);

      this.broadcastPalaceRoomEvent(PalaceRoomAPIEvent.ROOM_UPDATED, {
        repositoryPath,
        roomId,
      });

      return true;
    } catch (error) {
      console.error('Failed to add drawing to room:', error);
      return false;
    }
  }

  async removeDrawingFromRoom(
    repositoryPath: string,
    roomId: string,
    drawingName: string
  ): Promise<boolean> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      palace.removeDrawingFromPalaceRoom(roomId, drawingName);

      this.broadcastPalaceRoomEvent(PalaceRoomAPIEvent.ROOM_UPDATED, {
        repositoryPath,
        roomId,
      });

      return true;
    } catch (error) {
      console.error('Failed to remove drawing from room:', error);
      return false;
    }
  }

  async listRoomDrawings(
    repositoryPath: string,
    roomId: string
  ): Promise<DrawingMetadata[]> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);

      // Get the room to access its drawingIds
      const room = palace.getPalaceRoom(roomId);
      if (!room || !room.drawingIds || room.drawingIds.length === 0) {
        return [];
      }

      // Get all drawings with metadata
      const allDrawings = palace.listDrawingsWithMetadata() || [];

      // Filter to only include drawings that belong to this room
      const roomDrawings = allDrawings.filter((drawing) =>
        room.drawingIds.includes(drawing.name)
      );

      return roomDrawings;
    } catch (error) {
      console.error('Failed to list room drawings:', error);
      return [];
    }
  }

  async saveRoomDrawing(
    repositoryPath: string,
    roomId: string,
    drawingName: string,
    content: string
  ): Promise<boolean> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);

      // Save the drawing
      palace.saveDrawing(drawingName, content);

      // Associate with room
      palace.addDrawingToPalaceRoom(roomId, drawingName);

      this.broadcastPalaceRoomEvent(PalaceRoomAPIEvent.ROOM_UPDATED, {
        repositoryPath,
        roomId,
      });

      return true;
    } catch (error) {
      console.error('Failed to save room drawing:', error);
      return false;
    }
  }

  async loadDrawing(
    repositoryPath: string,
    drawingName: string
  ): Promise<string | null> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      return palace.loadDrawing(drawingName);
    } catch (error) {
      console.error('Failed to load drawing:', error);
      return null;
    }
  }

  async deleteDrawing(
    repositoryPath: string,
    drawingName: string
  ): Promise<boolean> {
    try {
      const palace = this.getMemoryPalace(repositoryPath);
      return palace.deleteDrawing(drawingName);
    } catch (error) {
      console.error('Failed to delete drawing:', error);
      return false;
    }
  }

  /**
   * Clean up handlers when shutting down
   */
  destroy(): void {
    // Remove all handlers
    ipcMain.removeHandler(PalaceRoomAPIEvent.LIST_ALL_ROOMS);
    ipcMain.removeHandler(PalaceRoomAPIEvent.LIST_ROOMS);
    ipcMain.removeHandler(PalaceRoomAPIEvent.GET_ROOM);
    ipcMain.removeHandler(PalaceRoomAPIEvent.CREATE_ROOM);
    ipcMain.removeHandler(PalaceRoomAPIEvent.UPDATE_ROOM);
    ipcMain.removeHandler(PalaceRoomAPIEvent.DELETE_ROOM);
    ipcMain.removeHandler(PalaceRoomAPIEvent.ADD_PORTAL);
    ipcMain.removeHandler(PalaceRoomAPIEvent.REMOVE_PORTAL);
    ipcMain.removeHandler(PalaceRoomAPIEvent.LIST_PORTALS);
    ipcMain.removeHandler(PalaceRoomAPIEvent.GET_AVAILABLE_TARGETS);
    ipcMain.removeHandler(PalaceRoomAPIEvent.ADD_DRAWING_TO_ROOM);
    ipcMain.removeHandler(PalaceRoomAPIEvent.REMOVE_DRAWING_FROM_ROOM);
    ipcMain.removeHandler(PalaceRoomAPIEvent.LIST_ROOM_DRAWINGS);
    ipcMain.removeHandler(PalaceRoomAPIEvent.SAVE_ROOM_DRAWING);
    ipcMain.removeHandler(PalaceRoomAPIEvent.LOAD_DRAWING);
    ipcMain.removeHandler(PalaceRoomAPIEvent.DELETE_DRAWING);
  }
}

/**
 * Register Palace Room IPC handlers
 */
export function registerPalaceRoomHandlers(): void {
  const handler = new PalaceRoomApiEventHandler();

  // Register all IPC handlers
  ipcMain.handle(PalaceRoomAPIEvent.LIST_ALL_ROOMS, () =>
    handler.listAllPalaceRooms()
  );
  ipcMain.handle(PalaceRoomAPIEvent.LIST_ROOMS, (_, repositoryPath: string) =>
    handler.listPalaceRooms(repositoryPath)
  );
  ipcMain.handle(PalaceRoomAPIEvent.GET_ROOM, (_, repositoryPath: string, roomId: string) =>
    handler.getPalaceRoom(repositoryPath, roomId)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.CREATE_ROOM,
    (_, repositoryPath: string, options: CreatePalaceRoomOptions) =>
      handler.createPalaceRoom(repositoryPath, options)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.UPDATE_ROOM,
    (_, repositoryPath: string, roomId: string, options: UpdatePalaceRoomOptions) =>
      handler.updatePalaceRoom(repositoryPath, roomId, options)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.DELETE_ROOM,
    (_, repositoryPath: string, roomId: string) =>
      handler.deletePalaceRoom(repositoryPath, roomId)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.ADD_PORTAL,
    (_, repositoryPath: string, roomId: string, options: CreatePortalOptions) =>
      handler.addPortalToRoom(repositoryPath, roomId, options)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.REMOVE_PORTAL,
    (_, repositoryPath: string, roomId: string, portalId: string) =>
      handler.removePortalFromRoom(repositoryPath, roomId, portalId)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.LIST_PORTALS,
    (_, repositoryPath: string, roomId: string) =>
      handler.listPortalsInRoom(repositoryPath, roomId)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.GET_AVAILABLE_TARGETS,
    (_, currentRepositoryPath: string) =>
      handler.getAvailablePortalTargets(currentRepositoryPath)
  );

  // Register drawing handlers
  ipcMain.handle(
    PalaceRoomAPIEvent.ADD_DRAWING_TO_ROOM,
    (_, repositoryPath: string, roomId: string, drawingName: string) =>
      handler.addDrawingToRoom(repositoryPath, roomId, drawingName)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.REMOVE_DRAWING_FROM_ROOM,
    (_, repositoryPath: string, roomId: string, drawingName: string) =>
      handler.removeDrawingFromRoom(repositoryPath, roomId, drawingName)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.LIST_ROOM_DRAWINGS,
    (_, repositoryPath: string, roomId: string) =>
      handler.listRoomDrawings(repositoryPath, roomId)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.SAVE_ROOM_DRAWING,
    (_, repositoryPath: string, roomId: string, drawingName: string, content: string) =>
      handler.saveRoomDrawing(repositoryPath, roomId, drawingName, content)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.LOAD_DRAWING,
    (_, repositoryPath: string, drawingName: string) =>
      handler.loadDrawing(repositoryPath, drawingName)
  );
  ipcMain.handle(
    PalaceRoomAPIEvent.DELETE_DRAWING,
    (_, repositoryPath: string, drawingName: string) =>
      handler.deleteDrawing(repositoryPath, drawingName)
  );

  console.log('[PalaceRoom] IPC handlers registered');
}