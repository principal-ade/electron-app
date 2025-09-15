declare global {
    interface Window {
        gitSync: {
            authenticate: () => Promise<string | null>;
            getServerUrl: () => Promise<string>;
            checkRepoAccess: (repoUrl: string, token: string) => Promise<boolean>;
        };
    }
}
export {};
//# sourceMappingURL=preload-git-sync.d.ts.map