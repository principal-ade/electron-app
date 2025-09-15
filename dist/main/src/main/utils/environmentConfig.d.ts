/**
 * Environment configuration to ensure dev/prod parity
 */
export declare class EnvironmentConfig {
    private static _forceProductionPaths;
    private static _hasWarnedAboutUnsafeMode;
    private static _isPackagedSimulation;
    /**
     * Get user data path that works consistently in dev and prod
     */
    static getUserDataPath(): string;
    /**
     * Get assets path that works in both environments
     */
    static getAssetsPath(...paths: string[]): string;
    static getHomeDir(): string;
    static expandHome(filePath: string): string;
    static getPlatformHomeLocalBinPath(): string;
    /**
     * Check if we should use production constraints in dev
     */
    static shouldUseProductionConstraints(): boolean;
    /**
     * Check if we're simulating a packaged environment
     */
    static isPackagedOrSimulated(): boolean;
    /**
     * Execute command with production constraints
     */
    static executeCommand(command: string, args?: string[]): Promise<{
        stdout: string;
        stderr: string;
    }>;
    /**
     * Log warnings for production-incompatible code
     */
    static warnIfProductionIncompatible(feature: string): void;
    /**
     * Find executable in production-safe way
     */
    static findExecutable(execName: string): Promise<string | null>;
}
//# sourceMappingURL=environmentConfig.d.ts.map