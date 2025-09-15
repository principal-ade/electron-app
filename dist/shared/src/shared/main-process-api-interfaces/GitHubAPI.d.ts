export declare enum GitHubAPIEvent {
    DETECT_REPOSITORY = "github:detect-repository",
    GET_ISSUES = "github:get-issues",
    CREATE_ISSUE = "github:create-issue",
    REFRESH_DATA = "github:refresh-data",
    CHECK_AUTH_STATUS = "github:check-auth-status",
    GET_CHANGED_FILES = "github:get-changed-files",
    GET_MARKDOWN_DOCUMENTS = "github:get-markdown-documents",
    GET_FILE_CONTENT = "github:get-file-content",// (owner, repo, path, ref?)
    GET_FILE_AGES = "github:get-file-ages",
    GET_TREE = "github:get-tree",
    FETCH_REMOTE_CONFIG = "github:fetch-remote-config",
    FETCH_GITHUB_CONFIG = "github:fetch-github-config"
}
export interface ConfigFetchRequest {
    url: string;
}
export interface ConfigFetchResponse {
    content: string | null;
    error?: string;
}
export interface GitHubConfigRequest {
    owner: string;
    repo: string;
    branch: string;
    path: string;
}
export interface GitRemote {
    name: string;
    url: string;
    owner?: string;
    repo?: string;
}
export interface PullRequestReference {
    url?: string;
    html_url?: string;
    diff_url?: string;
    patch_url?: string;
}
export interface GitHubIssue {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    body: string | null;
    html_url: string;
    created_at: string;
    updated_at: string;
    labels: Array<{
        id: number;
        name: string;
        color: string;
    }>;
    comments: number;
    user: {
        login: string;
        avatar_url: string;
    };
    assignees: Array<{
        login: string;
        avatar_url: string;
    }>;
    pull_request?: PullRequestReference;
}
export interface CreateIssueRequest {
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
}
export interface CreateIssueResponse {
    success: boolean;
    issue?: GitHubIssue;
    error?: string;
}
export interface GitHubAPI {
    detectRepository: (path: string) => Promise<{
        isGitRepository: boolean;
        remotes: GitRemote[];
        owner?: string;
        repo?: string;
        isGitHub: boolean;
    } | null>;
    getIssues: (owner: string, repo: string) => Promise<GitHubIssue[]>;
    createIssue: (owner: string, repo: string, issue: CreateIssueRequest) => Promise<CreateIssueResponse>;
    refreshData: (owner: string, repo: string) => Promise<void>;
    checkAuthStatus: () => Promise<{
        isAuthenticated: boolean;
        method: string;
        username?: string;
    }>;
    getChangedFiles: (directoryPath: string) => Promise<{
        path: string;
        status: 'added' | 'modified' | 'deleted' | 'renamed';
        lastModified?: Date;
    }[]>;
    getMarkdownDocuments: (owner: string, repo: string) => Promise<Array<{
        path: string;
        name: string;
        lastModified: string;
        gitLastModified?: string;
        size: number;
        isTracked: boolean;
    }>>;
    getFileContent: (owner: string, repo: string, path: string, ref?: string) => Promise<string | null>;
    getFileAges: (directoryPath: string) => Promise<Array<{
        path: string;
        lastCommitDate: string;
        daysSinceLastCommit: number;
    }>>;
    getTree: (owner: string, repo: string, ref?: string) => Promise<{
        success: boolean;
        data?: {
            sha: string;
            url: string;
            tree: Array<{
                path: string;
                mode: string;
                type: 'blob' | 'tree';
                sha: string;
                size?: number;
                url: string;
            }>;
            truncated: boolean;
        };
        error?: string;
    } | null>;
    fetchRemoteConfig: (request: ConfigFetchRequest) => Promise<ConfigFetchResponse>;
    fetchGitHubConfig: (request: GitHubConfigRequest) => Promise<ConfigFetchResponse>;
}
//# sourceMappingURL=GitHubAPI.d.ts.map