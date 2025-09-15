import { ArchiveConfiguration } from '../storage-providers/typed-namespaces';
export declare const DEFAULT_ARCHIVE_CONFIG: ArchiveConfiguration;
export declare class ArchiveConfigurationService {
    private readonly configNamespace;
    private readonly configKey;
    getConfiguration(): Promise<ArchiveConfiguration>;
    updateConfiguration(config: Partial<ArchiveConfiguration>): Promise<void>;
    private mergeWithDefaults;
    private deepMerge;
}
export declare const archiveConfigService: ArchiveConfigurationService;
//# sourceMappingURL=ArchiveConfiguration.d.ts.map