import { ipcRenderer } from 'electron';
import type { RoomDrawingAPI } from '../../shared/main-process-api-interfaces/RoomDrawingAPI';

export enum RoomDrawingAPIEvents {
  SAVE_ROOM_DRAWING = 'room-drawings:save',
  UPDATE_ROOM_DRAWING = 'room-drawings:update',
  LOAD_ROOM_DRAWING = 'room-drawings:load',
  LIST_ROOM_DRAWINGS = 'room-drawings:list',
  UPDATE_DRAWING_NAME = 'room-drawings:update-name',
  UNLINK_DRAWING_FROM_ROOM = 'room-drawings:unlink',
  DELETE_DRAWING = 'room-drawings:delete',
  LIST_ALL_DRAWINGS = 'room-drawings:list-all',
}

export const roomDrawingAPI: RoomDrawingAPI = {
  saveRoomDrawing: (repositoryPath, roomId, drawingName, drawingData) =>
    ipcRenderer.invoke(RoomDrawingAPIEvents.SAVE_ROOM_DRAWING, repositoryPath, roomId, drawingName, drawingData),

  updateRoomDrawing: (repositoryPath, roomId, drawingId, drawingName, drawingData) =>
    ipcRenderer.invoke(RoomDrawingAPIEvents.UPDATE_ROOM_DRAWING, repositoryPath, roomId, drawingId, drawingName, drawingData),

  loadRoomDrawing: (repositoryPath, roomId, drawingId) =>
    ipcRenderer.invoke(RoomDrawingAPIEvents.LOAD_ROOM_DRAWING, repositoryPath, roomId, drawingId),

  listRoomDrawings: (repositoryPath, roomId) =>
    ipcRenderer.invoke(RoomDrawingAPIEvents.LIST_ROOM_DRAWINGS, repositoryPath, roomId),

  updateDrawingName: (repositoryPath, drawingId, newName) =>
    ipcRenderer.invoke(RoomDrawingAPIEvents.UPDATE_DRAWING_NAME, repositoryPath, drawingId, newName),

  unlinkDrawingFromRoom: (repositoryPath, roomId, drawingId) =>
    ipcRenderer.invoke(RoomDrawingAPIEvents.UNLINK_DRAWING_FROM_ROOM, repositoryPath, roomId, drawingId),

  deleteDrawing: (repositoryPath, drawingId) =>
    ipcRenderer.invoke(RoomDrawingAPIEvents.DELETE_DRAWING, repositoryPath, drawingId),

  listAllDrawings: (repositoryPath) =>
    ipcRenderer.invoke(RoomDrawingAPIEvents.LIST_ALL_DRAWINGS, repositoryPath),
};