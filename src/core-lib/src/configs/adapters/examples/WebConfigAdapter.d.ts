/**
 * WebConfigAdapter - Example adapter for web applications
 * Fetches configs using browser fetch API with CORS considerations
 */
import { ConfigSource } from '../../types';
import { ConfigFetchAdapter, ConfigFetchResult } from '../ConfigFetchAdapter';
export declare class WebConfigAdapter implements ConfigFetchAdapter {
    private corsProxy?;
    constructor(options?: {
        corsProxy?: string;
    });
    fetchConfig(fileName: string, source: ConfigSource): Promise<ConfigFetchResult>;
    private fetchFromGitHub;
    private fetchFromGitHubAPI;
    private fetchFromUrl;
    private fetchFromLocalStorage;
    configExists(fileName: string, source: ConfigSource): Promise<boolean>;
    cacheConfigLocally(fileName: string, content: string): Promise<void>;
}
//# sourceMappingURL=WebConfigAdapter.d.ts.map