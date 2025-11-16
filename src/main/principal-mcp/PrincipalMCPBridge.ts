import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { EventEmitter } from 'events';
import { MemoryPalace, NodeFileSystemAdapter } from '@a24z/core-library';
import type {
  CreateTaskInput,
  ValidatedRepositoryPath,
  ValidatedRelativePath,
} from '@a24z/core-library';
import { APP_BRANDING } from '../../shared/config/appBranding';
import { getManager as getRepositoryMonitoringManager } from '../repository-monitoring/ipcHandlers';
import { MCPTasksDomain } from '../services/storage-domains/MCPTasksDomain';
import { getTypedStorageManager } from '../storage-providers';

interface SubmitDependencyTaskRequest {
  dependencyId: string;
  repositoryRoot?: string;
  taskSummary: string;
  taskDetails: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  tags?: string[];
  anchors?: string[];
}

export class PrincipalMCPBridge extends EventEmitter {
  private app: express.Application;
  private server: Server | null = null;
  private port: number = APP_BRANDING.BRIDGE_PORTS.PRINCIPAL_MCP || 3043;
  private mcpTasksDomain: MCPTasksDomain | null = null;

  constructor(startPort?: number) {
    super();
    this.app = express();
    this.port = startPort || APP_BRANDING.BRIDGE_PORTS.PRINCIPAL_MCP || 3043;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS headers
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept',
      );

