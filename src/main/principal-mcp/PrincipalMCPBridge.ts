import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { EventEmitter } from 'events';
import { SpanStatusCode } from '@opentelemetry/api';
import { APP_BRANDING } from '../../shared/config/appBranding';
import { getManager as getRepositoryMonitoringManager } from '../repository-monitoring/ipcHandlers';
import { getThemeHandler } from '../theme/themeHandler';
import { isValidPropertyPath } from '../../shared/theme/themeSchema';
import { getTracer } from '../telemetry';
import { BrunoValidationService } from '../bruno/BrunoValidationService';
import { ElectronFileAdapter, BrunoLangParserAdapter } from '../bruno/adapters';
import { registerTrailRoutes } from '../file-city/trailRoutes';
import { getTrailStore } from '../file-city/trailStore';
import { registerDocumentNotesRoutes } from '../document-notes/documentNotesRoutes';
import { registerDocumentRoutes } from './documentRoutes';
import { getDocumentNotesPersistence } from '../document-notes/documentNotesPersistence';
import { registerTopicRoutes } from '../topics/topicRoutes';
import { TopicRegistryService } from '../stores/TopicRegistryService';
import { registerRepoRoutes } from '../repos/repoRoutes';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { registerDependencyRoutes } from '../dependency-graph/dependencyRoutes';
import { DependencyGraphService } from '../dependency-graph/DependencyGraphService';

