import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import { BrowserWindow } from 'electron';
import { EnvironmentConfig } from '../utils/environmentConfig';
import { StaticNamespaces } from '../../shared/types/namespaces.types';
import {
  getTypedStorageManager,
  TypedMultiStoreWrapper,
} from '../storage-providers';
import {
  ToolContainerState,
  DockerAnalysisSession,
  AnalysisToolConfig,
} from '../storage-providers/typed-namespaces';

const execAsync = promisify(exec);

/**
 * Optimized Docker service with container reuse and persistent tool containers
 */
export class OptimizedDockerService {
  private static instance: OptimizedDockerService;
  private dockerPath: string | null = null;
  private store: TypedMultiStoreWrapper;

  // Analysis tool configurations
  private readonly toolConfigs: Record<string, AnalysisToolConfig> = {
    knip: {
      toolName: 'knip',
      dockerImage: 'node:18-alpine',
      version: 'latest',
      installCommand:
        'npm install -g knip@latest typescript @types/node --silent',
      defaultCommand: ['knip', '--reporter', 'json'],
      configFiles: ['knip.json', 'knip.config.js'],
      supportedFrameworks: [
        'javascript',
        'typescript',
        'react',
        'vue',
        'angular',
      ],
      workingDirectory: '/workspace',
      mountStrategy: 'copy', // Copy files for isolation
    },
    eslint: {
      toolName: 'eslint',
      dockerImage: 'node:18-alpine',
      version: 'latest',
      installCommand: 'npm install -g eslint @eslint/js --silent',
      defaultCommand: ['eslint', '.', '--format', 'json'],
      configFiles: ['eslint.config.js', '.eslintrc.json', '.eslintrc.js'],
      supportedFrameworks: ['javascript', 'typescript', 'react', 'vue'],
      workingDirectory: '/workspace',
      mountStrategy: 'read-only',
    },
  };

  private constructor(store: TypedMultiStoreWrapper) {
    this.store = store;
  }

  static async getInstance(): Promise<OptimizedDockerService> {
    if (!OptimizedDockerService.instance) {
      const store = await getTypedStorageManager();
      OptimizedDockerService.instance = new OptimizedDockerService(store);
    }
    return OptimizedDockerService.instance;
  }

