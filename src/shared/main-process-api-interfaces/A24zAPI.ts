// A24z note structure (from @a24z/core-library)
export interface A24zNote {
  id: string;
  note: string;
  anchors?: string[];
  tags?: string[];
  type?: string;
  metadata?: Record<string, unknown>; // Flexible metadata from @a24z/core-library
  timestamp?: number;
  [key: string]: unknown; // Allow additional properties from A24z library
}

export interface A24zAPI {
  getAllNotes: (repositoryPath: string) => Promise<A24zNote[]>;
  getNotesForPath: (
    filePath: string,
    repositoryPath: string,
  ) => Promise<A24zNote[]>;
  hasA24zDirectory: (repositoryPath: string) => Promise<boolean>;
  getNoteCount: (repositoryPath: string) => Promise<number>;
}