// Tracer for Principal MCP Bridge instrumentation
const tracer = getTracer('principal-ade-main');

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
    // Route catalog for agent discovery. Scoped to File City trail routes
    // for now; expand as other route groups are documented.
    this.app.get('/routes', (_req: Request, res: Response) => {
      res.json({
        service: 'Principal MCP Bridge',
        port: this.port,
        note: 'Catalog covers File City trail routes and the dependency-graph blast-radius route. Other route groups (theme, bruno, document-notes, topics, repos) are mounted but not yet documented here.',
        groups: [
          {
            name: 'file-city-trails',
            description:
              'Push, list, activate, fetch, fork, and delete File City trail payloads. Trails are pinned to file+line markers and render in the Trails view of the principal or dev-workspace window.',
            routes: [
              {
                method: 'POST',
                path: '/api/file-city/trail',
                summary:
                  'Upsert a trail payload by id. Replacing an existing id preserves its on-disk notes.',
                body: {
                  id: 'string (required, non-empty)',
                  title: 'string (required, non-empty)',
                  markers:
                    'TrailMarker[] (required, non-empty). Each marker needs a string id; investigation trails need exactly one marker with kind:"subject", other purposes must have none.',
                  views: 'TrailView[] (required, non-empty)',
                  summary: 'string (optional)',
                  purpose:
                    '"investigation" | "changelog" | "informative" (optional, defaults to "investigation"). Legacy alias: "kind".',
                  share: '{ id: string } (optional) — flags external audience',
                  repos: 'TrailRepo[] (optional)',
                  repositoryPath:
                    'string (optional) — top-level field used to bucket the trail by host repo; not persisted into the payload itself.',
                  createdAt: 'ISO string (optional, defaults to now)',
                  updatedAt: 'ISO string (optional, defaults to now)',
                  authoredAt: 'object (optional)',
                },
                response:
                  '{ success, id, broadcastTo, evictedIds, windowOpened }',
              },
              {
                method: 'POST',
                path: '/api/file-city/trail/fork-informative',
                summary:
                  'Fork an existing investigation into a new informative trail. Strips subject markers and forces purpose="informative". The host index records derivedFrom=sourceId.',
                body: {
                  sourceId:
                    'string (required) — id of the source trail; must exist locally',
                  payload:
                    'object (required) — same shape as POST /api/file-city/trail body, with a new id distinct from sourceId',
                  repositoryPath:
                    'string (optional) — overrides any repositoryPath inside payload',
                },
                response:
                  '{ success, id, derivedFrom, broadcastTo, evictedIds, windowOpened }',
              },
              {
                method: 'GET',
                path: '/api/file-city/trail/library',
                summary:
                  'List all stored trails, optionally filtered to a single host repository.',
                query: {
                  repositoryPath:
                    'string (optional) — absolute path of a host repo to filter by',
                },
                response: '{ success, entries, ... }',
              },
              {
                method: 'POST',
                path: '/api/file-city/trail/activate',
                summary:
                  'Make a stored trail the active one in its host repo window (opening/focusing the window as needed).',
                body: { id: 'string (required)' },
                response: '{ success, broadcastTo, windowOpened }',
              },
              {
                method: 'GET',
                path: '/api/file-city/trail/:id',
                summary: 'Fetch a stored trail payload by id.',
                response:
                  '{ success, payload } | 404 { success: false, error }',
              },
              {
                method: 'DELETE',
                path: '/api/file-city/trail/:id',
                summary: 'Delete a stored trail by id.',
                response: '{ success } | 404 { success: false, error }',
              },
              {
                method: 'GET',
                path: '/api/file-city/trail/share/:owner/:repo/:id',
                summary:
                  'Hydrate a private web-ade share by (owner, repo, id) using the main-process GitHub token. Use this instead of calling web-ade directly when the share is private.',
                response:
                  '{ success, payload } | 404/502 { success: false, error, code }',
              },
            ],
          },
          {
            name: 'repos',
            description:
              'Register and list Alexandria repositories. Registration is the programmatic analogue of the in-app "Add repository" affordance; the display name and remote are derived from the repo\'s git config.',
            routes: [
              {
                method: 'GET',
                path: '/api/repos',
                summary:
                  'List registered repositories (trimmed identity + provenance fields).',
                response:
                  '{ success, repos: Array<{ path, name, remoteUrl?, registeredAt, hasViews, viewCount, github? }> }',
              },
              {
                method: 'POST',
                path: '/api/repos',
                summary:
                  'Register a repository by absolute path. Re-registering an existing path is an idempotent no-op that returns the existing entry.',
                body: {
                  path: 'string (required) — absolute path to a git repository (must contain .git)',
                  remoteUrl:
                    'string (optional) — overrides the origin remote derived from git config',
                },
                response:
                  '201 { success, alreadyRegistered: false, repo } (new) | 200 { success, alreadyRegistered: true, repo } (existing) | 400 { success: false, error }',
              },
              {
                method: 'DELETE',
                path: '/api/repos',
                summary:
                  'De-register a repository. Only drops the registry entry — local files are never deleted (the deleteLocal flag is not exposed over HTTP).',
                query: {
                  path: 'string — absolute path of the repo to de-register (or pass body.path)',
                },
                response:
                  '{ success, removed } | 404 { success: false, error } | 400 { success: false, error }',
              },
            ],
          },
          {
            name: 'documents',
            description:
              "Open a document into the currently-focused window. Acts when that window is a doc-capable surface — the principal window's Inbox/Projects views or the dev-workspace. Within the principal window the active view decides renderer-side whether the doc lands; a focused non-terminal view or any other window is a no-op. There is no cold-start path — the route targets an already-open, already-focused window.",
            routes: [
              {
                method: 'POST',
                path: '/api/document/open',
                summary:
                  'Open (or focus) a tab for a document in the focused doc-tab window.',
                body: {
                  filePath:
                    'string (required) — absolute path, or repo-relative when repositoryPath is supplied.',
                  repositoryPath:
                    'string (optional) — host repo; resolves a relative filePath and supplies tab context.',
                },
                response:
                  '{ success, windowOpened } — windowOpened is false when no focused window hosts a tabbed terminal.',
              },
            ],
          },
          {
            name: 'dependency-graph',
            description:
              'Cross-repo dependency blast radius. Indexes the packages published by cloned registry repos and answers which other repos depend on a package the target repo publishes.',
            routes: [
              {
                method: 'GET',
                path: '/api/repos/blast-radius',
                summary:
                  'Direct dependents (Phase 1) of the packages a target repo publishes. Identity is purl.',
                query: {
                  repo: 'string — <owner/name> or repo name (one selector required)',
                  path: 'string — absolute repo path (alternative selector)',
                  purl: 'string — a published package purl (alternative selector)',
                  includeSelf:
                    '"true" (optional) — keep packages published by the target repo itself',
                  refresh:
                    '"true" (optional) — rebuild the index before answering',
                },
                response:
                  '{ success, scope:"direct-dependents", target:{ repoPath, repoName?, purls[] }, impacted:[{ purl, repoPath, name, dependsOn[] }], unanalyzedCount }',
              },
            ],
          },
        ],
      });
    });

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
            has_repository_root: !!repositoryRoot,
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
              found: dependencyResolution.found,
              has_alexandria_entry: !!dependencyResolution.alexandriaEntry,
              has_package_info: !!dependencyResolution.packageInfo,
              has_suggestions: !!dependencyResolution.suggestions,
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
            const resolvedEventAttrs: Record<
              string,
              string | boolean | number
            > = {
              'dependency.id': dependencyId,
              'resolution.success': true,
              found: dependencyResolution.found,
              source: dependencyResolution.alexandriaEntry
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
            error:
              'propertyPath is required (e.g., "colors.primary", "fonts.body")',
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

        console.error('[Principal MCP Bridge] Failed to update theme:', error);
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      } finally {
        span.end();
      }
    });

    // ============================================
    // BRUNO VALIDATION ROUTES
    // ============================================

    // Create validation service instance
    const brunoValidationService = new BrunoValidationService(
      new ElectronFileAdapter(),
      new BrunoLangParserAdapter(),
    );

    // POST /api/bruno/validate - Validate .bru file content
    this.app.post(
      '/api/bruno/validate',
      async (req: Request, res: Response) => {
        const span = tracer.startSpan('principal_mcp.bruno_validate_content');

        try {
          const { content } = req.body;

          // Event: client request initiated
          span.addEvent('principal_mcp.client.request_initiated', {
            'http.method': 'POST',
            'http.url': '/api/bruno/validate',
            'client.type': 'mcp',
          });

          // Event: server received request
          span.addEvent('principal_mcp.server.request_received', {
            'http.method': 'POST',
            'http.path': '/api/bruno/validate',
            'server.port': this.port,
          });

          // Validate required fields
          if (!content) {
            span.addEvent('principal_mcp.bruno.validate_content_requested', {
              'bruno.content_length': 0,
            });
            span.addEvent('principal_mcp.error.bruno_validation_failed', {
              'error.type': 'missing_content',
              'error.message': 'content is required',
              'bruno.file_path': '',
            });
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'content is required',
            });
            res.status(400).json({
              success: false,
              error: 'content is required',
            });
            return;
          }

          // Event: validation requested
          span.addEvent('principal_mcp.bruno.validate_content_requested', {
            'bruno.content_length': content.length,
          });

          // Event: service invoked
          span.addEvent('principal_mcp.bruno.service_invoked', {
            'bruno.operation': 'validateBruContent',
          });

          const result =
            await brunoValidationService.validateBruContent(content);

          // Event: content validated
          span.addEvent('principal_mcp.bruno.content_validated', {
            'bruno.valid': result.valid,
            'bruno.error_count': result.errors.length,
            'bruno.warning_count': result.warnings.length,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          res.json({
            success: true,
            ...result,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          span.addEvent('principal_mcp.error.bruno_validation_failed', {
            'error.type': 'internal_error',
            'error.message': errorMessage,
            'bruno.file_path': '',
          });

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });

          console.error(
            '[Principal MCP Bridge] Bruno validation error:',
            error,
          );
          res.status(500).json({
            success: false,
            error: errorMessage,
          });
        } finally {
          span.end();
        }
      },
    );

    // POST /api/bruno/validate/file - Validate .bru file by path
    this.app.post(
      '/api/bruno/validate/file',
      async (req: Request, res: Response) => {
        const span = tracer.startSpan('principal_mcp.bruno_validate_file');

        try {
          const { filePath } = req.body;

          // Event: client request initiated
          span.addEvent('principal_mcp.client.request_initiated', {
            'http.method': 'POST',
            'http.url': '/api/bruno/validate/file',
            'client.type': 'mcp',
          });

          // Event: server received request
          span.addEvent('principal_mcp.server.request_received', {
            'http.method': 'POST',
            'http.path': '/api/bruno/validate/file',
            'server.port': this.port,
          });

          // Validate required fields
          if (!filePath) {
            span.addEvent('principal_mcp.bruno.file_validation_requested', {
              'bruno.file_path': '',
            });
            span.addEvent('principal_mcp.error.bruno_validation_failed', {
              'error.type': 'missing_file_path',
              'error.message': 'filePath is required',
              'bruno.file_path': '',
            });
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'filePath is required',
            });
            res.status(400).json({
              success: false,
              error: 'filePath is required',
            });
            return;
          }

          // Event: file validation requested
          span.addEvent('principal_mcp.bruno.file_validation_requested', {
            'bruno.file_path': filePath,
          });

          // Event: service invoked
          span.addEvent('principal_mcp.bruno.service_invoked', {
            'bruno.operation': 'validateBruFile',
          });

          const result = await brunoValidationService.validateBruFile(filePath);

          // Event: file validated
          span.addEvent('principal_mcp.bruno.file_validated', {
            'bruno.file_path': filePath,
            'bruno.valid': result.valid,
            'bruno.error_count': result.errors.length,
            'bruno.warning_count': result.warnings.length,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          res.json({
            success: true,
            filePath,
            ...result,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          span.addEvent('principal_mcp.error.bruno_validation_failed', {
            'error.type': 'file_read_error',
            'error.message': errorMessage,
            'bruno.file_path': req.body.filePath || '',
          });

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });

          console.error(
            '[Principal MCP Bridge] Bruno file validation error:',
            error,
          );
          res.status(500).json({
            success: false,
            error: errorMessage,
          });
        } finally {
          span.end();
        }
      },
    );

    // POST /api/bruno/validate/collection - Validate entire collection
    this.app.post(
      '/api/bruno/validate/collection',
      async (req: Request, res: Response) => {
        const span = tracer.startSpan(
          'principal_mcp.bruno_validate_collection',
        );

        try {
          const { collectionPath } = req.body;

          // Event: client request initiated
          span.addEvent('principal_mcp.client.request_initiated', {
            'http.method': 'POST',
            'http.url': '/api/bruno/validate/collection',
            'client.type': 'mcp',
          });

          // Event: server received request
          span.addEvent('principal_mcp.server.request_received', {
            'http.method': 'POST',
            'http.path': '/api/bruno/validate/collection',
            'server.port': this.port,
          });

          // Validate required fields
          if (!collectionPath) {
            span.addEvent(
              'principal_mcp.bruno.collection_validation_requested',
              {
                'bruno.collection_path': '',
              },
            );
            span.addEvent('principal_mcp.error.bruno_validation_failed', {
              'error.type': 'missing_collection_path',
              'error.message': 'collectionPath is required',
              'bruno.file_path': '',
            });
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'collectionPath is required',
            });
            res.status(400).json({
              success: false,
              error: 'collectionPath is required',
            });
            return;
          }

          // Event: collection validation requested
          span.addEvent('principal_mcp.bruno.collection_validation_requested', {
            'bruno.collection_path': collectionPath,
          });

          // Event: service invoked
          span.addEvent('principal_mcp.bruno.service_invoked', {
            'bruno.operation': 'validateCollection',
          });

          const result =
            await brunoValidationService.validateCollection(collectionPath);

          // Emit file validated events for each file (for detailed tracing)
          for (const [filePath, fileResult] of Object.entries(result.results)) {
            span.addEvent('principal_mcp.bruno.file_validated', {
              'bruno.file_path': filePath,
              'bruno.valid': fileResult.valid,
              'bruno.error_count': fileResult.errors.length,
              'bruno.warning_count': fileResult.warnings.length,
            });
          }

          // Event: collection validated
          span.addEvent('principal_mcp.bruno.collection_validated', {
            'bruno.collection_path': collectionPath,
            'bruno.valid': result.valid,
            'bruno.total_files': result.totalFiles,
            'bruno.valid_files': result.validFiles,
            'bruno.invalid_files': result.invalidFiles,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          res.json({
            success: true,
            ...result,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          span.addEvent('principal_mcp.error.bruno_validation_failed', {
            'error.type': 'collection_error',
            'error.message': errorMessage,
            'bruno.file_path': req.body.collectionPath || '',
          });

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });

          console.error(
            '[Principal MCP Bridge] Bruno collection validation error:',
            error,
          );
          res.status(500).json({
            success: false,
            error: errorMessage,
          });
        } finally {
          span.end();
        }
      },
    );

    // POST /api/bruno/parse - Parse .bru content to JSON
    this.app.post('/api/bruno/parse', async (req: Request, res: Response) => {
      const span = tracer.startSpan('principal_mcp.bruno_parse');

      try {
        const { content } = req.body;

        // Event: client request initiated
        span.addEvent('principal_mcp.client.request_initiated', {
          'http.method': 'POST',
          'http.url': '/api/bruno/parse',
          'client.type': 'mcp',
        });

        // Event: server received request
        span.addEvent('principal_mcp.server.request_received', {
          'http.method': 'POST',
          'http.path': '/api/bruno/parse',
          'server.port': this.port,
        });

        // Validate required fields
        if (!content) {
          span.addEvent('principal_mcp.bruno.parse_requested', {
            'bruno.content_length': 0,
          });
          span.addEvent('principal_mcp.error.bruno_validation_failed', {
            'error.type': 'missing_content',
            'error.message': 'content is required',
            'bruno.file_path': '',
          });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'content is required',
          });
          res.status(400).json({
            success: false,
            error: 'content is required',
          });
          return;
        }

        // Event: parse requested
        span.addEvent('principal_mcp.bruno.parse_requested', {
          'bruno.content_length': content.length,
        });

        // Event: service invoked
        span.addEvent('principal_mcp.bruno.service_invoked', {
          'bruno.operation': 'parseBruToJson',
        });

        const result = await brunoValidationService.parseBruToJson(content);

        if (result.success && result.request) {
          // Event: content parsed successfully
          span.addEvent('principal_mcp.bruno.content_parsed', {
            'bruno.success': true,
            'bruno.request_method': result.request.http.method,
            'bruno.request_url': result.request.http.url,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          res.json({
            success: true,
            request: result.request,
          });
        } else {
          // Event: parse failed
          const firstError = result.errors?.[0];
          span.addEvent('principal_mcp.error.bruno_parse_failed', {
            'error.type': 'syntax_error',
            'error.message': firstError?.message || 'Parse failed',
            'error.line': firstError?.line || 0,
            'error.column': firstError?.column || 0,
          });

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: firstError?.message || 'Parse failed',
          });

          res.status(400).json({
            success: false,
            errors: result.errors,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        span.addEvent('principal_mcp.error.bruno_parse_failed', {
          'error.type': 'internal_error',
          'error.message': errorMessage,
          'error.line': 0,
          'error.column': 0,
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });

        console.error('[Principal MCP Bridge] Bruno parse error:', error);
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      } finally {
        span.end();
      }
    });

    // ============================================
    // FILE CITY TRAIL ROUTES
    // ============================================
    registerTrailRoutes(this.app, getTrailStore());

    // ============================================
    // DOCUMENT NOTES ROUTES
    // ============================================
    registerDocumentNotesRoutes(this.app, getDocumentNotesPersistence());

    // ============================================
    // DOCUMENT (OPEN-IN-FOCUSED-WINDOW) ROUTES
    // ============================================
    registerDocumentRoutes(this.app);

    // ============================================
    // TOPIC ROUTES
    // ============================================
    registerTopicRoutes(this.app, TopicRegistryService.getInstance());

    // ============================================
    // REPO REGISTRY ROUTES
    // ============================================
    registerRepoRoutes(this.app, AlexandriaRegistryService.getInstance());

    // ============================================
    // DEPENDENCY GRAPH (BLAST RADIUS) ROUTES
    // ============================================
    registerDependencyRoutes(this.app, DependencyGraphService.getInstance());
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
