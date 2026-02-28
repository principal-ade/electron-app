import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { EventEmitter } from 'events';
import { SpanStatusCode } from '@opentelemetry/api';
import { APP_BRANDING } from '../../shared/config/appBranding';
import { getManager as getRepositoryMonitoringManager } from '../repository-monitoring/ipcHandlers';
import { getThemeHandler } from '../theme/themeHandler';
import { isValidPropertyPath } from '../../shared/theme/themeSchema';
import { getTracer } from '../telemetry';

// Tracer for Principal MCP Bridge instrumentation
const tracer = getTracer('principal-mcp-bridge');

// Determine which port to use based on environment
function getDefaultPort(): number {
  const isDev = process.env.NODE_ENV === 'development';
  const ports = isDev
    ? APP_BRANDING.BRIDGE_PORTS.DEVELOPMENT
    : APP_BRANDING.BRIDGE_PORTS.PRODUCTION;
  return ports.PRINCIPAL_MCP;
}

export class PrincipalMCPBridge extends EventEmitter {
  private app: express.Application;
  private server: Server | null = null;
  private port: number = getDefaultPort();

  constructor(startPort?: number) {
    super();
    this.app = express();
    this.port = startPort || getDefaultPort();
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

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      const span = tracer.startSpan('principal_mcp.health_check');

      try {
        // Event: client request initiated
        span.addEvent('principal_mcp.client.request_initiated', {
          'http.method': 'GET',
          'http.url': '/health',
          'client.type': 'mcp',
        });

        // Event: server received request
        span.addEvent('principal_mcp.server.request_received', {
          'http.method': 'GET',
          'http.path': '/health',
          'server.port': this.port,
        });

        const timestamp = Date.now();
        const response = {
          status: 'ok',
          timestamp,
          message: 'Principal MCP Bridge is running',
          port: this.port,
        };

        // Event: health check completed
        span.addEvent('principal_mcp.health.checked', {
          'health.status': 'ok',
          'health.timestamp': timestamp,
          'health.port': this.port,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        res.json(response);
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    });

    // Resolve Dependency
    this.app.post(
      '/dependencies/resolve',
      async (req: Request, res: Response) => {
        const span = tracer.startSpan('principal_mcp.dependency_resolution');

        try {
          const { dependencyId, repositoryRoot } = req.body;

          // Event: client request initiated
          span.addEvent('principal_mcp.client.request_initiated', {
            'http.method': 'POST',
            'http.url': '/dependencies/resolve',
            'client.type': 'mcp',
          });

          // Event: server received request
          span.addEvent('principal_mcp.server.request_received', {
            'http.method': 'POST',
            'http.path': '/dependencies/resolve',
            'server.port': this.port,
          });

          // Validate required fields
          if (!dependencyId) {
            span.addEvent('principal_mcp.dependency.resolve_requested', {
              'dependency.id': '',
              'repository.root': repositoryRoot || '',
            });
            span.addEvent('principal_mcp.error.validation_failed', {
              'error.type': 'validation_error',
              'error.field': 'dependencyId',
              'error.message': 'dependencyId is required',
            });
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'dependencyId is required',
            });
            res.status(400).json({
              success: false,
              message: 'dependencyId is required',
            });
            return;
          }

          // Event: dependency resolution requested
          span.addEvent('principal_mcp.dependency.resolve_requested', {
            'dependency.id': dependencyId,
            'repository.root': repositoryRoot || '',
          });

          // Event: calling repository monitoring manager
          span.addEvent('principal_mcp.repo_monitoring.calling', {
            'dependency.id': dependencyId,
            'has_repository_root': !!repositoryRoot,
          });

          // Resolve dependency using repository monitoring server
          try {
            const repositoryMonitoring = getRepositoryMonitoringManager();
            const dependencyResolution =
              await repositoryMonitoring.resolveDependency(
                dependencyId,
                repositoryRoot,
              );

            // Event: raw result received from monitoring manager
            span.addEvent('principal_mcp.repo_monitoring.result_received', {
              'dependency.id': dependencyId,
              'found': dependencyResolution.found,
              'has_alexandria_entry': !!dependencyResolution.alexandriaEntry,
              'has_package_info': !!dependencyResolution.packageInfo,
              'has_suggestions': !!dependencyResolution.suggestions,
            });

            // Event: check Alexandria registry result
            if (dependencyResolution.alexandriaEntry) {
              span.addEvent('principal_mcp.resolution.alexandria_found', {
                'dependency.id': dependencyId,
                'alexandria.name': dependencyResolution.alexandriaEntry.name,
                'alexandria.path': dependencyResolution.alexandriaEntry.path,
                'alexandria.remote_url':
                  dependencyResolution.alexandriaEntry.remoteUrl || '',
                'alexandria.last_commit_hash':
                  dependencyResolution.alexandriaEntry.lastCommitHash || '',
              });
            } else {
              span.addEvent('principal_mcp.resolution.alexandria_not_found', {
                'dependency.id': dependencyId,
              });
            }

            // Event: check package dependencies result
            if (dependencyResolution.packageInfo) {
              span.addEvent('principal_mcp.resolution.package_found', {
                'dependency.id': dependencyId,
                'package.name': dependencyResolution.packageInfo.name,
                'package.version':
                  dependencyResolution.packageInfo.version || 'unknown',
                'package.path': dependencyResolution.packageInfo.packagePath,
                'package.is_dev_dependency':
                  dependencyResolution.packageInfo.isDevDependency,
              });
            } else {
              span.addEvent('principal_mcp.resolution.package_not_found', {
                'dependency.id': dependencyId,
              });
            }

            // Event: suggestions if not found
            if (
              !dependencyResolution.found &&
              dependencyResolution.suggestions
            ) {
              span.addEvent('principal_mcp.resolution.suggestions_generated', {
                'dependency.id': dependencyId,
                'suggestions.install_commands':
                  dependencyResolution.suggestions.installCommands?.join(
                    ', ',
                  ) || '',
                'suggestions.target_package':
                  dependencyResolution.suggestions.targetPackage || '',
                'suggestions.package_manager':
                  dependencyResolution.suggestions.packageManager || '',
              });
            } else if (!dependencyResolution.found) {
              // Event: no suggestions available
              span.addEvent('principal_mcp.resolution.no_suggestions', {
                'dependency.id': dependencyId,
              });
            }

            // Event: final dependency resolved status
            const resolvedEventAttrs: Record<string, string | boolean | number> =
              {
                'dependency.id': dependencyId,
                'resolution.success': true,
                'found': dependencyResolution.found,
                'source': dependencyResolution.alexandriaEntry
                  ? 'alexandria'
                  : dependencyResolution.packageInfo
                    ? 'package'
                    : 'none',
              };

            span.addEvent(
              'principal_mcp.repo_monitoring.dependency_resolved',
              resolvedEventAttrs,
            );

            console.log(
              '[Principal MCP Bridge] Dependency resolution result:',
              dependencyResolution,
            );

            span.setStatus({ code: SpanStatusCode.OK });
            res.json({
              success: true,
              ...dependencyResolution,
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';

            // Event: resolution error occurred
            span.addEvent('principal_mcp.error.resolution_failed', {
              'dependency.id': dependencyId,
              'error.message': errorMessage,
              'error.type': 'resolution_error',
            });

            // Event: dependency resolution failed
            span.addEvent('principal_mcp.repo_monitoring.dependency_resolved', {
              'dependency.id': dependencyId,
              'resolution.success': false,
              'error.message': errorMessage,
            });

            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: errorMessage,
            });

            console.error(
              '[Principal MCP Bridge] Failed to resolve dependency:',
              error,
            );
            res.status(500).json({
              success: false,
              message: 'Failed to resolve dependency',
              error: errorMessage,
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });
          res.status(500).json({
            success: false,
            message: errorMessage,
          });
        } finally {
          span.end();
        }
      },
    );

    // ============================================
    // THEME ROUTES
    // ============================================

    // GET /theme/schema - Get theme schema documentation and available themes
    this.app.get('/theme/schema', async (req: Request, res: Response) => {
      const span = tracer.startSpan('principal_mcp.theme_schema');

      try {
        const themeName = req.query.theme as string | undefined;

        // Event: client request initiated
        span.addEvent('principal_mcp.client.request_initiated', {
          'http.method': 'GET',
          'http.url': '/theme/schema',
          'client.type': 'mcp',
        });

        // Event: server received request
        span.addEvent('principal_mcp.server.request_received', {
          'http.method': 'GET',
          'http.path': '/theme/schema',
          'server.port': this.port,
          'theme.query_param': themeName || 'default',
        });

        // Event: schema requested
        span.addEvent('principal_mcp.theme.schema_requested', {
          'theme.target_theme': themeName || 'user-selected',
        });

        const themeHandler = getThemeHandler();
        const schemaResponse = await themeHandler.getSchema(themeName);

        if (!schemaResponse.success) {
          span.addEvent('principal_mcp.error.theme_not_found', {
            'theme.requested': themeName || 'default',
            'error.message': schemaResponse.error || 'Theme not found',
          });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: schemaResponse.error || 'Theme not found',
          });
          res.status(404).json(schemaResponse);
          return;
        }

        // Event: schema retrieved successfully
        span.addEvent('principal_mcp.theme.schema_retrieved', {
          'theme.name': schemaResponse.themeName || 'unknown',
          'theme.schema_properties_count': schemaResponse.schema?.length || 0,
          'theme.available_themes_count':
            schemaResponse.availableThemes?.length || 0,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        res.json(schemaResponse);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        span.addEvent('principal_mcp.error.schema_retrieval_failed', {
          'error.message': errorMessage,
          'error.type': 'schema_retrieval_error',
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });

        console.error(
          '[Principal MCP Bridge] Failed to get theme schema:',
          error,
        );
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      } finally {
        span.end();
      }
    });

    // POST /theme/update - Update a theme property
    this.app.post('/theme/update', async (req: Request, res: Response) => {
      const span = tracer.startSpan('principal_mcp.theme_update');

      try {
        const { propertyPath, value, themeName } = req.body;

        // Event: client request initiated
        span.addEvent('principal_mcp.client.request_initiated', {
          'http.method': 'POST',
          'http.url': '/theme/update',
          'client.type': 'mcp',
        });

        // Event: server received request
        span.addEvent('principal_mcp.server.request_received', {
          'http.method': 'POST',
          'http.path': '/theme/update',
          'server.port': this.port,
        });

        // Validate required fields
        if (!propertyPath) {
          span.addEvent('principal_mcp.error.validation_failed', {
            'error.type': 'validation_error',
            'error.field': 'propertyPath',
            'error.message': 'propertyPath is required',
          });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'propertyPath is required',
          });
          res.status(400).json({
            success: false,
            error: 'propertyPath is required (e.g., "colors.primary", "fonts.body")',
          });
          return;
        }

        if (value === undefined || value === null) {
          span.addEvent('principal_mcp.error.validation_failed', {
            'error.type': 'validation_error',
            'error.field': 'value',
            'error.message': 'value is required',
          });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'value is required',
          });
          res.status(400).json({
            success: false,
            error: 'value is required',
          });
          return;
        }

