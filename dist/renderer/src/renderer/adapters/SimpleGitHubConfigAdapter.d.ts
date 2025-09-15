/**
 * Simple GitHub Config Adapter - Direct fetch from raw.githubusercontent.com
 * Replaces SharedLibConfigAdapter for GitHub-only usage
 */
import { ConfigFetchAdapter, ConfigFetchResult } from "../../shared/configs";
import { ConfigSource } from "../../shared/configs";
export declare class SimpleGitHubConfigAdapter implements ConfigFetchAdapter {
    fetchConfig(fileName: string, source: ConfigSource): Promise<ConfigFetchResult>;
    configExists(fileName: string, source: ConfigSource): Promise<boolean>;
}
//# sourceMappingURL=SimpleGitHubConfigAdapter.d.ts.map