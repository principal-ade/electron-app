import React, { ReactNode } from 'react';
import type { CityData, HighlightLayer } from "@principal-ai/code-city-react";
import "@a24z/panels/style.css";
import type { ToolbarItem } from './RepositoryToolbar';
import { EnhancedUIAgentSessionData } from '../../../types/session.types';
import { SessionFileActivity } from '../../../contexts/FileChangeContext';
import { SessionCardData } from './AgentSessionCard';
import { FileTreeSource } from '../../../types/file-tree-source';
import { RightPaneMode } from '../../../../shared/types/userPreferences.types';
export interface TabConfig {
    id: string;
    label: string;
    icon: ReactNode;
    content: ReactNode;
    visible?: boolean;
}
interface RepositoryViewSkeletonProps {
    tabs: TabConfig[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    cityData: CityData | null;
    highlightLayers: HighlightLayer[];
    loading: boolean;
    treeStats?: {
        fileCount: number;
        directoryCount: number;
    } | null;
    sourceBadges?: ReactNode;
    activeSource?: FileTreeSource | null;
    onHelpClick?: () => void;
    cityHeaderExtra?: ReactNode;
    loadingMessage?: string;
    emptyMessage?: string;
    onFileClick?: (filePath: string) => void;
    rightPaneMode?: RightPaneMode;
    onRightPaneModeChange?: (mode: RightPaneMode) => void;
    terminalDirectory?: string;
    terminalTabsRef?: React.RefObject<{
        addClaudeSession: (sessionId: string, sessionName?: string) => void;
    } | null>;
    showViewSwitcher?: boolean;
    sessions?: EnhancedUIAgentSessionData[];
    sessionFileActivities?: Map<string, SessionFileActivity[]>;
    selectedSessionId?: string;
    repository?: {
        name: string;
        localClones?: Array<{
            path: string;
        }>;
    };
    selectedSessionCardData?: SessionCardData | null;
    sessionColor?: string;
    repositoryPath?: string;
    sources?: Map<string, any>;
    onOpenInEditor?: (filePath: string) => Promise<void>;
    onOpenAllInEditor?: (filePaths: string[]) => Promise<void>;
    onOpenTerminal?: () => void;
    onShowContext?: () => void;
    onViewEvents?: () => void;
    onArchive?: () => void;
    onOpenPackageCommands?: (project: any) => Promise<void>;
    getTimeAgo?: (timestamp: number) => string;
    toolbarItems?: ToolbarItem[];
    toolbarExpanded?: boolean;
    onToolbarExpandedChange?: (expanded: boolean) => void;
    documentContent?: React.ReactNode;
}
export declare const RepositoryViewSkeleton: React.FC<RepositoryViewSkeletonProps>;
export {};
//# sourceMappingURL=RepositoryViewSkeleton.d.ts.map