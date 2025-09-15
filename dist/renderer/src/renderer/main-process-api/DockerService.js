/**
 * Service layer for Docker functionality
 * ALL window.mainProcess.docker calls MUST be encapsulated here
 */
export class DockerService {
    /**
     * Check Docker installation and status
     */
    static async checkStatus() {
        try {
            const response = await window.mainProcess.docker.checkStatus();
            return response.success && response.data ? response.data : null;
        }
        catch (error) {
            console.error('[DockerService] Failed to check Docker status:', error);
            return null;
        }
    }
    /**
     * Check if Knip Docker image exists
     */
    static async hasKnipImage() {
        try {
            const response = await window.mainProcess.docker.hasKnipImage();
            return response.success && response.hasImage ? response.hasImage : false;
        }
        catch (error) {
            console.error('[DockerService] Failed to check Knip image:', error);
            return false;
        }
    }
    /**
     * Pull a Docker image
     */
    static async pullImage(imageName) {
        try {
            const response = await window.mainProcess.docker.pullImage(imageName);
            return response.success;
        }
        catch (error) {
            console.error('[DockerService] Failed to pull Docker image:', error);
            return false;
        }
    }
    /**
     * Run Knip analysis in Docker
     */
    static async runKnip(projectPath, options) {
        try {
            const response = await window.mainProcess.docker.runKnip(projectPath, options);
            return response.success ? response.data : null;
        }
        catch (error) {
            console.error('[DockerService] Failed to run Knip in Docker:', error);
            return null;
        }
    }
    /**
     * Create custom Knip image
     */
    static async createKnipImage() {
        try {
            const response = await window.mainProcess.docker.createKnipImage();
            return response.success && response.data ? response.data : false;
        }
        catch (error) {
            console.error('[DockerService] Failed to create Knip image:', error);
            return false;
        }
    }
    /**
     * Start Knip container
     */
    static async startKnipContainer(projectPath) {
        try {
            const response = await window.mainProcess.docker.startKnipContainer(projectPath);
            return response.success && response.data ? response.data : null;
        }
        catch (error) {
            console.error('[DockerService] Failed to start Knip container:', error);
            return null;
        }
    }
    /**
     * Execute command in Knip container
     */
    static async execInContainer(command) {
        try {
            const response = await window.mainProcess.docker.execInContainer(command);
            return response.success ? response.data : null;
        }
        catch (error) {
            console.error('[DockerService] Failed to execute in container:', error);
            return null;
        }
    }
    /**
     * Stop Knip container
     */
    static async stopKnipContainer() {
        try {
            const response = await window.mainProcess.docker.stopKnipContainer();
            return response.success;
        }
        catch (error) {
            console.error('[DockerService] Failed to stop Knip container:', error);
            return false;
        }
    }
    /**
     * Get Docker installation instructions
     */
    static async getInstallInstructions() {
        try {
            const response = await window.mainProcess.docker.getInstallInstructions();
            return response.success && response.data ? response.data : null;
        }
        catch (error) {
            console.error('[DockerService] Failed to get install instructions:', error);
            return null;
        }
    }
    /**
     * Listen for Docker pull progress events
     * @returns Unsubscribe function
     */
    static onPullProgress(callback) {
        return window.mainProcess.docker.onPullProgress(callback);
    }
}