      if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[Principal MCP Bridge] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Shared handler for task submission endpoints.
   * Both /dependencies/submit and /tasks/submit use identical logic on the bridge side.
   * The difference in fallback behavior is handled by the MCP client, not the bridge.
   */
  private async handleTaskSubmission(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const request: SubmitDependencyTaskRequest = req.body;

      // Validate required fields
      if (
        !request.dependencyId ||
        !request.taskSummary ||
        !request.taskDetails
      ) {
        res.status(400).json({
          success: false,
          message: 'dependencyId, taskSummary, and taskDetails are required',
        });
        return;
      }

      const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Record task submission to store (before attempting resolution)
      let storedTask = null;
      if (this.mcpTasksDomain) {
        try {
          storedTask = await this.mcpTasksDomain.addTask({
            dependencyId: request.dependencyId,
            taskSummary: request.taskSummary,
            taskDetails: request.taskDetails,
            priority: request.priority,
            tags: request.tags,
            anchors: request.anchors,
            repositoryRoot: request.repositoryRoot,
            resolutionStatus: 'pending',
            dependencyResolved: false,
            taskWritten: false,
          });
          console.log('[Principal MCP Bridge] Task recorded to store:', storedTask.taskId);
        } catch (error) {
          console.error('[Principal MCP Bridge] Failed to record task to store:', error);
          // Continue with task submission even if storage fails
        }
      }

      // Resolve dependency using repository monitoring server
      let dependencyResolution = null;
      try {
        const repositoryMonitoring = getRepositoryMonitoringManager();
        dependencyResolution = await repositoryMonitoring.resolveDependency(
          request.dependencyId,
          request.repositoryRoot,
        );

        console.log(
          '[Principal MCP Bridge] Dependency resolution result:',
          dependencyResolution,
        );
      } catch (error) {
        console.error(
          '[Principal MCP Bridge] Failed to resolve dependency:',
          error,
        );
      }

      // Build response with resolution information
      const response: Record<string, unknown> = {
        success: true,
        taskId,
        repository: request.repositoryRoot,
        message: 'Dependency task submitted successfully',
        resolution: dependencyResolution || {
          dependencyId: request.dependencyId,
          found: false,
          message: 'Dependency resolution unavailable',
        },
      };

      // Add specific information based on resolution results
      if (dependencyResolution?.found) {
        if (dependencyResolution.alexandriaEntry) {
          response.message = `Found registered repository: ${dependencyResolution.alexandriaEntry.name}`;
          response.alexandriaEntry = dependencyResolution.alexandriaEntry;

          // Write task to dependency's Memory Palace
          try {
            const dependencyPath = dependencyResolution.alexandriaEntry.path;
            const fsAdapter = new NodeFileSystemAdapter();
            const validatedPath = MemoryPalace.validateRepositoryPath(
              fsAdapter,
              dependencyPath,
            ) as ValidatedRepositoryPath;
            const palace = new MemoryPalace(validatedPath, fsAdapter);

            // Compose task content
            const content = request.taskDetails.trim().startsWith('#')
              ? request.taskDetails
              : `# ${request.taskSummary}\n\n${request.taskDetails}`;

            // Create task input
            const taskInput: CreateTaskInput = {
              content,
              directoryPath: '' as unknown as ValidatedRelativePath, // Root of dependency repo
              priority: request.priority,
              tags: request.tags,
              anchors:
                request.anchors?.map(
                  (anchor) => anchor as unknown as ValidatedRelativePath,
                ) || [],
            };

            // Determine sender ID from source repository
            const senderName = request.repositoryRoot
              ? fsAdapter.getRepositoryName(
                  request.repositoryRoot as ValidatedRepositoryPath,
                )
              : 'external';

            // Write task to dependency's Memory Palace
            const task = palace.receiveTask(taskInput, senderName);

            response.taskWritten = true;
            response.taskPath = task.id;
            response.dependencyRepository = dependencyPath;

            console.log(
              `[Principal MCP Bridge] Task written to ${dependencyPath}/.palace-work/tasks/active/${task.id}.task.md`,
            );

            // Update stored task with successful resolution
            if (this.mcpTasksDomain && storedTask) {
              try {
                await this.mcpTasksDomain.updateTask(storedTask.taskId, {
                  resolutionStatus: 'resolved',
                  dependencyResolved: true,
                  dependencyRepository: dependencyPath,
                  taskPath: `${dependencyPath}/.palace-work/tasks/active/${task.id}.task.md`,
                  taskWritten: true,
                });
              } catch (error) {
                console.error('[Principal MCP Bridge] Failed to update task in store:', error);
              }
            }
          } catch (error) {
            console.error(
              '[Principal MCP Bridge] Failed to write task to dependency Memory Palace:',
              error,
            );
            response.taskWritten = false;
            response.taskWriteError =
              error instanceof Error ? error.message : 'Unknown error';

            // Update stored task with failure
            if (this.mcpTasksDomain && storedTask) {
              try {
                await this.mcpTasksDomain.updateTask(storedTask.taskId, {
                  resolutionStatus: 'failed',
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              } catch (updateError) {
                console.error('[Principal MCP Bridge] Failed to update task in store:', updateError);
              }
            }
          }
        } else if (dependencyResolution.packageInfo) {
          response.message = `Dependency already exists in ${dependencyResolution.packageInfo.packagePath}`;
          response.existingPackage = dependencyResolution.packageInfo;
        }

        if (dependencyResolution.suggestions) {
          response.installationSuggestions = dependencyResolution.suggestions;
        }
      } else {
        response.message = `Dependency '${request.dependencyId}' not found in registered repositories`;

        // Update stored task with unresolved status
        if (this.mcpTasksDomain && storedTask) {
          try {
            await this.mcpTasksDomain.updateTask(storedTask.taskId, {
              resolutionStatus: 'unresolved',
              dependencyResolved: false,
              taskWritten: false,
            });
          } catch (error) {
            console.error('[Principal MCP Bridge] Failed to update task in store:', error);
          }
        }
      }

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        message: 'Principal MCP Bridge is running',
        port: this.port,
      });
    });

    // Submit Dependency Task (Legacy)
    // Uses shared handler - implementation identical to /tasks/submit
    this.app.post(
      '/dependencies/submit',
      this.handleTaskSubmission.bind(this),
    );

    // Submit Task (New - Recommended)
    // Uses shared handler - implementation identical to /dependencies/submit
    // The difference in fallback behavior is handled by the MCP client, not the bridge
    this.app.post('/tasks/submit', this.handleTaskSubmission.bind(this));

    // Resolve Dependency (without submitting task)
    this.app.post(
      '/dependencies/resolve',
      async (req: Request, res: Response) => {
        try {
          const { dependencyId, repositoryRoot } = req.body;

          // Validate required fields
          if (!dependencyId) {
            res.status(400).json({
              success: false,
              message: 'dependencyId is required',
            });
            return;
          }

          // Resolve dependency using repository monitoring server
          try {
            const repositoryMonitoring = getRepositoryMonitoringManager();
            const dependencyResolution =
              await repositoryMonitoring.resolveDependency(
                dependencyId,
                repositoryRoot,
              );

            console.log(
              '[Principal MCP Bridge] Dependency resolution result:',
              dependencyResolution,
            );

            res.json({
              success: true,
              ...dependencyResolution,
            });
          } catch (error) {
            console.error(
              '[Principal MCP Bridge] Failed to resolve dependency:',
              error,
            );
            res.status(500).json({
              success: false,
              message: 'Failed to resolve dependency',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        } catch (error) {
          res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
    );
  }

  public async start(): Promise<number> {
    // Initialize MCP Tasks Domain
    try {
      const typedStore = await getTypedStorageManager();
      this.mcpTasksDomain = new MCPTasksDomain(typedStore);
      console.log('[Principal MCP Bridge] MCP Tasks tracking initialized');
    } catch (error) {
      console.error('[Principal MCP Bridge] Failed to initialize MCP Tasks tracking:', error);
      // Continue anyway - task tracking is not critical for bridge operation
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, 'localhost', () => {
        console.log(`✅ Principal MCP Bridge started on port ${this.port}`);
        resolve(this.port);
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          const errorMsg = `❌ Port ${this.port} is already in use. Principal MCP Bridge requires port ${this.port} to be available. Please stop any existing instances or free up the port.`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        } else {
          reject(err);
        }
      });
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close(() => {
        console.log('Principal MCP Bridge stopped');
      });
      this.server = null;
    }
  }

  public getPort(): number {
    return this.port;
  }
}

// Singleton instance
let principalMCPBridge: PrincipalMCPBridge | null = null;

export function getPrincipalMCPBridge(): PrincipalMCPBridge {
  if (!principalMCPBridge) {
    principalMCPBridge = new PrincipalMCPBridge();
  }
  return principalMCPBridge;
}

export function startPrincipalMCPBridge(): Promise<number> {
  const bridge = getPrincipalMCPBridge();
  return bridge.start();
}

export function stopPrincipalMCPBridge(): void {
  if (principalMCPBridge) {
    principalMCPBridge.stop();
    principalMCPBridge = null;
  }
}
