import React from 'react';
import type { CityData, HighlightLayer } from "@principal-ai/code-city-react";
import { ToolbarItem } from '../../pages/RepoManager/shared/RepositoryToolbar';
import { RepositoryNote } from '../../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { EnhancedUIAgentSessionData } from '../../types/session.types';
import { SessionFileActivity } from '../../contexts/FileChangeContext';
import { SessionCardData } from '../../pages/RepoManager/shared/AgentSessionCard';
import { FileTreeSource } from '../../types/file-tree-source';
export type RightPaneView = 'city' | 'session-detail' | 'document';
interface RightPaneContainerProps {
    activeView: RightPaneView;
    onViewChange: (view: RightPaneView) => void;
    cityData: CityData | null;
    highlightLayers?: HighlightLayer[];
    loading?: boolean;
    treeStats?: {
        fileCount: number;
        directoryCount: number;
    } | null;
    onFileClick?: (filePath: string) => void;
    activeSource?: FileTreeSource | null;
    sessions: EnhancedUIAgentSessionData[];
    sessionFileActivities: Map<string, SessionFileActivity[]>;
    selectedSessionId?: string;
    repository?: {
        name: string;
        localClones?: Array<{
            path: string;
        }>;
    };
    onNoteCreated?: (note: RepositoryNote) => void;
    onHelpClick?: () => void;
    headerExtra?: React.ReactNode;
    sourceBadges?: React.ReactNode;
    selectedSessionCardData?: SessionCardData | null;
    sessionColor?: string;
    repositoryPath?: string;
    sources?: Map<string, any>;
    onOpenInEditor?: (filePath: string) => Promise<void>;
    onOpenAllInEditor?: (filePaths: string[]) => Promise<void>;
    onOpenTerminal?: () => void;
    hasTerminalWindow?: boolean;
    onShowContext?: () => void;
    onViewEvents?: () => void;
    onArchive?: () => void;
    onOpenPackageCommands?: (project: any) => Promise<void>;
    getTimeAgo?: (timestamp: number) => string;
    loadingMessage?: string;
    emptyMessage?: string;
    showViewSwitcher?: boolean;
    toolbarItems?: ToolbarItem[];
    toolbarExpanded?: boolean;
    onToolbarExpandedChange?: (expanded: boolean) => void;
    documentContent?: React.ReactNode;
}
export declare const RightPaneContainer: React.FC<RightPaneContainerProps>;
export {};
//# sourceMappingURL=RightPaneContainer.d.ts.map