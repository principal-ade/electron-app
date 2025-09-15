import React from 'react';
interface Repository {
    root: string;
    rootDisplay?: string;
    fileCount: number;
    packages: Array<{
        path: string;
        pathDisplay?: string;
        name: string;
        version?: string;
        type: 'npm' | 'yarn' | 'pnpm' | 'unknown';
    }>;
    remotes?: Array<{
        name: string;
        url: string;
        owner?: string;
        repo?: string;
    }>;
    debug?: {
        originalPaths: string[];
        gitRoot: string;
        analysisTimestamp: number;
    };
}
interface SessionDetailsHeaderProps {
    sessionId: string;
    workingDirectory: string;
    basicGitInfo?: {
        gitRoot: string;
        relativePath: string;
        githubOwner?: string;
        githubRepo?: string;
        remoteUrl?: string;
    };
    repositories?: Repository[];
    onDeleteSession?: () => void;
}
export declare const SessionDetailsHeader: React.FC<SessionDetailsHeaderProps>;
export {};
//# sourceMappingURL=SessionDetailsHeader.d.ts.map