        // Validate property path against schema
        if (!isValidPropertyPath(propertyPath)) {
          span.addEvent('principal_mcp.error.validation_failed', {
            'error.type': 'validation_error',
            'error.field': 'propertyPath',
            'error.message': `Invalid property path: ${propertyPath}`,
          });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Invalid property path: ${propertyPath}`,
          });
          res.status(400).json({
            success: false,
            error: `Invalid property path: "${propertyPath}". Use GET /theme/schema to see valid property paths.`,
          });
          return;
        }

        // Event: theme update requested
        span.addEvent('principal_mcp.theme.update_requested', {
          'theme.property_path': propertyPath,
          'theme.value_type': typeof value,
          'theme.target_theme': themeName || 'current',
        });

        // Event: updating preferences (main process)
        span.addEvent('principal_mcp.theme.preferences_updating', {
          'theme.property_path': propertyPath,
          'theme.target_theme': themeName || 'principalAI',
        });

        const themeHandler = getThemeHandler();
        const result = await themeHandler.updateProperty({
          propertyPath,
          value,
          themeName,
        });

        // Event: preferences updated and broadcast to renderers
        span.addEvent('principal_mcp.theme.preferences_updated', {
          'theme.property_path': propertyPath,
          'theme.success': result.success,
          'theme.active_theme': result.activeTheme || 'same',
        });

        if (!result.success) {
          span.addEvent('principal_mcp.error.theme_update_failed', {
            'theme.property_path': propertyPath,
            'error.message': result.error || 'Unknown error',
          });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: result.error || 'Theme update failed',
          });
          res.status(500).json(result);
          return;
        }

        // Event: theme update completed successfully
        const completedAttrs: Record<string, string | boolean> = {
          'theme.property_path': propertyPath,
          'theme.updated_theme': result.themeName || 'unknown',
          'theme.success': true,
        };
        if (result.warning) {
          completedAttrs['theme.warning'] = result.warning;
        }
        if (result.activeTheme) {
          completedAttrs['theme.active_theme'] = result.activeTheme;
        }
        span.addEvent('principal_mcp.theme.update_completed', completedAttrs);

        span.setStatus({ code: SpanStatusCode.OK });
        res.json(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        span.addEvent('principal_mcp.error.theme_update_exception', {
          'error.message': errorMessage,
          'error.type': 'exception',
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });

        console.error(
          '[Principal MCP Bridge] Failed to update theme:',
          error,
        );
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      } finally {
        span.end();
      }
    });
  }

  public async start(): Promise<number> {
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
