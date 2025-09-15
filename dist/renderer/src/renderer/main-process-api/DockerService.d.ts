import { DockerStatus, DockerResponse, DockerImageCheckResponse, DockerPullResponse, DockerInstallInstructions } from '../../shared/main-process-api-interfaces/DockerAPI';
/**
 * Service layer for Docker functionality
 * ALL window.mainProcess.docker calls MUST be encapsulated here
 */
export declare class DockerService {
    /**
     * Check Docker installation and status
     */
    static checkStatus(): Promise<DockerStatus | null>;
    /**
     * Check if Knip Docker image exists
     */
    static hasKnipImage(): Promise<boolean>;
    /**
     * Pull a Docker image
     */
    static pullImage(imageName: string): Promise<boolean>;
    /**
     * Run Knip analysis in Docker
     */
    static runKnip(projectPath: string, options?: any): Promise<any>;
    /**
     * Create custom Knip image
     */
    static createKnipImage(): Promise<boolean>;
    /**
     * Start Knip container
     */
    static startKnipContainer(projectPath: string): Promise<string | null>;
    /**
     * Execute command in Knip container
     */
    static execInContainer(command: string): Promise<any>;
    /**
     * Stop Knip container
     */
    static stopKnipContainer(): Promise<boolean>;
    /**
     * Get Docker installation instructions
     */
    static getInstallInstructions(): Promise<DockerInstallInstructions | null>;
    /**
     * Listen for Docker pull progress events
     * @returns Unsubscribe function
     */
    static onPullProgress(callback: (data: {
        imageName: string;
        message: string;
    }) => void): () => void;
}
export type { DockerStatus, DockerResponse, DockerImageCheckResponse, DockerPullResponse, DockerInstallInstructions, };
//# sourceMappingURL=DockerService.d.ts.map