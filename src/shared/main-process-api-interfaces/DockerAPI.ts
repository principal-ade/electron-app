/**
 * Docker-related types
 */
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

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  serverVersion?: string;
  images: DockerImage[];
  containers: DockerContainer[];
  error?: string;
}

export interface DockerResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DockerImageCheckResponse {
  success: boolean;
  hasImage?: boolean;
  error?: string;
}

export interface DockerPullResponse {
  success: boolean;
  error?: string;
}

export interface DockerInstallInstructions {
  platform: string;
  steps: string[];
  downloadUrl: string;
}

export interface KnipRunOptions {
  reporter?: string;
  fix?: boolean;
  config?: string;
}

/**
 * DockerAPI - Handles Docker operations
 */
export interface DockerAPI {
  /**
   * Check Docker installation and status
   */
  checkStatus(): Promise<DockerResponse<DockerStatus>>;

  /**
   * Check if a specific Docker image exists
   */
  hasKnipImage(): Promise<DockerImageCheckResponse>;

  /**
   * Pull a Docker image
   */
  pullImage(imageName: string): Promise<DockerPullResponse>;

  /**
   * Run Knip analysis in Docker
   */
  runKnip(
    projectPath: string,
    options?: KnipRunOptions,
  ): Promise<DockerResponse>;

  /**
   * Create custom Knip image
   */
  createKnipImage(): Promise<DockerResponse<boolean>>;

  /**
   * Start Knip container
   */
  startKnipContainer(projectPath: string): Promise<DockerResponse<string>>;

  /**
   * Execute command in Knip container
   */
  execInContainer(command: string): Promise<DockerResponse>;

  /**
   * Stop Knip container
   */
  stopKnipContainer(): Promise<DockerResponse>;

  /**
   * Get Docker installation instructions
   */
  getInstallInstructions(): Promise<DockerResponse<DockerInstallInstructions>>;

  /**
   * Listen for Docker pull progress events
   */
  onPullProgress(
    callback: (data: { imageName: string; message: string }) => void,
  ): () => void;
}
