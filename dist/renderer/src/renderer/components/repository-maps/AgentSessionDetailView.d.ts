import React from 'react';
import type { SessionCardData } from '../../pages/RepoManager/shared/AgentSessionCard';
interface AgentSessionDetailViewProps {
    cardData: SessionCardData | null;
    sessionColor: string;
    sources: Map<string, any>;
    repositoryPath: string;
    onOpenInEditor?: (filePath: string) => Promise<void>;
    onOpenAllInEditor?: (filePaths: string[]) => Promise<void>;
    onOpenTerminal?: () => void;
    hasTerminalWindow?: boolean;
    onShowContext?: () => void;
    onViewEvents?: () => void;
    onArchive?: () => void;
    onOpenPackageCommands?: (project: any) => Promise<void>;
    getTimeAgo: (timestamp: number) => string;
}
export declare const AgentSessionDetailView: React.FC<AgentSessionDetailViewProps>;
export {};
//# sourceMappingURL=AgentSessionDetailView.d.ts.map