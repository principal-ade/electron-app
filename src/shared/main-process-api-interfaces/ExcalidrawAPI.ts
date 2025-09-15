import { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { AppState as ExcalidrawAppState, BinaryFiles, LibraryItem } from "@excalidraw/excalidraw/types";

export interface ExcalidrawDiagramData {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: readonly OrderedExcalidrawElement[];
  appState: ExcalidrawAppState;
  files: BinaryFiles;
  libraryItems?: readonly LibraryItem[];
}

export interface ExcalidrawDiagram {
  id: string;
  name: string;
  projectPath?: string;
  isRepoAgnostic: boolean;
  createdAt: Date;
  updatedAt: Date;
  data: ExcalidrawDiagramData;
  metadata?: {
    tags?: string[];
    description?: string;
    thumbnail?: string;
  };
}

export interface ExcalidrawAPI {
  saveDiagram: (diagram: ExcalidrawDiagram) => Promise<{ success: boolean; error?: string }>;
  loadDiagram: (
    diagramId: string,
  ) => Promise<{ success: boolean; data?: ExcalidrawDiagram; error?: string }>;
  listDiagrams: (
    projectPath?: string,
  ) => Promise<{ success: boolean; data?: ExcalidrawDiagram[]; error?: string }>;
  deleteDiagram: (
    diagramId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  exportDiagram: (
    diagramId: string,
    format: 'png' | 'svg' | 'json',
  ) => Promise<{ success: boolean; data?: Blob; error?: string }>;
}