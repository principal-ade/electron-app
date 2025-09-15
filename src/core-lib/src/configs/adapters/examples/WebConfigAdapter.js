/**
 * WebConfigAdapter - Example adapter for web applications
 * Fetches configs using browser fetch API with CORS considerations
 */
export class WebConfigAdapter {
    constructor(options) {
        this.corsProxy = options?.corsProxy;
    }
    async fetchConfig(fileName, source) {
        let content;
        switch (source.type) {
            case 'github':
                content = await this.fetchFromGitHub(fileName, source);
                break;
            case 'url':
                content = await this.fetchFromUrl(source.url);
                break;
            case 'inline':
                content = JSON.stringify(source.data);
                break;
            case 'local':
                // In browser context, 'local' might mean localStorage or IndexedDB
                content = await this.fetchFromLocalStorage(fileName);
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
        // Use raw.githubusercontent.com for direct access
        let url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch || 'main'}/${fileName}`;
        // If CORS proxy is configured, use it
        if (this.corsProxy) {
            url = `${this.corsProxy}${encodeURIComponent(url)}`;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        }
        catch {
            // If direct fetch fails, try GitHub API
            return this.fetchFromGitHubAPI(fileName, source);
        }
    }
    async fetchFromGitHubAPI(fileName, source) {
        // Use GitHub API as fallback
        const apiUrl = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${fileName}`;
        const params = new URLSearchParams();
        if (source.branch) {
            params.append('ref', source.branch);
        }
        const response = await fetch(`${apiUrl}?${params}`, {
            headers: {
                Accept: 'application/vnd.github.v3+json',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${fileName} from GitHub API: ${response.statusText}`);
        }
        const data = (await response.json());
        // GitHub API returns base64 encoded content
        if (data.content) {
            return atob(data.content.replace(/\n/g, ''));
        }
        throw new Error('No content in GitHub API response');
    }
    async fetchFromUrl(url) {
        // Apply CORS proxy if configured
        if (this.corsProxy) {
            url = `${this.corsProxy}${encodeURIComponent(url)}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from URL: ${response.statusText}`);
        }
        return response.text();
    }
    async fetchFromLocalStorage(fileName) {
        // Check localStorage first
        const localStorageKey = `voyager-config:${fileName}`;
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
            return stored;
        }
        // Could also check IndexedDB here
        throw new Error(`Config ${fileName} not found in local storage`);
    }
    async configExists(fileName, source) {
        try {
            if (source.type === 'local') {
                const localStorageKey = `voyager-config:${fileName}`;
                return localStorage.getItem(localStorageKey) !== null;
            }
            else if (source.type === 'github') {
                // Use HEAD request to check existence
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
    // Helper method to save configs to localStorage (for offline use)
    async cacheConfigLocally(fileName, content) {
        const localStorageKey = `voyager-config:${fileName}`;
        localStorage.setItem(localStorageKey, content);
    }
}
