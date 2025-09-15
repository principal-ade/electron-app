export declare class GithubService {
    static detectRepository(path: string): Promise<{
        isGitRepository: boolean;
        remotes: import("../../shared/main-process-api-interfaces/GitHubAPI").GitRemote[];
        owner?: string;
        repo?: string;
        isGitHub: boolean;
    } | null>;
    static fetchConfigFromGitHub(owner: string, repo: string, branch: string, path: string): Promise<import("../../shared/main-process-api-interfaces/GitHubAPI").ConfigFetchResponse>;
    static getTree(owner: string, repo: string, branch: string): Promise<{
        success: boolean;
        data?: {
            sha: string;
            url: string;
            tree: Array<{
                path: string;
                mode: string;
                type: "blob" | "tree";
                sha: string;
                size?: number;
                url: string;
            }>;
            truncated: boolean;
        };
        error?: string;
    } | null>;
    static fetchRemoteConfig(url: string): Promise<import("../../shared/main-process-api-interfaces/GitHubAPI").ConfigFetchResponse>;
    static getIssues(owner: string, repo: string): Promise<import("../../shared/main-process-api-interfaces/GitHubAPI").GitHubIssue[]>;
    static createIssue(owner: string, repo: string, issue: any): Promise<import("../../shared/main-process-api-interfaces/GitHubAPI").CreateIssueResponse>;
    static getFileContent(owner: string, repo: string, path: string, branch?: string): Promise<string | null>;
    static checkAuthStatus(): Promise<{
        isAuthenticated: boolean;
        method: string;
        username?: string;
    }>;
}
//# sourceMappingURL=GithubService.d.ts.map