import React from 'react';
import { RepositoryNote } from '../../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { EnhancedUIAgentSessionData } from '../../types/session.types';
import { SessionFileActivity } from '../../contexts/FileChangeContext';
interface FilteredRepositoryNotesPanelProps {
    notes: RepositoryNote[];
    sessions: EnhancedUIAgentSessionData[];
    sessionFileActivities: Map<string, SessionFileActivity[]>;
    selectedSessionId?: string;
    remoteUrl?: string;
    onNoteToggle?: (noteId: string) => void;
    selectedNoteIds?: Set<string>;
    repository?: {
        name: string;
        localClones?: Array<{
            path: string;
        }>;
    };
    onNotesUpdated?: (notes: RepositoryNote[]) => void;
}
export declare const FilteredRepositoryNotesPanel: React.FC<FilteredRepositoryNotesPanelProps>;
export {};
//# sourceMappingURL=FilteredRepositoryNotesPanel.d.ts.map