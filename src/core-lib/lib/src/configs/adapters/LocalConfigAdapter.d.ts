/**
 * LocalConfigAdapter - Uses bundled local JSON files
 * No external dependencies, works offline
 */
import { ConfigSource } from '../types';
import { ConfigFetchAdapter, ConfigFetchResult } from './ConfigFetchAdapter';
export declare class LocalConfigAdapter implements ConfigFetchAdapter {
    private configs;
    fetchConfig(fileName: string, _source: ConfigSource): Promise<ConfigFetchResult>;
    configExists(fileName: string, _source: ConfigSource): Promise<boolean>;
    listConfigs(_source: ConfigSource): Promise<string[]>;
}
//# sourceMappingURL=LocalConfigAdapter.d.ts.map