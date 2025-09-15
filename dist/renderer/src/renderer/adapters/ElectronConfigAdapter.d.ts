import { ConfigFetchAdapter, ConfigFetchResult } from "../../shared/configs";
import type { ConfigSource } from "../../shared/configs";
export declare class ElectronConfigAdapter implements ConfigFetchAdapter {
    fetchConfig(fileName: string, source: ConfigSource): Promise<ConfigFetchResult>;
    configExists(fileName: string, source: ConfigSource): Promise<boolean>;
    fetchRemote(url: string): Promise<{
        content: string;
    } | null>;
    fetchFromGitHub(owner: string, repo: string, branch: string, path: string): Promise<{
        content: string;
    } | null>;
}
//# sourceMappingURL=ElectronConfigAdapter.d.ts.map