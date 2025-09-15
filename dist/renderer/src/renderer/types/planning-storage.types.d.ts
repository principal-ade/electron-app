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
    diagramId?: string;
}
export interface PlanningDocument {
    content: string | any;
    type: DocumentType;
    storageLocation: StorageLocation;
    metadata: {
        title?: string;
        lastModified?: Date;
        filePath?: string;
        diagramId?: string;
    };
}
export interface StoragePreferences {
    defaultExcalidrawStorage: StorageLocation;
    showStoragePrompt: boolean;
}
//# sourceMappingURL=planning-storage.types.d.ts.map