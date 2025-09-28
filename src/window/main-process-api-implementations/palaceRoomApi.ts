import { ipcRenderer } from 'electron';
import type {
  PalaceRoomAPI,
  CreatePortalOptions,
} from '../../shared/main-process-api-interfaces/PalaceRoomAPI';
import { PalaceRoomAPIEvent } from '../../shared/main-process-api-interfaces/PalaceRoomAPI';
import type { CreatePalaceRoomOptions, UpdatePalaceRoomOptions } from '@a24z/core-library';

export const palaceRoomAPI: PalaceRoomAPI = {
  listAllPalaceRooms: () =>
    ipcRenderer.invoke(PalaceRoomAPIEvent.LIST_ALL_ROOMS),

  listPalaceRooms: (repositoryPath: string) =>
    ipcRenderer.invoke(PalaceRoomAPIEvent.LIST_ROOMS, repositoryPath),

  getPalaceRoom: (repositoryPath: string, roomId: string) =>
    ipcRenderer.invoke(PalaceRoomAPIEvent.GET_ROOM, repositoryPath, roomId),

  createPalaceRoom: (repositoryPath: string, options: CreatePalaceRoomOptions) =>
    ipcRenderer.invoke(PalaceRoomAPIEvent.CREATE_ROOM, repositoryPath, options),

  updatePalaceRoom: (
    repositoryPath: string,
    roomId: string,
    options: UpdatePalaceRoomOptions
  ) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.UPDATE_ROOM,
      repositoryPath,
      roomId,
      options
    ),

  deletePalaceRoom: (repositoryPath: string, roomId: string) =>
    ipcRenderer.invoke(PalaceRoomAPIEvent.DELETE_ROOM, repositoryPath, roomId),

  addPortalToRoom: (
    repositoryPath: string,
    roomId: string,
    options: CreatePortalOptions
  ) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.ADD_PORTAL,
      repositoryPath,
      roomId,
      options
    ),

  removePortalFromRoom: (
    repositoryPath: string,
    roomId: string,
    portalId: string
  ) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.REMOVE_PORTAL,
      repositoryPath,
      roomId,
      portalId
    ),

  listPortalsInRoom: (repositoryPath: string, roomId: string) =>
    ipcRenderer.invoke(PalaceRoomAPIEvent.LIST_PORTALS, repositoryPath, roomId),

  getAvailablePortalTargets: (currentRepositoryPath: string) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.GET_AVAILABLE_TARGETS,
      currentRepositoryPath
    ),

  // Drawing management methods
  addDrawingToRoom: (repositoryPath: string, roomId: string, drawingName: string) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.ADD_DRAWING_TO_ROOM,
      repositoryPath,
      roomId,
      drawingName
    ),

  removeDrawingFromRoom: (repositoryPath: string, roomId: string, drawingName: string) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.REMOVE_DRAWING_FROM_ROOM,
      repositoryPath,
      roomId,
      drawingName
    ),

  listRoomDrawings: (repositoryPath: string, roomId: string) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.LIST_ROOM_DRAWINGS,
      repositoryPath,
      roomId
    ),

  saveRoomDrawing: (
    repositoryPath: string,
    roomId: string,
    drawingName: string,
    content: string
  ) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.SAVE_ROOM_DRAWING,
      repositoryPath,
      roomId,
      drawingName,
      content
    ),

  loadDrawing: (repositoryPath: string, drawingName: string) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.LOAD_DRAWING,
      repositoryPath,
      drawingName
    ),

  deleteDrawing: (repositoryPath: string, drawingName: string) =>
    ipcRenderer.invoke(
      PalaceRoomAPIEvent.DELETE_DRAWING,
      repositoryPath,
      drawingName
    ),
};