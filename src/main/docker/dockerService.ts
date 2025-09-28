import { exec } from 'child_process';
import { promisify } from 'util';
import { EnvironmentConfig } from '../utils/environmentConfig';

const execAsync = promisify(exec);

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

export class DockerService {
  private static instance: DockerService;
  private dockerPath: string | null = null;

  private readonly DEFAULT_KNIP_IMAGE = 'node:18-alpine';
  private readonly CUSTOM_KNIP_IMAGE = 'principal-ade/knip:latest';
  private readonly DEFAULT_CONTAINER_NAME = 'principal-ade-knip-analyzer';

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  /**
   * Check Docker installation and status
   */
  async checkDockerStatus(): Promise<DockerStatus> {
    console.log('[DockerService] checkDockerStatus called');
    try {
      // Check if Docker is installed
      console.log('[DockerService] Finding Docker executable...');
      const dockerPath = await EnvironmentConfig.findExecutable('docker');
      console.log('[DockerService] Docker path:', dockerPath);

      if (!dockerPath) {
        console.log('[DockerService] Docker not found in PATH');
        return {
          installed: false,
          running: false,
          images: [],
          containers: [],
          error: 'Docker is not installed',
        };
      }

      this.dockerPath = dockerPath;

      // Get Docker version
      let version = 'unknown';
      try {
        console.log('[DockerService] Getting Docker version...');
        const versionCommand = `"${dockerPath}" --version`;
        console.log('[DockerService] Running command:', versionCommand);

        // Add timeout to prevent hanging
        const versionPromise = execAsync(versionCommand);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Docker version check timed out')),
            5000,
          ),
        );

        const { stdout: versionOutput } = (await Promise.race([
          versionPromise,
          timeoutPromise,
        ])) as { stdout: string };
        console.log('[DockerService] Docker version output:', versionOutput);

        const versionMatch = versionOutput.match(/Docker version ([\d.]+)/);
        if (versionMatch) {
          version = versionMatch[1];
        }
      } catch (error) {
        console.error('[DockerService] Failed to get Docker version:', error);
      }

