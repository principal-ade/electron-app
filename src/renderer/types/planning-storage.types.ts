export type DocumentType = 'markdown' | 'excalidraw';
export type StorageLocation = 'repository' | 'app-data';

export interface DocumentInfo {
  path: string;
  name: string;
  relativePath: string;
  lastModified: Date;
  preview?: string;
  type: DocumentType;
  storageLocation: StorageLocation;
  // For app-data stored diagrams
  diagramId?: string;
}

export interface PlanningDocument {
  content: string | any; // string for markdown, object for excalidraw
  type: DocumentType;
  storageLocation: StorageLocation;
  metadata: {
    title?: string;
    lastModified?: Date;
    filePath?: string;
    diagramId?: string; // For app-data stored diagrams
  };
}

export interface StoragePreferences {
  defaultExcalidrawStorage: StorageLocation;
  showStoragePrompt: boolean;
}
