import React from 'react';
interface RepositoryNotesPanelProps {
    remoteUrl?: string;
    directoryPath?: string;
    title?: string;
    showAddButton?: boolean;
    selectedNoteIds?: Set<string>;
    onNoteToggle?: (noteId: string) => void;
    viewMode?: 'explore' | 'dev';
}
export declare const RepositoryNotesPanel: React.FC<RepositoryNotesPanelProps>;
export {};
//# sourceMappingURL=RepositoryNotesPanel.d.ts.map