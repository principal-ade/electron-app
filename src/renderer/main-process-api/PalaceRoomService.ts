/**
 * Renderer-side service for Palace Room (workspace) management
 * Communicates with main process via IPC using window.mainProcess
 */

import type {
  PalaceRoom,
  CreatePalaceRoomOptions,
  UpdatePalaceRoomOptions,
  PalacePortal,
  AlexandriaEntry,
  DrawingMetadata,
} from '@a24z/core-library';
import type {
  PalaceRoomWithRepository,
  CreatePortalOptions,
} from '../../shared/main-process-api-interfaces/PalaceRoomAPI';

export class PalaceRoomService {
  /**
   * List all palace rooms from all registered repositories
   */
  static async listAllPalaceRooms(): Promise<PalaceRoomWithRepository[]> {
    return window.mainProcess.palaceRoom.listAllPalaceRooms();
  }

  /**
   * List palace rooms from a specific repository
   */
  static async listPalaceRooms(repositoryPath: string): Promise<PalaceRoom[]> {
    return window.mainProcess.palaceRoom.listPalaceRooms(repositoryPath);
  }

  /**
   * Get a specific palace room
   */
  static async getPalaceRoom(
    repositoryPath: string,
    roomId: string
  ): Promise<PalaceRoom | null> {
    return window.mainProcess.palaceRoom.getPalaceRoom(repositoryPath, roomId);
  }

  /**
   * Create a new palace room in a specific repository
   */
  static async createPalaceRoom(
    repositoryPath: string,
    options: CreatePalaceRoomOptions
  ): Promise<PalaceRoom | null> {
    return window.mainProcess.palaceRoom.createPalaceRoom(repositoryPath, options);
  }

  /**
   * Update a palace room
   */
  static async updatePalaceRoom(
    repositoryPath: string,
    roomId: string,
    options: UpdatePalaceRoomOptions
  ): Promise<PalaceRoom | null> {
    return window.mainProcess.palaceRoom.updatePalaceRoom(
      repositoryPath,
      roomId,
      options
    );
  }

  /**
   * Delete a palace room
   */
  static async deletePalaceRoom(
    repositoryPath: string,
    roomId: string
  ): Promise<boolean> {
    return window.mainProcess.palaceRoom.deletePalaceRoom(repositoryPath, roomId);
  }

  /**
   * Add a portal to another repository
   */
  static async addPortalToRoom(
    repositoryPath: string,
    roomId: string,
    targetRepositoryPath: string,
    portalName: string,
    description?: string
  ): Promise<PalacePortal | null> {
    const options: CreatePortalOptions = {
      targetRepositoryPath,
      portalName,
      description,
    };
    return window.mainProcess.palaceRoom.addPortalToRoom(
      repositoryPath,
      roomId,
      options
    );
  }

  /**
   * Remove a portal from a palace room
   */
  static async removePortalFromRoom(
    repositoryPath: string,
    roomId: string,
    portalId: string
  ): Promise<boolean> {
    return window.mainProcess.palaceRoom.removePortalFromRoom(
      repositoryPath,
      roomId,
      portalId
    );
  }

  /**
   * List all portals in a room
   */
  static async listPortalsInRoom(
    repositoryPath: string,
    roomId: string
  ): Promise<PalacePortal[]> {
    return window.mainProcess.palaceRoom.listPortalsInRoom(repositoryPath, roomId);
  }

  /**
   * Get available repositories that can be added as portals
   * (excludes the current repository)
   */
  static async getAvailablePortalTargets(
    currentRepositoryPath: string
  ): Promise<AlexandriaEntry[]> {
    return window.mainProcess.palaceRoom.getAvailablePortalTargets(
      currentRepositoryPath
    );
  }

  // Drawing management methods

  /**
   * Add a drawing to a palace room
   */
  static async addDrawingToRoom(
    repositoryPath: string,
    roomId: string,
    drawingName: string
  ): Promise<boolean> {
    return window.mainProcess.palaceRoom.addDrawingToRoom(
      repositoryPath,
      roomId,
      drawingName
    );
  }

  /**
   * Remove a drawing from a palace room
   */
  static async removeDrawingFromRoom(
    repositoryPath: string,
    roomId: string,
    drawingName: string
  ): Promise<boolean> {
    return window.mainProcess.palaceRoom.removeDrawingFromRoom(
      repositoryPath,
      roomId,
      drawingName
    );
  }

  /**
   * List all drawings in a palace room
   */
  static async listRoomDrawings(
    repositoryPath: string,
    roomId: string
  ): Promise<DrawingMetadata[]> {
    return window.mainProcess.palaceRoom.listRoomDrawings(repositoryPath, roomId);
  }

  /**
   * Save a drawing and associate it with a room
   */
  static async saveRoomDrawing(
    repositoryPath: string,
    roomId: string,
    drawingName: string,
    content: string
  ): Promise<boolean> {
    return window.mainProcess.palaceRoom.saveRoomDrawing(
      repositoryPath,
      roomId,
      drawingName,
      content
    );
  }

  /**
   * Load drawing content
   */
  static async loadDrawing(
    repositoryPath: string,
    drawingName: string
  ): Promise<string | null> {
    return window.mainProcess.palaceRoom.loadDrawing(repositoryPath, drawingName);
  }

  /**
   * Delete a drawing
   */
  static async deleteDrawing(
    repositoryPath: string,
    drawingName: string
  ): Promise<boolean> {
    return window.mainProcess.palaceRoom.deleteDrawing(repositoryPath, drawingName);
  }
}