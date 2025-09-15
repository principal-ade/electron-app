export interface DockerStatus {
    installed: boolean;
    running: boolean;
    version?: string;
    serverVersion?: string;
    images: DockerImage[];
    containers: DockerContainer[];
    error?: string;
}
export interface DockerImage {
    repository: string;
    tag: string;
    imageId: string;
    created: string;
    size: string;
}
export interface DockerContainer {
    containerId: string;
    image: string;
    command: string;
    created: string;
    status: string;
    ports: string;
    names: string;
    isRunning: boolean;
}
export interface KnipDockerConfig {
    imageName: string;
    containerName: string;
    mountPath: string;
    knipVersion?: string;
}
export declare class DockerService {
    private static instance;
    private dockerPath;
    private readonly DEFAULT_KNIP_IMAGE;
    private readonly CUSTOM_KNIP_IMAGE;
    private readonly DEFAULT_CONTAINER_NAME;
    private constructor();
    static getInstance(): DockerService;
    /**
     * Check Docker installation and status
     */
    checkDockerStatus(): Promise<DockerStatus>;
    /**
     * Get list of Docker images
     */
    private getDockerImages;
    /**
     * Get list of Docker containers
     */
    private getDockerContainers;
    /**
     * Pull a Docker image
     */
    pullDockerImage(imageName: string, progressCallback?: (message: string) => void): Promise<boolean>;
    /**
     * Check if Knip Docker image exists (custom or base Node image)
     */
    hasKnipImage(): Promise<boolean>;
    /**
     * Check if we have the custom Knip image
     */
    hasCustomKnipImage(): Promise<boolean>;
    /**
     * Run Knip analysis in Docker container
     */
    runKnipInDocker(projectPath: string, options?: {
        fix?: boolean;
        reporter?: 'json' | 'compact' | 'markdown';
        config?: string;
    }): Promise<{
        stdout: string;
        stderr: string;
    }>;
    /**
     * Create a custom Knip Docker image with pre-installed dependencies
     */
    createCustomKnipImage(baseImage?: string): Promise<boolean>;
    /**
     * Run a Docker container in background for repeated Knip operations
     */
    startKnipContainer(projectPath: string): Promise<string>;
    /**
     * Execute Knip command in running container
     */
    execInKnipContainer(command: string): Promise<{
        stdout?: string;
        stderr?: string;
        error?: string;
    }>;
    /**
     * Stop the Knip container
     */
    stopKnipContainer(): Promise<void>;
    /**
     * Get Docker installation instructions based on platform
     */
    getInstallInstructions(): string;
}
export declare const dockerService: DockerService;
//# sourceMappingURL=dockerService.d.ts.map