  /**
   * Initialize Docker path detection
   */
  async initialize(): Promise<void> {
    console.log(`[OptimizedDockerService] Initializing Docker service...`);
    console.log(`[OptimizedDockerService] Searching for Docker executable...`);

    this.dockerPath = await EnvironmentConfig.findExecutable('docker');
    console.log(
      `[OptimizedDockerService] Docker path from EnvironmentConfig: ${this.dockerPath}`,
    );

    // If not found through standard method, try Docker-specific paths
    if (!this.dockerPath) {
      console.log(
        `[OptimizedDockerService] Standard search failed, trying Docker-specific paths...`,
      );
      this.dockerPath = await this.findDockerExecutable();
    }

    if (!this.dockerPath) {
      throw new Error(
        'Docker is not installed or not found in PATH. Please install Docker Desktop or Docker Engine.',
      );
    }

    console.log(`[OptimizedDockerService] Docker found at: ${this.dockerPath}`);

    // Test Docker is working
    try {
      const { stdout } = await execAsync(`"${this.dockerPath}" --version`);
      console.log(`[OptimizedDockerService] Docker version: ${stdout.trim()}`);

      // Check if Docker daemon is running
      await execAsync(`"${this.dockerPath}" info`);
      console.log(`[OptimizedDockerService] Docker daemon is running`);
    } catch (error) {
      console.error(`[OptimizedDockerService] Docker check failed:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Cannot connect to the Docker daemon')) {
        throw new Error(
          'Docker is installed but not running. Please start Docker Desktop or Docker daemon.',
        );
      } else {
        throw new Error(
          `Docker found at ${this.dockerPath} but is not working properly. Error: ${errorMessage}`,
        );
      }
    }

    console.log(
      `[OptimizedDockerService] Docker initialization completed successfully`,
    );
  }

  /**
   * Find Docker executable in Docker-specific installation paths
   */
  private async findDockerExecutable(): Promise<string | null> {
    const fs = require('fs/promises');
    const { constants: fsConstants } = require('fs');

    const dockerPaths = [];

    if (process.platform === 'darwin') {
      // macOS Docker Desktop paths
      dockerPaths.push(
        '/Applications/Docker.app/Contents/Resources/bin/docker',
        '/usr/local/bin/docker',
        '/opt/homebrew/bin/docker',
      );
    } else if (process.platform === 'win32') {
      // Windows Docker Desktop paths
      dockerPaths.push(
        'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
        'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
        path.join(
          os.homedir(),
          'AppData\\Local\\Docker\\resources\\bin\\docker.exe',
        ),
      );
    } else {
      // Linux paths
      dockerPaths.push(
        '/usr/bin/docker',
        '/usr/local/bin/docker',
        '/snap/bin/docker',
      );
    }

    for (const dockerPath of dockerPaths) {
      try {
        await fs.access(dockerPath, fsConstants.X_OK);
        console.log(`[OptimizedDockerService] Found Docker at: ${dockerPath}`);
        return dockerPath;
      } catch {
        // Continue checking other paths
      }
    }

    return null;
  }

  /**
   * Send progress event to renderer
   */
  private sendProgress(message: string, percent?: number): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('docker:progress', { message, percent });
    }
    console.log(
      `[OptimizedDockerService] Progress: ${message}${percent ? ` (${percent}%)` : ''}`,
    );
  }

  /**
   * Execute command with timeout
   */
  private async execWithTimeout(
    command: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      execAsync(command)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Run analysis with persistent container reuse
   */
  async runAnalysis(
    toolName: string,
    projectPath: string,
    options?: {
      reporter?: string;
      config?: string;
      fix?: boolean;
    },
  ): Promise<DockerAnalysisSession> {
    const sessionId = uuidv4();
    const startTime = Date.now();

    console.log(
      `[OptimizedDockerService] Starting analysis - Tool: ${toolName}, Project: ${projectPath}, Session: ${sessionId}`,
    );

    // Validate project path
    if (!projectPath || projectPath.trim() === '') {
      const error = 'Project path is required for analysis';
      console.error(`[OptimizedDockerService] ${error}`);
      this.sendProgress(error, 0);
      throw new Error(error);
    }

    // Create session record
    const session: DockerAnalysisSession = {
      id: sessionId,
      toolName,
      containerId: '',
      repositoryUrl: '', // Will be set by caller if available
      packagePath: projectPath,
      status: 'preparing',
      startTime,
      configSource: 'default',
      commandExecuted: '',
      metrics: {},
    };

    try {
      console.log(`[OptimizedDockerService] Saving initial session state...`);
      // Save initial session state
      const sessionResult = await this.store.set(
        sessionId,
        session,
        StaticNamespaces.DOCKER_SESSIONS,
      );
      if (!sessionResult.success) {
        throw new Error(
          `Failed to save session: ${sessionResult.error?.message}`,
        );
      }
      console.log(
        `[OptimizedDockerService] Initial session saved successfully`,
      );

      // Get or create persistent container
      console.log(
        `[OptimizedDockerService] Getting or creating container for tool: ${toolName}`,
      );
      this.sendProgress('Preparing Docker container...', 20);
      session.status = 'preparing';
      const container = await this.getOrCreateToolContainer(toolName);
      session.containerId = container.containerId;
      console.log(
        `[OptimizedDockerService] Container acquired: ${container.containerId}`,
      );
      console.log(
        `[OptimizedDockerService] Container status: ${container.status}`,
      );
      console.log(
        `[OptimizedDockerService] Container created: ${new Date(container.created).toISOString()}`,
      );
      console.log(
        `[OptimizedDockerService] Container metrics:`,
        container.metrics,
      );

      // Update container state
      console.log(
        `[OptimizedDockerService] Updating container state to busy...`,
      );
      container.status = 'busy';
      container.currentSession = {
        sessionId,
        projectPath,
        startTime,
      };
      const containerResult = await this.store.set(
        container.id,
        container,
        StaticNamespaces.DOCKER_CONTAINERS,
      );
      if (!containerResult.success) {
        throw new Error(
          `Failed to save container state: ${containerResult.error?.message}`,
        );
      }
      console.log(
        `[OptimizedDockerService] Container state updated successfully`,
      );

      // Prepare analysis command
      console.log(`[OptimizedDockerService] Preparing analysis command...`);
      session.status = 'mounting';
      const toolConfig = this.toolConfigs[toolName];
      if (!toolConfig) {
        throw new Error(`Unknown tool: ${toolName}`);
      }
      console.log(`[OptimizedDockerService] Tool config found:`, {
        toolName: toolConfig.toolName,
        dockerImage: toolConfig.dockerImage,
        workingDirectory: toolConfig.workingDirectory,
      });

      const prepStartTime = Date.now();

      // Copy project files to container workspace
      console.log(
        `[OptimizedDockerService] Copying project files from ${projectPath} to container ${container.containerId}...`,
      );
      this.sendProgress('Copying project files to container...', 40);
      await this.copyProjectToContainer(container.containerId, projectPath);

      session.metrics.preparationTime = Date.now() - prepStartTime;
      session.metrics.mountTime = session.metrics.preparationTime;
      console.log(
        `[OptimizedDockerService] File copy completed in ${session.metrics.preparationTime}ms`,
      );

      // Detect configuration
      console.log(
        `[OptimizedDockerService] Detecting project configuration...`,
      );
      const configResult = await this.detectProjectConfiguration(
        container.containerId,
        toolConfig,
      );
      session.configSource = configResult.source;
      session.configUsed = configResult.config;
      console.log(`[OptimizedDockerService] Configuration detected:`, {
        source: configResult.source,
        hasConfig: !!configResult.config,
      });

      // Build analysis command
      console.log(`[OptimizedDockerService] Building analysis command...`);
      const command = this.buildAnalysisCommand(
        toolConfig,
        options,
        configResult,
      );
      session.commandExecuted = command.join(' ');
      session.status = 'running';
      console.log(
        `[OptimizedDockerService] Command built: ${session.commandExecuted}`,
      );

      // Execute analysis
      console.log(
        `[OptimizedDockerService] Executing analysis command in container...`,
      );
      this.sendProgress('Running Knip analysis...', 60);
      const execStartTime = Date.now();
      const result = await this.executeInContainer(
        container.containerId,
        command,
      );
      session.metrics.executionTime = Date.now() - execStartTime;
      console.log(
        `[OptimizedDockerService] Analysis completed in ${session.metrics.executionTime}ms`,
      );
      console.log(`[OptimizedDockerService] Analysis result:`, {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length,
      });

      // Process results
      session.output = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };

      if (result.exitCode === 0 || (result.stdout && toolName === 'knip')) {
        // Knip can have exit code 1 but still return valid results
        this.sendProgress('Processing results...', 80);
        session.status = 'completed';
        session.results = this.parseAnalysisResults(toolName, result.stdout);
        this.sendProgress('Analysis completed successfully!', 100);
      } else {
        session.status = 'failed';
        session.error =
          result.stderr || 'Analysis failed with no error message';
        this.sendProgress('Analysis failed', 0);
      }

      session.endTime = Date.now();
      session.metrics.totalTime = session.endTime - session.startTime;

      // Update container metrics
      container.metrics.totalAnalyses++;
      container.metrics.avgExecutionTime =
        (container.metrics.avgExecutionTime *
          (container.metrics.totalAnalyses - 1) +
          (session.metrics.executionTime || 0)) /
        container.metrics.totalAnalyses;
      container.lastUsed = Date.now();
      container.status = 'ready';
      container.currentSession = undefined;
    } catch (error) {
      console.error(`[OptimizedDockerService] Analysis failed:`, error);
      console.error(`[OptimizedDockerService] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        sessionId,
        toolName,
        projectPath,
      });

      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      session.endTime = Date.now();
      session.metrics.totalTime = session.endTime - session.startTime;

      console.log(
        `[OptimizedDockerService] Releasing container after error...`,
      );
      // Release container
      if (session.containerId) {
        const container = await this.getContainerState(session.containerId);
        if (container) {
          container.status = 'ready';
          container.currentSession = undefined;
          container.metrics.errorCount++;
          const containerResult = await this.store.set(
            container.id,
            container,
            StaticNamespaces.DOCKER_CONTAINERS,
          );
          if (!containerResult.success) {
            console.error(
              `[OptimizedDockerService] Failed to save container state after error:`,
              containerResult.error,
            );
          } else {
            console.log(
              `[OptimizedDockerService] Container released successfully after error`,
            );
          }
        }
      }
    }

