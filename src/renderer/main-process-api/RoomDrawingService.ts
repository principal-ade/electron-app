import type { ExcalidrawData, RoomDrawingMetadata } from '@a24z/core-library';

/**
 * Service for managing room-aware Excalidraw drawings using the new MemoryPalace APIs
 */
export class RoomDrawingService {
  /**
   * Save a drawing and associate it with a room
   */
  static async saveRoomDrawing(
    repositoryPath: string,
    roomId: string,
    drawingName: string,
    drawingData: ExcalidrawData
  ): Promise<string | null> {
    try {
      const result = await window.mainProcess.roomDrawing.saveRoomDrawing(
        repositoryPath,
        roomId,
        drawingName,
        drawingData
      );

      if (!result.success) {
        console.error('Failed to save room drawing:', result.error);
        return null;
      }

      return result.drawingId;
    } catch (error) {
      console.error('Failed to save room drawing:', error);
      return null;
    }
  }

  /**
   * Update an existing room drawing
   */
  static async updateRoomDrawing(
    repositoryPath: string,
    roomId: string,
    drawingId: string,
    drawingName: string,
    drawingData: ExcalidrawData
  ): Promise<string | null> {
    try {
      const result = await window.mainProcess.roomDrawing.updateRoomDrawing(
        repositoryPath,
        roomId,
        drawingId,
        drawingName,
        drawingData
      );

      if (!result.success) {
        console.error('Failed to update room drawing:', result.error);
        return null;
      }

      return result.drawingId || drawingId;
    } catch (error) {
      console.error('Failed to update room drawing:', error);
      return null;
    }
  }

  /**
   * Load a specific drawing for a room
   */
  static async loadRoomDrawing(
    repositoryPath: string,
    roomId: string,
    drawingId: string
  ): Promise<ExcalidrawData | null> {
    try {
      const result = await window.mainProcess.roomDrawing.loadRoomDrawing(
        repositoryPath,
        roomId,
        drawingId
      );

      if (!result.success) {
        console.error('Failed to load room drawing:', result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('Failed to load room drawing:', error);
      return null;
    }
  }

  /**
   * List all drawings for a room with metadata
   */
  static async listRoomDrawings(
    repositoryPath: string,
    roomId: string
  ): Promise<RoomDrawingMetadata[]> {
    try {
      const result = await window.mainProcess.roomDrawing.listRoomDrawings(
        repositoryPath,
        roomId
      );

      if (!result.success) {
        console.error('Failed to list room drawings:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Failed to list room drawings:', error);
      return [];
    }
  }

  /**
   * Update drawing name without loading full content
   */
  static async updateDrawingName(
    repositoryPath: string,
    drawingId: string,
    newName: string
  ): Promise<boolean> {
    try {
      const result = await window.mainProcess.roomDrawing.updateDrawingName(
        repositoryPath,
        drawingId,
        newName
      );

      return result.success;
    } catch (error) {
      console.error('Failed to update drawing name:', error);
      return false;
    }
  }

  /**
   * Remove drawing from room (but keep the file)
   */
  static async unlinkDrawingFromRoom(
    repositoryPath: string,
    roomId: string,
    drawingId: string
  ): Promise<boolean> {
    try {
      const result = await window.mainProcess.roomDrawing.unlinkDrawingFromRoom(
        repositoryPath,
        roomId,
        drawingId
      );

      return result.success;
    } catch (error) {
      console.error('Failed to unlink drawing from room:', error);
      return false;
    }
  }

  /**
   * Delete drawing completely
   */
  static async deleteDrawing(
    repositoryPath: string,
    drawingId: string
  ): Promise<boolean> {
    try {
      const result = await window.mainProcess.roomDrawing.deleteDrawing(
        repositoryPath,
        drawingId
      );

      return result.success;
    } catch (error) {
      console.error('Failed to delete drawing:', error);
      return false;
    }
  }

  /**
   * List all drawings across all rooms
   */
  static async listAllDrawings(
    repositoryPath: string
  ): Promise<RoomDrawingMetadata[]> {
    try {
      const result = await window.mainProcess.roomDrawing.listAllDrawings(
        repositoryPath
      );

      if (!result.success) {
        console.error('Failed to list all drawings:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Failed to list all drawings:', error);
      return [];
    }
  }
}