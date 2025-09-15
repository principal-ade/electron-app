export interface KnipAutoConfig {
    entry: string[];
    project: string[];
    ignore: string[];
    ignoreDependencies: string[];
    webpack?: boolean;
    typescript?: boolean;
}
export declare class KnipConfigGenerator {
    /**
     * Detect project type and generate appropriate Knip config
     */
    static generateConfig(projectPath: string): Promise<KnipAutoConfig>;
    /**
     * Detect project type based on dependencies and file structure
     */
    private static detectProjectType;
    /**
     * Find entry points by scanning for common patterns
     */
    private static findEntryPoints;
    private static getElectronConfig;
    private static getNextConfig;
    private static getReactConfig;
    private static getVueConfig;
    private static getAngularConfig;
    private static getExpressConfig;
    private static getLibraryConfig;
    private static getGenericConfig;
    /**
     * Write config to temp file for Docker to use
     */
    static writeConfigToTemp(config: KnipAutoConfig, tempPath: string): Promise<string>;
}
//# sourceMappingURL=KnipConfigGenerator.d.ts.map