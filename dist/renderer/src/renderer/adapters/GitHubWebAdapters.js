import { parseGitHubUrl } from "@principal-ai/repository-abstraction";
import { ElectronConfigAdapter } from "./ElectronConfigAdapter";
import { GitHubFileSystemAdapter } from "./github/GitHubFileSystemAdapter";
import { GitHubGitAdapter } from "./github/GitHubGitAdapter";
import { GitHubShellAdapter } from "./github/GitHubShellAdapter";
// Main adapter class for GitHub repositories
export class GitHubWebAdapters {
    fileSystem;
    git;
    shell;
    config;
    constructor(owner, repo, branch) {
        this.fileSystem = new GitHubFileSystemAdapter(owner, repo, branch);
        this.git = new GitHubGitAdapter(owner, repo, branch);
        this.shell = new GitHubShellAdapter();
        this.config = new ElectronConfigAdapter();
    }
    static fromUrl(url) {
        const parsed = parseGitHubUrl(url);
        if (!parsed)
            return null;
        return new GitHubWebAdapters(parsed.owner, parsed.repo);
    }
}
