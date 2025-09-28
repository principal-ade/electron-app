/**
 * IPC API interface for Palace Room (workspace) management
 */

import type {
  PalaceRoom,
  CreatePalaceRoomOptions,
  UpdatePalaceRoomOptions,
  PalacePortal,
  AlexandriaEntry,
  DrawingMetadata,
} from '@a24z/core-library';

export enum PalaceRoomAPIEvent {
  LIST_ALL_ROOMS = 'palace-room:list-all',
  LIST_ROOMS = 'palace-room:list',
  GET_ROOM = 'palace-room:get',
  CREATE_ROOM = 'palace-room:create',
  UPDATE_ROOM = 'palace-room:update',
  DELETE_ROOM = 'palace-room:delete',
  ADD_PORTAL = 'palace-room:add-portal',
  REMOVE_PORTAL = 'palace-room:remove-portal',
  LIST_PORTALS = 'palace-room:list-portals',
  GET_AVAILABLE_TARGETS = 'palace-room:get-available-targets',
  ADD_DRAWING_TO_ROOM = 'palace-room:add-drawing',
  REMOVE_DRAWING_FROM_ROOM = 'palace-room:remove-drawing',
  LIST_ROOM_DRAWINGS = 'palace-room:list-drawings',
  SAVE_ROOM_DRAWING = 'palace-room:save-drawing',
  LOAD_DRAWING = 'palace-room:load-drawing',
  DELETE_DRAWING = 'palace-room:delete-drawing',
  ROOM_CREATED = 'palace-room:created',
  ROOM_UPDATED = 'palace-room:updated',
  ROOM_DELETED = 'palace-room:deleted',
}

export interface PalaceRoomWithRepository {
  repository: AlexandriaEntry;
  rooms: PalaceRoom[];
}

export interface CreatePortalOptions {
  targetRepositoryPath: string;
  portalName: string;
  description?: string;
}

export interface PalaceRoomAPI {
  /**
   * List all palace rooms from all registered repositories
   */
  listAllPalaceRooms(): Promise<PalaceRoomWithRepository[]>;

  /**
   * List palace rooms from a specific repository
   */
  listPalaceRooms(repositoryPath: string): Promise<PalaceRoom[]>;

  /**
   * Get a specific palace room
   */
  getPalaceRoom(repositoryPath: string, roomId: string): Promise<PalaceRoom | null>;

  /**
   * Create a new palace room in a specific repository
   */
  createPalaceRoom(
    repositoryPath: string,
    options: CreatePalaceRoomOptions
  ): Promise<PalaceRoom | null>;

  /**
   * Update a palace room
   */
  updatePalaceRoom(
    repositoryPath: string,
    roomId: string,
    options: UpdatePalaceRoomOptions
  ): Promise<PalaceRoom | null>;

  /**
   * Delete a palace room
   */
  deletePalaceRoom(repositoryPath: string, roomId: string): Promise<boolean>;

  /**
   * Add a portal to another repository
   */
  addPortalToRoom(
    repositoryPath: string,
    roomId: string,
    options: CreatePortalOptions
  ): Promise<PalacePortal | null>;

  /**
   * Remove a portal from a palace room
   */
  removePortalFromRoom(
    repositoryPath: string,
    roomId: string,
    portalId: string
  ): Promise<boolean>;

  /**
   * List all portals in a room
   */
  listPortalsInRoom(repositoryPath: string, roomId: string): Promise<PalacePortal[]>;

  /**
   * Get available repositories that can be added as portals
   * (excludes the current repository)
   */
  getAvailablePortalTargets(currentRepositoryPath: string): Promise<AlexandriaEntry[]>;

  // Drawing management methods

  /**
   * Add a drawing to a palace room
   */
  addDrawingToRoom(repositoryPath: string, roomId: string, drawingName: string): Promise<boolean>;

  /**
   * Remove a drawing from a palace room
   */
  removeDrawingFromRoom(repositoryPath: string, roomId: string, drawingName: string): Promise<boolean>;

  /**
   * List all drawings in a palace room
   */
  listRoomDrawings(repositoryPath: string, roomId: string): Promise<DrawingMetadata[]>;

  /**
   * Save a drawing and associate it with a room
   */
  saveRoomDrawing(repositoryPath: string, roomId: string, drawingName: string, content: string): Promise<boolean>;

  /**
   * Load drawing content
   */
  loadDrawing(repositoryPath: string, drawingName: string): Promise<string | null>;

  /**
   * Delete a drawing
   */
  deleteDrawing(repositoryPath: string, drawingName: string): Promise<boolean>;
}