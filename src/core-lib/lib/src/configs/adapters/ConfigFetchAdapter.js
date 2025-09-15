/**
 * ConfigFetchAdapter - Interface for platform-specific config fetching
 * Each platform (electron, vscode, web) implements this to fetch configs their own way
 */
/**
 * In-memory adapter for testing
 */
export class InMemoryConfigAdapter {
    constructor(configs) {
        this.configs = new Map();
        if (configs) {
            Object.entries(configs).forEach(([key, value]) => {
                this.configs.set(key, typeof value === 'string' ? value : JSON.stringify(value));
            });
        }
    }
    async fetchConfig(fileName, source) {
        const content = this.configs.get(fileName);
        if (!content) {
            throw new Error(`Config not found: ${fileName}`);
        }
        return {
            content,
            source,
            timestamp: Date.now(),
            cached: false,
        };
    }
    async configExists(fileName) {
        return this.configs.has(fileName);
    }
    async listConfigs() {
        return Array.from(this.configs.keys());
    }
    // Helper method for testing
    setConfig(fileName, content) {
        this.configs.set(fileName, typeof content === 'string' ? content : JSON.stringify(content));
    }
}
//# sourceMappingURL=ConfigFetchAdapter.js.map