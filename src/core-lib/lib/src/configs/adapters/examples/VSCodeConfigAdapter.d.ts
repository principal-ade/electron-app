/**
 * VSCodeConfigAdapter - Example adapter for VSCode extension
 * Fetches configs using VSCode APIs and workspace settings
 */
import { ConfigSource } from '../../types';
import { ConfigFetchAdapter, ConfigFetchResult } from '../ConfigFetchAdapter';
interface VSCodeAPI {
    workspace: {
        fs: {
            readFile(uri: any): Promise<Uint8Array>;
        };
        getConfiguration(section?: string): any;
    };
    Uri: {
        file(path: string): any;
        parse(value: string): any;
    };
}
export declare class VSCodeConfigAdapter implements ConfigFetchAdapter {
    private vscode;
    constructor(vscode: VSCodeAPI);
    fetchConfig(fileName: string, source: ConfigSource): Promise<ConfigFetchResult>;
    private fetchFromGitHub;
    private fetchFromLocal;
    private fetchFromUrl;
    configExists(fileName: string, source: ConfigSource): Promise<boolean>;
    listConfigs(source: ConfigSource): Promise<string[]>;
}
export {};
//# sourceMappingURL=VSCodeConfigAdapter.d.ts.map