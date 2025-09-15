import { ToolContainerState, DockerAnalysisSession } from '../storage-providers/typed-namespaces';
/**
 * Optimized Docker service with container reuse and persistent tool containers
 */
export declare class OptimizedDockerService {
    private static instance;
    private dockerPath;
    private store;
    private readonly toolConfigs;
    private constructor();
    static getInstance(): Promise<OptimizedDockerService>;
    /**
     * Initialize Docker path detection
     */
    initialize(): Promise<void>;
    /**
     * Find Docker executable in Docker-specific installation paths
     */
    private findDockerExecutable;
    /**
     * Send progress event to renderer
     */
    private sendProgress;
    /**
     * Execute command with timeout
     */
    private execWithTimeout;
    /**
     * Run analysis with persistent container reuse
     */
    runAnalysis(toolName: string, projectPath: string, options?: {
        reporter?: string;
        config?: string;
        fix?: boolean;
    }): Promise<DockerAnalysisSession>;
    /**
     * Get or create a persistent tool container
     */
    private getOrCreateToolContainer;
    /**
     * Create a new persistent tool container
     */
    private createPersistentToolContainer;
    /**
     * Copy project files to container workspace
     */
    private copyProjectToContainer;
    /**
     * Detect project configuration for the tool
     */
    private detectProjectConfiguration;
    /**
     * Detect project framework
     */
    private detectFramework;
    /**
     * Generate default configuration for a tool
     */
    private generateDefaultConfig;
    /**
     * Parse configuration file content
     */
    private parseConfigFile;
    /**
     * Build analysis command with options
     */
    private buildAnalysisCommand;
    /**
     * Execute command in container
     */
    private executeInContainer;
    /**
     * Parse analysis results based on tool type
     */
    private parseAnalysisResults;
    /**
     * Check if container is running
     */
    private isContainerRunning;
    /**
     * Get container state from store
     */
    private getContainerState;
    /**
     * Cleanup stopped containers from store
     */
    cleanupStoppedContainers(): Promise<void>;
    /**
     * Get all active tool containers
     */
    getActiveContainers(): Promise<ToolContainerState[]>;
    /**
     * Get analysis session history
     */
    getSessionHistory(limit?: number): Promise<DockerAnalysisSession[]>;
    /**
     * Stop all tool containers
     */
    stopAllContainers(): Promise<void>;
}
export declare const optimizedDockerService: Promise<OptimizedDockerService>;
//# sourceMappingURL=OptimizedDockerService.d.ts.map