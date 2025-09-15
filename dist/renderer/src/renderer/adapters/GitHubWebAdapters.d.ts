import { FileSystemAdapter, GitAdapter, ShellAdapter } from "@principal-ai/codebase-composition";
import { ConfigFetchAdapter } from "../../shared/configs";
interface PlatformAdapters {
    fileSystem: FileSystemAdapter;
    git: GitAdapter;
    shell: ShellAdapter;
    config: ConfigFetchAdapter;
}
export declare class GitHubWebAdapters implements PlatformAdapters {
    fileSystem: FileSystemAdapter;
    git: GitAdapter;
    shell: ShellAdapter;
    config: ConfigFetchAdapter;
    constructor(owner: string, repo: string, branch?: string);
    static fromUrl(url: string): GitHubWebAdapters | null;
}
export {};
//# sourceMappingURL=GitHubWebAdapters.d.ts.map