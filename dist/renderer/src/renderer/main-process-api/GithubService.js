export class GithubService {
    static async detectRepository(path) {
        const result = await window.mainProcess.github.detectRepository(path);
        return result;
    }
    static async fetchConfigFromGitHub(owner, repo, branch, path) {
        const result = await window.mainProcess?.github?.fetchGitHubConfig({ owner, repo, branch, path });
        return result;
    }
    static async getTree(owner, repo, branch) {
        const result = await window.mainProcess?.github?.getTree(owner, repo, branch);
        return result;
    }
    static async fetchRemoteConfig(url) {
        const result = await window.mainProcess?.github?.fetchRemoteConfig({ url });
        return result;
    }
    static async getIssues(owner, repo) {
        const result = await window.mainProcess?.github?.getIssues(owner, repo);
        return result || [];
    }
    static async createIssue(owner, repo, issue) {
        const result = await window.mainProcess?.github?.createIssue(owner, repo, issue);
        return result;
    }
    static async getFileContent(owner, repo, path, branch) {
        const result = await window.mainProcess?.github?.getFileContent(owner, repo, path, branch);
        return result;
    }
    static async checkAuthStatus() {
        const result = await window.mainProcess?.github?.checkAuthStatus();
        return result;
    }
}