      // Check if Docker daemon is running
      let running = false;
      let serverVersion = 'unknown';
      try {
        console.log('[DockerService] Checking if Docker daemon is running...');
        const infoCommand = `"${dockerPath}" info --format json`;
        console.log('[DockerService] Running command:', infoCommand);

        // Add timeout to prevent hanging
        const infoPromise = execAsync(infoCommand);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Docker info check timed out')),
            5000,
          ),
        );

        const { stdout: infoOutput } = (await Promise.race([
          infoPromise,
          timeoutPromise,
        ])) as { stdout: string };
        console.log('[DockerService] Docker info output received, parsing...');

        const info = JSON.parse(infoOutput);
        running = true;
        serverVersion = info.ServerVersion || 'unknown';
        console.log(
          '[DockerService] Docker daemon is running, version:',
          serverVersion,
        );
      } catch (error) {
        console.log(
          '[DockerService] Docker daemon is not running or not accessible:',
          error,
        );
        return {
          installed: true,
          running: false,
          version,
          images: [],
          containers: [],
          error: 'Docker daemon is not running',
        };
      }

      // Get Docker images
      console.log('[DockerService] Getting Docker images...');
      const images = await this.getDockerImages();
      console.log('[DockerService] Found', images.length, 'Docker images');

      // Get Docker containers
      console.log('[DockerService] Getting Docker containers...');
      const containers = await this.getDockerContainers();
      console.log(
        '[DockerService] Found',
        containers.length,
        'Docker containers',
      );

      const result = {
        installed: true,
        running,
        version,
        serverVersion,
        images,
        containers,
      };

      console.log('[DockerService] Docker status check complete:', result);
      return result;
    } catch (error) {
      console.error('Error checking Docker status:', error);
      return {
        installed: false,
        running: false,
        images: [],
        containers: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get list of Docker images
   */
  private async getDockerImages(): Promise<DockerImage[]> {
    if (!this.dockerPath) return [];

    try {
      console.log('[DockerService] Executing docker images command...');

      // Add timeout
      const imagesPromise = execAsync(
        `"${this.dockerPath}" images --format "{{.Repository}}|{{.Tag}}|{{.ID}}|{{.CreatedSince}}|{{.Size}}"`,
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Docker images command timed out')),
          5000,
        ),
      );

      const { stdout } = await Promise.race([imagesPromise, timeoutPromise]);

      return stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const [repository, tag, imageId, created, size] = line.split('|');
          return { repository, tag, imageId, created, size };
        });
    } catch (error) {
      console.error('Failed to get Docker images:', error);
      return [];
    }
  }

  /**
   * Get list of Docker containers
   */
  private async getDockerContainers(): Promise<DockerContainer[]> {
    if (!this.dockerPath) return [];

    try {
      console.log('[DockerService] Executing docker ps command...');

      // Add timeout
      const containersPromise = execAsync(
        `"${this.dockerPath}" ps -a --format "{{.ID}}|{{.Image}}|{{.Command}}|{{.CreatedAt}}|{{.Status}}|{{.Ports}}|{{.Names}}"`,
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Docker ps command timed out')),
          5000,
        ),
      );

      const { stdout } = await Promise.race([
        containersPromise,
        timeoutPromise,
      ]);

      return stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const [containerId, image, command, created, status, ports, names] =
            line.split('|');
          return {
            containerId,
            image,
            command,
            created,
            status,
            ports,
            names,
            isRunning: status.toLowerCase().includes('up'),
          };
        });
    } catch (error) {
      console.error('Failed to get Docker containers:', error);
      return [];
    }
  }

  /**
   * Pull a Docker image
   */
  async pullDockerImage(
    imageName: string,
    progressCallback?: (message: string) => void,
  ): Promise<boolean> {
    if (!this.dockerPath) {
      throw new Error('Docker is not installed');
    }

    try {
      progressCallback?.(`Pulling Docker image: ${imageName}`);

      const child = exec(`"${this.dockerPath}" pull ${imageName}`);

      return new Promise((resolve, reject) => {
        let output = '';

        child.stdout?.on('data', (data) => {
          output += data;
          progressCallback?.(data.toString());
        });

        child.stderr?.on('data', (data) => {
          output += data;
          progressCallback?.(data.toString());
        });

        child.on('close', (code) => {
          if (code === 0) {
            progressCallback?.(`Successfully pulled ${imageName}`);
            resolve(true);
          } else {
            reject(new Error(`Failed to pull image: ${output}`));
          }
        });
      });
    } catch (error) {
      console.error('Error pulling Docker image:', error);
      return false;
    }
  }

  /**
   * Check if Knip Docker image exists (custom or base Node image)
   */
  async hasKnipImage(): Promise<boolean> {
    const status = await this.checkDockerStatus();
    if (!status.installed || !status.running) return false;

    // Check for custom Knip image first
    const hasCustomImage = status.images.some(
      (img) => img.repository === 'principal-ade/knip' && img.tag === 'latest',
    );

    if (hasCustomImage) {
      return true;
    }

    // Fall back to checking for Node image
    return status.images.some(
      (img) => img.repository === 'node' && img.tag.includes('18-alpine'),
    );
  }

  /**
   * Check if we have the custom Knip image
   */
  async hasCustomKnipImage(): Promise<boolean> {
    const status = await this.checkDockerStatus();
    if (!status.installed || !status.running) return false;

    return status.images.some(
      (img) => img.repository === 'principal-ade/knip' && img.tag === 'latest',
    );
  }

  /**
   * Run Knip analysis in Docker container
   */
  async runKnipInDocker(
    projectPath: string,
    options?: {
      fix?: boolean;
      reporter?: 'json' | 'compact' | 'markdown';
      config?: string;
    },
  ): Promise<{ stdout: string; stderr: string }> {
    if (!this.dockerPath) {
      throw new Error('Docker is not installed');
    }

    // Check if we have custom Knip image
    const hasCustomImage = await this.hasCustomKnipImage();
    let imageToUse = this.DEFAULT_KNIP_IMAGE;
    let needsKnipInstall = true;

    if (hasCustomImage) {
      console.log('Using custom Knip Docker image');
      imageToUse = this.CUSTOM_KNIP_IMAGE;
      needsKnipInstall = false;
    } else {
      // Try to build custom image first
      console.log('Building custom Knip Docker image...');
      const built = await this.createCustomKnipImage();
      if (built) {
        imageToUse = this.CUSTOM_KNIP_IMAGE;
        needsKnipInstall = false;
      } else {
        // Fall back to regular Node image
        console.log('Using Node image, will install Knip on demand');
        const hasNodeImage = await this.hasKnipImage();
        if (!hasNodeImage) {
          console.log('Node Docker image not found, pulling...');
          await this.pullDockerImage(this.DEFAULT_KNIP_IMAGE);
        }
      }
    }

    // Build Docker command
    const dockerArgs = [
      'run',
      '--rm', // Remove container after execution
      '-v',
      `"${projectPath}:/project"`, // Mount project directory
      '-w',
      '/project', // Set working directory
      imageToUse,
    ];

    // Build Knip command
    const knipArgs = [];

    // Check if knip.json exists in the project directory
    const fs = require('fs');
    const path = require('path');
    const knipConfigPath = path.join(projectPath, 'knip.json');
    const hasKnipConfig = fs.existsSync(knipConfigPath);

    if (hasKnipConfig) {
      console.log('[Docker] Found knip.json config file');
      knipArgs.push('--config', 'knip.json');
    } else {
      console.log('[Docker] No knip.json found, using default config');
    }

    if (options?.reporter) {
      knipArgs.push('--reporter', options.reporter);
    }
    if (options?.fix) {
      knipArgs.push('--fix');
    }
    if (options?.config) {
      // Override with provided config if specified
      knipArgs[knipArgs.indexOf('--config') + 1] = options.config;
    }

    let command: string;
    if (needsKnipInstall) {
      // Need to install Knip first
      dockerArgs.push('sh', '-c');
      const shellCommand = `"npm install -g knip --silent > /dev/null 2>&1 && knip ${knipArgs.join(' ')}"`;
      command = `"${this.dockerPath}" ${dockerArgs.join(' ')} ${shellCommand}`;
    } else {
      // Knip is pre-installed in custom image
      dockerArgs.push('knip');
      dockerArgs.push(...knipArgs);
      command = `"${this.dockerPath}" ${dockerArgs.join(' ')}`;
    }

    try {
      const { stdout, stderr } = await execAsync(command);

      console.log('[Docker] Knip command executed');
      console.log('[Docker] Command was:', command);
      console.log('[Docker] stdout length:', stdout?.length || 0);
      console.log('[Docker] stderr length:', stderr?.length || 0);

      if (stderr) {
        console.log('[Docker] Knip stderr:', stderr);
      }

      if (stdout && stdout.length < 2000) {
        console.log('[Docker] Knip stdout:', stdout);
      } else if (stdout) {
        console.log(
          '[Docker] Knip stdout (first 1000 chars):',
          stdout.substring(0, 1000),
        );
      }

      // Parse JSON output if using JSON reporter
      if (options?.reporter === 'json') {
        try {
          return JSON.parse(stdout);
        } catch {
          return { stdout, stderr };
        }
      }

      return { stdout, stderr };
    } catch (error: unknown) {
      // Even if the command "fails" (exit code 1), it might still have useful output
      const errorObj = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      if (errorObj.stdout && options?.reporter === 'json') {
        try {
          return JSON.parse(errorObj.stdout);
        } catch {
          return {
            stdout: errorObj.stdout || '',
            stderr: errorObj.stderr || '',
          };
        }
      }
      throw error;
    }
  }

  /**
   * Create a custom Knip Docker image with pre-installed dependencies
   */
  async createCustomKnipImage(
    baseImage: string = 'node:18-alpine',
  ): Promise<boolean> {
    if (!this.dockerPath) {
      throw new Error('Docker is not installed');
    }

    // Create a Dockerfile content
    const dockerfileContent = `
FROM ${baseImage}

# Install git (needed for some Knip operations)
RUN apk add --no-cache git

# Install Knip and TypeScript globally
RUN npm install -g knip@latest typescript @types/node --silent

# Set working directory
WORKDIR /project

# Default command
ENTRYPOINT ["knip"]
`;

    // Save Dockerfile temporarily
    const tmpDir = require('os').tmpdir();
    const dockerfilePath = require('path').join(tmpDir, 'Dockerfile.knip');
    const fs = require('fs').promises;

    try {
      await fs.writeFile(dockerfilePath, dockerfileContent);

      // Build the Docker image
      const { stdout, stderr } = await execAsync(
        `"${this.dockerPath}" build -t principal-ade/knip:latest -f "${dockerfilePath}" "${tmpDir}"`
      );

      console.log('Docker build output:', stdout);
      if (stderr) console.error('Docker build stderr:', stderr);

      // Clean up
      await fs.unlink(dockerfilePath);

      return true;
    } catch (error) {
      console.error('Failed to create custom Knip image:', error);
      return false;
    }
  }

  /**
   * Run a Docker container in background for repeated Knip operations
   */
  async startKnipContainer(projectPath: string): Promise<string> {
    if (!this.dockerPath) {
      throw new Error('Docker is not installed');
    }

    // Stop existing container if running
    await this.stopKnipContainer();

    const command = `"${this.dockerPath}" run -d --name ${this.DEFAULT_CONTAINER_NAME} -v "${projectPath}:/project" -w /project ${this.DEFAULT_KNIP_IMAGE} tail -f /dev/null`;

    try {
      const { stdout } = await execAsync(command);
      return stdout.trim(); // Returns container ID
    } catch (error) {
      console.error('Failed to start Knip container:', error);
      throw error;
    }
  }

  /**
   * Execute Knip command in running container
   */
  async execInKnipContainer(
    command: string,
  ): Promise<{ stdout?: string; stderr?: string; error?: string }> {
    if (!this.dockerPath) {
      throw new Error('Docker is not installed');
    }

    const execCommand = `"${this.dockerPath}" exec ${this.DEFAULT_CONTAINER_NAME} ${command}`;

    try {
      const { stdout, stderr } = await execAsync(execCommand);
      return { stdout, stderr };
    } catch (error: unknown) {
      const errorObj = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      return {
        stdout: errorObj.stdout,
        stderr: errorObj.stderr,
        error: errorObj.message,
      };
    }
  }

  /**
   * Stop the Knip container
   */
  async stopKnipContainer(): Promise<void> {
    if (!this.dockerPath) return;

    try {
      await execAsync(
        `"${this.dockerPath}" stop ${this.DEFAULT_CONTAINER_NAME}`,
      );
      await execAsync(`"${this.dockerPath}" rm ${this.DEFAULT_CONTAINER_NAME}`);
    } catch {
      // Container might not exist, ignore error
    }
  }

  /**
   * Get Docker installation instructions based on platform
   */
  getInstallInstructions(): string {
    const platform = process.platform;

    switch (platform) {
      case 'darwin':
        return `
# Installing Docker on macOS

## Option 1: Docker Desktop (Recommended)
1. Visit https://www.docker.com/products/docker-desktop/
2. Download Docker Desktop for Mac
3. Install and run Docker Desktop
4. Verify installation: docker --version

## Option 2: Using Homebrew
\`\`\`bash
brew install --cask docker
\`\`\`
        `;

      case 'win32':
        return `
# Installing Docker on Windows

## Docker Desktop (Recommended)
1. Visit https://www.docker.com/products/docker-desktop/
2. Download Docker Desktop for Windows
3. Install and run Docker Desktop
4. Enable WSL 2 backend if prompted
5. Verify installation: docker --version
        `;

      case 'linux':
        return `
# Installing Docker on Linux

## Ubuntu/Debian:
\`\`\`bash
sudo apt-get update
sudo apt-get install docker.io
sudo systemctl start docker
sudo systemctl enable docker
\`\`\`

## Fedora/RHEL/CentOS:
\`\`\`bash
sudo dnf install docker
sudo systemctl start docker
sudo systemctl enable docker
\`\`\`

## Add your user to docker group:
\`\`\`bash
sudo usermod -aG docker $USER
\`\`\`

Then log out and back in for changes to take effect.
        `;

      default:
        return 'Please visit https://docs.docker.com/get-docker/ for installation instructions.';
    }
  }
}

export const dockerService = DockerService.getInstance();
