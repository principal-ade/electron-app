export class GitHubGitAdapter {
    owner;
    repo;
    branch;
    constructor(owner, repo, branch) {
        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
    }
    async detectRepository(_path) {
        return {
            isGitRepository: true,
            currentBranch: this.branch,
            owner: this.owner,
            repo: this.repo,
        };
    }
    async watchGitRepository(_path) {
        return false;
    }
    async stopWatchingGit() {
        // No-op for remote GitHub repos
    }
    onGitStatusChange(_callback) {
        return () => { };
    }
}