    // Save final session state
    const finalSessionResult = await this.store.set(
      sessionId,
      session,
      StaticNamespaces.DOCKER_SESSIONS,
    );
    if (!finalSessionResult.success) {
      console.error(
        'Failed to save final session state:',
        finalSessionResult.error,
      );
    }
    return session;
  }

  /**
   * Get or create a persistent tool container
   */
  private async getOrCreateToolContainer(
    toolName: string,
  ): Promise<ToolContainerState> {
    console.log(
      `[OptimizedDockerService] Looking for existing ${toolName} container...`,
    );

    // Look for existing ready container for this tool
    const containerStates = await this.store
      .namespace(StaticNamespaces.DOCKER_CONTAINERS)
      .getAll();
    console.log(
      `[OptimizedDockerService] Found ${Object.keys(containerStates).length} containers in storage`,
    );

    for (const [id, container] of Object.entries(containerStates)) {
      console.log(
        `[OptimizedDockerService] Checking container ${id}: tool=${container.toolName}, status=${container.status}`,
      );

      if (container.toolName === toolName && container.status === 'ready') {
        console.log(
          `[OptimizedDockerService] Found ready ${toolName} container: ${container.containerId}`,
        );
        console.log(
          `[OptimizedDockerService] Verifying container ${container.containerId} is still running...`,
        );

        // Verify container is still running
        if (await this.isContainerRunning(container.containerId)) {
          console.log(
            `[OptimizedDockerService] Container ${container.containerId} verified as running, reusing it`,
          );
          return container;
        } else {
          console.log(
            `[OptimizedDockerService] Container ${container.containerId} is stopped, removing from store`,
          );
          // Container stopped, remove from store
          const deleteResult = await this.store.delete(
            id,
            StaticNamespaces.DOCKER_CONTAINERS,
          );
          if (!deleteResult.success) {
            console.warn(
              `Failed to delete container ${id}:`,
              deleteResult.error,
            );
          }
        }
      }
    }

    // Create new persistent container
    console.log(
      `[OptimizedDockerService] No ready ${toolName} container found, creating new one...`,
    );
    return this.createPersistentToolContainer(toolName);
  }

  /**
   * Create a new persistent tool container
   */
  private async createPersistentToolContainer(
    toolName: string,
  ): Promise<ToolContainerState> {
    console.log(
      `[OptimizedDockerService] Creating new persistent container for ${toolName}...`,
    );

    const toolConfig = this.toolConfigs[toolName];
    if (!toolConfig) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    if (!this.dockerPath) {
      throw new Error('Docker path not initialized');
    }

    // Create long-running container
    const containerName = `${toolName}-persistent-${Date.now()}`;
    console.log(
      `[OptimizedDockerService] Creating container with name: ${containerName}`,
    );
    console.log(
      `[OptimizedDockerService] Using image: ${toolConfig.dockerImage}`,
    );
    console.log(
      `[OptimizedDockerService] Working directory: ${toolConfig.workingDirectory}`,
    );

    this.sendProgress(
      'Creating Docker container (this may take a few minutes on first run)...',
      25,
    );

    const createCommand = `"${this.dockerPath}" run -d --name ${containerName} --workdir ${toolConfig.workingDirectory} ${toolConfig.dockerImage} tail -f /dev/null`;
    console.log(
      `[OptimizedDockerService] Docker create command: ${createCommand}`,
    );

    // Add timeout for container creation (5 minutes for image pull)
    const { stdout } = await this.execWithTimeout(createCommand, 300000);

    const containerId = stdout.trim();
    console.log(
      `[OptimizedDockerService] Container created with ID: ${containerId}`,
    );

    // Install tool in container
    if (toolConfig.installCommand) {
      console.log(
        `[OptimizedDockerService] Installing ${toolName} in container...`,
      );
      console.log(
        `[OptimizedDockerService] Install command: ${toolConfig.installCommand}`,
      );

      this.sendProgress(`Installing ${toolName} in container...`, 30);

      const installCommand = `"${this.dockerPath}" exec ${containerId} sh -c "${toolConfig.installCommand}"`;
      console.log(
        `[OptimizedDockerService] Full install command: ${installCommand}`,
      );

      // Add timeout for tool installation (3 minutes)
      await this.execWithTimeout(installCommand, 180000);
      console.log(`[OptimizedDockerService] Tool installation completed`);
      this.sendProgress(`${toolName} installed successfully`, 35);
    }

    // Create container state
    console.log(`[OptimizedDockerService] Creating container state record...`);
    const containerState: ToolContainerState = {
      id: uuidv4(),
      toolName,
      containerId,
      imageId: toolConfig.dockerImage,
      status: 'ready',
      created: Date.now(),
      lastUsed: Date.now(),
      metrics: {
        totalAnalyses: 0,
        avgExecutionTime: 0,
        uptime: 0,
        errorCount: 0,
      },
    };

    // Save to store
    console.log(
      `[OptimizedDockerService] Saving container state to storage...`,
    );
    const saveResult = await this.store.set(
      containerState.id,
      containerState,
      StaticNamespaces.DOCKER_CONTAINERS,
    );
    if (!saveResult.success) {
      throw new Error(
        `Failed to save container state: ${saveResult.error?.message}`,
      );
    }
    console.log(`[OptimizedDockerService] Container state saved successfully`);

    console.log(
      `[OptimizedDockerService] Persistent container created and ready:`,
      {
        id: containerState.id,
        containerId: containerState.containerId,
        toolName: containerState.toolName,
        status: containerState.status,
      },
    );

    return containerState;
  }

  /**
   * Copy project files to container workspace
   */
  private async copyProjectToContainer(
    containerId: string,
    projectPath: string,
  ): Promise<void> {
    if (!this.dockerPath) {
      throw new Error('Docker path not initialized');
    }

    console.log(
      `[OptimizedDockerService] Cleaning workspace in container ${containerId}...`,
    );
    // Clean workspace
    const cleanCommand = `"${this.dockerPath}" exec ${containerId} rm -rf /workspace/*`;
    console.log(`[OptimizedDockerService] Clean command: ${cleanCommand}`);
    await execAsync(cleanCommand);
    console.log(`[OptimizedDockerService] Workspace cleaned`);

    // Copy project files
    console.log(
      `[OptimizedDockerService] Copying files from ${projectPath} to container workspace...`,
    );
    const copyCommand = `"${this.dockerPath}" cp "${projectPath}/." ${containerId}:/workspace/`;
    console.log(`[OptimizedDockerService] Copy command: ${copyCommand}`);
    await execAsync(copyCommand);
    console.log(`[OptimizedDockerService] Files copied successfully`);
  }

  /**
   * Detect project configuration for the tool
   */
  private async detectProjectConfiguration(
    containerId: string,
    toolConfig: AnalysisToolConfig,
  ): Promise<{
    source: 'repository' | 'generated' | 'default';
    config?: unknown;
  }> {
    if (!this.dockerPath) {
      throw new Error('Docker path not initialized');
    }

    // Check for existing config files
    for (const configFile of toolConfig.configFiles) {
      try {
        await execAsync(
          `"${this.dockerPath}" exec ${containerId} test -f /workspace/${configFile}`,
        );
        // Config file exists
        const { stdout } = await execAsync(
          `"${this.dockerPath}" exec ${containerId} cat /workspace/${configFile}`,
        );
        return {
          source: 'repository',
          config: this.parseConfigFile(configFile, stdout),
        };
      } catch {
        // Config file doesn't exist, continue
      }
    }

    // Generate default config based on detected framework
    const detectedFramework = await this.detectFramework(containerId);
    const generatedConfig = this.generateDefaultConfig(
      toolConfig.toolName,
      detectedFramework,
    );

    if (generatedConfig) {
      return {
        source: 'generated',
        config: generatedConfig,
      };
    }

    return { source: 'default' };
  }

  /**
   * Detect project framework
   */
  private async detectFramework(containerId: string): Promise<string | null> {
    if (!this.dockerPath) {
      throw new Error('Docker path not initialized');
    }

    try {
      const { stdout } = await execAsync(
        `"${this.dockerPath}" exec ${containerId} cat /workspace/package.json`,
      );
      const packageJson = JSON.parse(stdout);

      // Simple framework detection based on dependencies
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (deps.react || deps['@types/react']) return 'react';
      if (deps.vue || deps['@vue/core']) return 'vue';
      if (deps['@angular/core']) return 'angular';
      if (deps.typescript || deps['@types/node']) return 'typescript';

      return 'javascript';
    } catch {
      return null;
    }
  }

  /**
   * Generate default configuration for a tool
   */
  private generateDefaultConfig(
    toolName: string,
    framework: string | null,
  ): unknown {
    switch (toolName) {
      case 'knip':
        return {
          entry: ['src/index.ts', 'src/index.js', 'index.ts', 'index.js'],
          project: ['src/**/*.{ts,tsx,js,jsx}'],
          ignore: ['dist/**', 'build/**', 'node_modules/**'],
        };

      case 'eslint':
        return {
          extends:
            framework === 'typescript'
              ? ['@eslint/js', '@typescript-eslint/recommended']
              : ['@eslint/js'],
          rules: {
            'no-unused-vars': 'warn',
            'no-console': 'warn',
          },
        };

      default:
        return null;
    }
  }

  /**
   * Parse configuration file content
   */
  private parseConfigFile(filename: string, content: string): unknown {
    try {
      if (filename.endsWith('.json')) {
        return JSON.parse(content);
      }
      // For .js files, we'd need more sophisticated parsing
      return { raw: content };
    } catch {
      return { raw: content };
    }
  }

  /**
   * Build analysis command with options
   */
  private buildAnalysisCommand(
    toolConfig: AnalysisToolConfig,
    options?: {
      reporter?: string;
      fix?: boolean;
    },
    configResult?: {
      source: 'repository' | 'generated' | 'default';
      config?: unknown;
    },
  ): string[] {
    const command = [...toolConfig.defaultCommand];

    // Add tool-specific options
    if (toolConfig.toolName === 'knip') {
      if (configResult?.source === 'repository' && configResult.config) {
        // Use existing config file
        const configFile = toolConfig.configFiles.find(
          (f) => configResult.config && typeof configResult.config === 'object',
        );
        if (configFile) {
          command.push('--config', configFile);
        }
      }

      if (options?.reporter) {
        command.push('--reporter', options.reporter);
      }

      if (options?.fix) {
        command.push('--fix');
      }
    }

    return command;
  }

  /**
   * Execute command in container
   */
  private async executeInContainer(
    containerId: string,
    command: string[],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.dockerPath) {
      throw new Error('Docker path not initialized');
    }

    const fullCommand = `"${this.dockerPath}" exec -w /workspace ${containerId} ${command.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand);
      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const errorObj = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
        code?: number;
      };
      return {
        stdout: errorObj.stdout || '',
        stderr: errorObj.stderr || errorObj.message || 'Unknown error',
        exitCode: errorObj.code || 1,
      };
    }
  }

  /**
   * Parse analysis results based on tool type
   */
  private parseAnalysisResults(toolName: string, output: string): unknown {
    try {
      switch (toolName) {
        case 'knip':
        case 'eslint':
          return JSON.parse(output);

        default:
          return { raw: output };
      }
    } catch {
      return { raw: output };
    }
  }

  /**
   * Check if container is running
   */
  private async isContainerRunning(containerId: string): Promise<boolean> {
    if (!this.dockerPath) {
      return false;
    }

    try {
      const { stdout } = await execAsync(
        `"${this.dockerPath}" ps -q --filter id=${containerId}`,
      );
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get container state from store
   */
  private async getContainerState(
    containerId: string,
  ): Promise<ToolContainerState | null> {
    const containerStates = await this.store
      .namespace(StaticNamespaces.DOCKER_CONTAINERS)
      .getAll();

    for (const container of Object.values(containerStates)) {
      if (container.containerId === containerId) {
        return container;
      }
    }

    return null;
  }

  /**
   * Cleanup stopped containers from store
   */
  async cleanupStoppedContainers(): Promise<void> {
    const containerStates = await this.store
      .namespace(StaticNamespaces.DOCKER_CONTAINERS)
      .getAll();

    for (const [id, container] of Object.entries(containerStates)) {
      if (!(await this.isContainerRunning(container.containerId))) {
        await this.store.delete(id, StaticNamespaces.DOCKER_CONTAINERS);
      }
    }
  }

  /**
   * Get all active tool containers
   */
  async getActiveContainers(): Promise<ToolContainerState[]> {
    const containerStates = await this.store
      .namespace(StaticNamespaces.DOCKER_CONTAINERS)
      .getAll();
    const activeContainers: ToolContainerState[] = [];

    for (const container of Object.values(containerStates)) {
      if (await this.isContainerRunning(container.containerId)) {
        activeContainers.push(container);
      }
    }

    return activeContainers;
  }

  /**
   * Get analysis session history
   */
  async getSessionHistory(limit?: number): Promise<DockerAnalysisSession[]> {
    const sessions = await this.store
      .namespace(StaticNamespaces.DOCKER_SESSIONS)
      .getAll();
    const sessionList = Object.values(sessions);

    // Sort by start time, most recent first
    sessionList.sort((a, b) => b.startTime - a.startTime);

    return limit ? sessionList.slice(0, limit) : sessionList;
  }

  /**
   * Stop all tool containers
   */
  async stopAllContainers(): Promise<void> {
    const containers = await this.getActiveContainers();

    for (const container of containers) {
      try {
        if (this.dockerPath) {
          await execAsync(`"${this.dockerPath}" stop ${container.containerId}`);
          await execAsync(`"${this.dockerPath}" rm ${container.containerId}`);
        }
      } catch (error) {
        console.warn(
          `Failed to stop container ${container.containerId}:`,
          error,
        );
      }

      // Remove from store
      const deleteResult = await this.store.delete(
        container.id,
        StaticNamespaces.DOCKER_CONTAINERS,
      );
      if (!deleteResult.success) {
        console.warn(
          `Failed to delete container ${container.id}:`,
          deleteResult.error,
        );
      }
    }
  }
}

export const optimizedDockerService = OptimizedDockerService.getInstance();
