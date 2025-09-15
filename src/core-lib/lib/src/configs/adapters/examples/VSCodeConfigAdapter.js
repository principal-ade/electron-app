/**
 * VSCodeConfigAdapter - Example adapter for VSCode extension
 * Fetches configs using VSCode APIs and workspace settings
 */
export class VSCodeConfigAdapter {
    constructor(vscode) {
        this.vscode = vscode;
    }
    async fetchConfig(fileName, source) {
        let content;
        switch (source.type) {
            case 'github':
                content = await this.fetchFromGitHub(fileName, source);
                break;
            case 'local':
                content = await this.fetchFromLocal(fileName, source);
                break;
            case 'url':
                content = await this.fetchFromUrl(source.url);
                break;
            case 'inline':
                content = JSON.stringify(source.data);
                break;
            default:
                throw new Error(`Unsupported source type: ${source.type}`);
        }
        return {
            content,
            source,
            timestamp: Date.now(),
            cached: false,
        };
    }
    async fetchFromGitHub(fileName, source) {
        // Check workspace settings for GitHub token
        const config = this.vscode.workspace.getConfiguration('voyagerGuides');
        const token = config.get('githubToken');
        const url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch || 'main'}/${fileName}`;
        const headers = {};
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${fileName} from GitHub: ${response.statusText}`);
        }
        return response.text();
    }
    async fetchFromLocal(fileName, source) {
        const path = source.localPath ? `${source.localPath}/${fileName}` : fileName;
        const uri = this.vscode.Uri.file(path);
        try {
            const fileData = await this.vscode.workspace.fs.readFile(uri);
            return new TextDecoder().decode(fileData);
        }
        catch (error) {
            throw new Error(`Failed to read local config ${fileName}: ${error.message}`);
        }
    }
    async fetchFromUrl(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from URL: ${response.statusText}`);
        }
        return response.text();
    }
    async configExists(fileName, source) {
        try {
            if (source.type === 'local') {
                const path = source.localPath ? `${source.localPath}/${fileName}` : fileName;
                const uri = this.vscode.Uri.file(path);
                try {
                    await this.vscode.workspace.fs.readFile(uri);
                    return true;
                }
                catch {
                    return false;
                }
            }
            else if (source.type === 'github') {
                const url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch || 'main'}/${fileName}`;
                const response = await fetch(url, { method: 'HEAD' });
                return response.ok;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    async listConfigs(source) {
        // For GitHub sources, we know the standard config files
        if (source.type === 'github') {
            return ['scan-filters.json', 'default-layers.json', 'layer-templates.json'];
        }
        // For local sources, could scan directory
        // This is simplified - real implementation would scan the directory
        return [];
    }
}
//# sourceMappingURL=VSCodeConfigAdapter.js.map