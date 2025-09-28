import type { ExcalidrawData, RoomDrawingMetadata } from '@a24z/core-library';

export interface RoomDrawingAPI {
  saveRoomDrawing: (
    repositoryPath: string,
    roomId: string,
    drawingName: string,
    drawingData: ExcalidrawData
  ) => Promise<{ success: boolean; drawingId?: string; error?: string }>;

  updateRoomDrawing: (
    repositoryPath: string,
    roomId: string,
    drawingId: string,
    drawingName: string,
    drawingData: ExcalidrawData
  ) => Promise<{ success: boolean; drawingId?: string; error?: string }>;

  loadRoomDrawing: (
    repositoryPath: string,
    roomId: string,
    drawingId: string
  ) => Promise<{ success: boolean; data?: ExcalidrawData; error?: string }>;

  listRoomDrawings: (
    repositoryPath: string,
    roomId: string
  ) => Promise<{ success: boolean; data?: RoomDrawingMetadata[]; error?: string }>;

  updateDrawingName: (
    repositoryPath: string,
    drawingId: string,
    newName: string
  ) => Promise<{ success: boolean; error?: string }>;

  unlinkDrawingFromRoom: (
    repositoryPath: string,
    roomId: string,
    drawingId: string
  ) => Promise<{ success: boolean; error?: string }>;

  deleteDrawing: (
    repositoryPath: string,
    drawingId: string
  ) => Promise<{ success: boolean; error?: string }>;

  listAllDrawings: (
    repositoryPath: string
  ) => Promise<{ success: boolean; data?: RoomDrawingMetadata[]; error?: string }>;
}