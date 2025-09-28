import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { MemoryPalace, NodeFileSystemAdapter } from '@a24z/core-library';
import type { ExcalidrawData, RoomDrawingMetadata } from '@a24z/core-library';
import { RoomDrawingAPIEvents } from '../../window/main-process-api-implementations/roomDrawingApi';

/**
 * Simplified drawing handlers using MemoryPalace's room-aware drawing methods
 */
class RoomDrawingHandlers {
  private memoryInstances: Map<string, MemoryPalace> = new Map();
  private fs = new NodeFileSystemAdapter();

  private getMemoryInstance(repositoryPath: string): MemoryPalace | null {
    try {
      if (!this.memoryInstances.has(repositoryPath)) {
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
      console.error('[RoomDrawingHandlers] Failed to get MemoryPalace instance:', error);
      return null;
    }
  }

  async saveRoomDrawing(
    event: IpcMainInvokeEvent,
    repositoryPath: string,
    roomId: string,
    drawingName: string,
    drawingData: ExcalidrawData
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return { success: false, error: 'Failed to initialize MemoryPalace' };
      }

      const drawingId = memory.saveRoomDrawing(roomId, drawingName, drawingData);
      if (!drawingId) {
        return { success: false, error: 'Failed to save drawing' };
      }

      return { success: true, drawingId };
    } catch (error) {
      console.error('[RoomDrawingHandlers] Failed to save room drawing:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async updateRoomDrawing(
    event: IpcMainInvokeEvent,
    repositoryPath: string,
    roomId: string,
    drawingId: string,
    drawingName: string,
    drawingData: ExcalidrawData
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return { success: false, error: 'Failed to initialize MemoryPalace' };
      }

      // Update the drawing content using the new method
      const success = memory.updateRoomDrawingContent(roomId, drawingId, drawingData);

      if (!success) {
        return { success: false, error: 'Failed to update drawing content' };
      }

      // If the name has changed, update it separately
      if (drawingName) {
        memory.updateDrawingName(drawingId, drawingName);
      }

      return { success: true, drawingId };
    } catch (error) {
      console.error('[RoomDrawingHandlers] Failed to update room drawing:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async loadRoomDrawing(
    event: IpcMainInvokeEvent,
    repositoryPath: string,
    roomId: string,
    drawingId: string
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return { success: false, error: 'Failed to initialize MemoryPalace' };
      }

      const drawingData = memory.loadRoomDrawing(roomId, drawingId);
      if (!drawingData) {
        return { success: false, error: 'Drawing not found' };
      }

      return { success: true, data: drawingData };
    } catch (error) {
      console.error('[RoomDrawingHandlers] Failed to load room drawing:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async listRoomDrawings(
    event: IpcMainInvokeEvent,
    repositoryPath: string,
    roomId: string
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return { success: false, error: 'Failed to initialize MemoryPalace' };
      }

      const drawings = memory.listRoomDrawings(roomId);
      return { success: true, data: drawings };
    } catch (error) {
      console.error('[RoomDrawingHandlers] Failed to list room drawings:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async updateDrawingName(
    event: IpcMainInvokeEvent,
    repositoryPath: string,
    drawingId: string,
    newName: string
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return { success: false, error: 'Failed to initialize MemoryPalace' };
      }

      const success = memory.updateDrawingName(drawingId, newName);
      return { success };
    } catch (error) {
      console.error('[RoomDrawingHandlers] Failed to update drawing name:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async unlinkDrawingFromRoom(
    event: IpcMainInvokeEvent,
    repositoryPath: string,
    roomId: string,
    drawingId: string
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return { success: false, error: 'Failed to initialize MemoryPalace' };
      }

      const success = memory.unlinkDrawingFromRoom(roomId, drawingId);
      return { success };
    } catch (error) {
      console.error('[RoomDrawingHandlers] Failed to unlink drawing:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async deleteDrawing(
    event: IpcMainInvokeEvent,
    repositoryPath: string,
    drawingId: string
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return { success: false, error: 'Failed to initialize MemoryPalace' };
      }

      const success = memory.deleteDrawingCompletely(drawingId);
      return { success };
    } catch (error) {
      console.error('[RoomDrawingHandlers] Failed to delete drawing:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async listAllDrawings(
    event: IpcMainInvokeEvent,
    repositoryPath: string
  ) {
    try {
      const memory = this.getMemoryInstance(repositoryPath);
      if (!memory) {
        return { success: false, error: 'Failed to initialize MemoryPalace' };
      }

      const drawings = memory.listAllDrawings();
      return { success: true, data: drawings };
    } catch (error) {
      console.error('[RoomDrawingHandlers] Failed to list all drawings:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  registerHandlers() {
    ipcMain.handle(RoomDrawingAPIEvents.SAVE_ROOM_DRAWING, this.saveRoomDrawing.bind(this));
    ipcMain.handle(RoomDrawingAPIEvents.UPDATE_ROOM_DRAWING, this.updateRoomDrawing.bind(this));
    ipcMain.handle(RoomDrawingAPIEvents.LOAD_ROOM_DRAWING, this.loadRoomDrawing.bind(this));
    ipcMain.handle(RoomDrawingAPIEvents.LIST_ROOM_DRAWINGS, this.listRoomDrawings.bind(this));
    ipcMain.handle(RoomDrawingAPIEvents.UPDATE_DRAWING_NAME, this.updateDrawingName.bind(this));
    ipcMain.handle(RoomDrawingAPIEvents.UNLINK_DRAWING_FROM_ROOM, this.unlinkDrawingFromRoom.bind(this));
    ipcMain.handle(RoomDrawingAPIEvents.DELETE_DRAWING, this.deleteDrawing.bind(this));
    ipcMain.handle(RoomDrawingAPIEvents.LIST_ALL_DRAWINGS, this.listAllDrawings.bind(this));
  }
}

export const roomDrawingHandlers = new RoomDrawingHandlers();