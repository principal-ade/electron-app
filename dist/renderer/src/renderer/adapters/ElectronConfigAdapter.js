import { GithubService } from "../main-process-api/GithubService";
export class ElectronConfigAdapter {
    async fetchConfig(fileName, source) {
        let content;
        try {
            if (source.type === 'github') {
                const result = await GithubService.fetchConfigFromGitHub(source.owner, source.repo, source.branch || 'main', fileName);
                if (!result || !result.content) {
                    throw new Error(`Config not found: ${fileName}`);
                }
                content = result.content;
            }
            else if (source.type === 'url') {
                const result = await GithubService.fetchRemoteConfig(source.url);
                if (!result || !result.content) {
                    throw new Error(`Config not found at URL: ${source.url}`);
                }
                content = result.content;
            }
            else {
                throw new Error(`Unsupported source type for Electron: ${source.type}`);
            }
            return {
                content,
                source,
                timestamp: Date.now(),
                cached: false
            };
        }
        catch (error) {
            throw new Error(`Failed to fetch config ${fileName}: ${error.message}`);
        }
    }
    async configExists(fileName, source) {
        try {
            await this.fetchConfig(fileName, source);
            return true;
        }
        catch {
            return false;
        }
    }
    // Legacy methods for backward compatibility (can be removed later)
    async fetchRemote(url) {
        try {
            const result = await this.fetchConfig('', { type: 'url', url });
            return { content: result.content };
        }
        catch {
            return null;
        }
    }
    async fetchFromGitHub(owner, repo, branch, path) {
        try {
            const result = await this.fetchConfig(path, { type: 'github', owner, repo, branch });
            return { content: result.content };
        }
        catch {
            return null;
        }
    }
}
