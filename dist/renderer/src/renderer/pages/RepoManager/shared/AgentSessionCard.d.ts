import React from 'react';
import type { FileOperation, TodoItem } from '../../../main-process-api/AgentSessionService';
import type { EnhancedUIAgentSessionData } from '../../../types/session.types';
import type { TouchedProject } from '../../../utils/sessionProjectMapping';
export interface SessionCardData {
    session: EnhancedUIAgentSessionData;
    isExpanded: boolean;
    hasUncommittedChanges?: boolean;
    fileOperations?: Map<string, FileOperation>;
    lastTodos?: TodoItem[];
    touchedProjects?: TouchedProject[];
    latestEvent?: {
        toolName: string;
        timestamp: number;
        fileName?: string;
        description?: string;
    };
    hasNewEvent?: boolean;
    previousEventCount?: number;
    eventCountUpdated?: boolean;
    lastEventTimestamp?: number;
    isRecentlyActive?: boolean;
    activityType?: 'active' | 'waiting' | null;
    stats?: {
        filesRead: number;
        filesWritten: number;
        toolCalls: number;
        lastActivity: Date;
    };
}
interface AgentSessionCardProps {
    cardData: SessionCardData;
    sessionColor: string;
    theme: any;
    sources: Map<string, any>;
    repositoryPath: string;
    isEditingName: boolean;
    editingName: string;
    editInputRef: React.RefObject<HTMLInputElement>;
    isCopied: boolean;
    isArchiving: boolean;
    isShownOnMap?: boolean;
    onStartEditName: () => void;
    onSaveEditName: () => void;
    onCancelEditName: () => void;
    onEditNameChange: (name: string) => void;
    onCopySessionId: () => void;
    onOpenTerminal?: () => void;
    onShowContext?: () => void;
    onArchive: () => void;
    onOpenPackageCommands: (project: TouchedProject, index: number) => Promise<void>;
    onOpenInEditor?: (filePath: string) => Promise<void>;
    onOpenAllInEditor?: (filePaths: string[]) => Promise<void>;
    onToggleShowOnMap?: () => void;
    onViewEvents?: () => void;
    onHighlightFiles?: (files: string[], mode: 'single' | 'trail' | 'cumulative') => void;
    onSessionDetailSelect?: () => void;
    getTimeAgo: (timestamp: number) => string;
}
export declare const AgentSessionCard: React.FC<AgentSessionCardProps>;
export {};
//# sourceMappingURL=AgentSessionCard.d.ts.map