export interface A24zNote {
    id: string;
    note: string;
    anchors?: string[];
    tags?: string[];
    type?: string;
    metadata?: Record<string, unknown>;
    timestamp?: number;
    [key: string]: unknown;
}
export interface A24zAPI {
    getAllNotes: (repositoryPath: string) => Promise<A24zNote[]>;
    getNotesForPath: (filePath: string, repositoryPath: string) => Promise<A24zNote[]>;
    hasA24zDirectory: (repositoryPath: string) => Promise<boolean>;
    getNoteCount: (repositoryPath: string) => Promise<number>;
}
//# sourceMappingURL=A24zAPI.d.ts.map