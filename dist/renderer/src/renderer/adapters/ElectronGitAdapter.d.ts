import { GitAdapter } from "@principal-ai/codebase-composition";
export declare class ElectronGitAdapter implements GitAdapter {
    detectRepository(path: string): Promise<{
        isGitRepository: boolean;
        currentBranch?: string;
        owner?: string;
        repo?: string;
    } | null>;
    watchGitRepository(path: string): Promise<boolean>;
    stopWatchingGit(): Promise<void>;
    onGitStatusChange(callback: (data: {
        changedFiles: any[];
    }) => void): () => void;
}
//# sourceMappingURL=ElectronGitAdapter.d.ts.map