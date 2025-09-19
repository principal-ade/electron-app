import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { APP_BRANDING } from '../shared/config/appBranding';
import { initializeStorage } from './stores/initialization';
import { ElectronMCPIntegration } from './mcp-app-control/mcp-integration';
import { AgentSessionEventsHttpBridge } from './agent-session-events/AgentSessionEventsHttpBridge';
import {
  startPlanningMCPBridge,
  stopPlanningMCPBridge,
} from './planning-mcp/PlanningMCPBridge';
import { applicationWindows } from './window/modernWindowManager';
import { agentSessionArchivingService } from './agent-sessions/AgentSessionArchivingService';
import { agentSessionAutoArchivingService } from './stores/AgentSessionAutoArchivingService';
import { registerArchiveHandlers } from './stores/archiveHandlers';
import { setupSessionHandlers } from './agent-sessions/agentSessionHandlers';

// Import all IPC handlers
import { registerWindowManagerIpcHandlers } from './window/windowManagerHandlers';
import { registerModernWindowHandlers } from './window/modernWindowHandlers';
import { registerMcpToolsIpcHandlers } from './principal-mcp/mcpToolsHandlers';
import { registerStoreHandlers } from './stores/storeHandlers';
import { registerSecretHandlers } from './stores/secretHandlers';
import { registerMCPBridgeHandlers } from './stores/mcpBridgeHandlers';
import { getTypedStorageManager } from './storage-providers';
import { registerGitHandlers } from './file-system/gitHandlers';
import { registerGitWatcherHandlers } from './file-system/gitWatcherHandlers';
import { setupShellHandlers } from './file-system/shellHandlers';
import { setupTypeExtractionHandlers } from './services/ipc/typeExtractionHandlers';
import { setupTypeSchemaHandlers } from './services/ipc/type-schema/typeSchemaHandlers';
import { registerPackageManagerHandlers } from './services/ipc/packageManager/packageManagerHandlers';
import { registerSystemHandlers } from './system/systemHandlers';
import { registerFeedbackHandlers } from './services/ipc/feedback/feedbackHandlers';
import { getTerminalManager } from './terminalWrapper';
import { excalidrawHandlers } from './drawings/excalidrawHandlers';
import { registerUserPromptHandlers } from './principal-mcp/userPromptHandlers';
import { registerSessionViewHandlers } from './services/ipc/sessionView/sessionViewHandlers';

import { setupAgentConfigHandlers } from './agent-management/agentConfigHandlers';
import { registerFileSystemIpcHandlers } from './file-system/fileSystemHandlers';
import { registerRepositoryHandlers } from './stores/RepositoryApiEventHandler';
import { registerAlexandriaHandlers } from './stores/AlexandriaApiEventHandler';
import { registerAlexandriaDocsHandlers } from './stores/AlexandriaDocsApiEventHandler';
import { registerRepositoryNotesHandlers } from './principal-mcp/repositoryNotesHandlers';
import { registerViolationCollectionHandlers } from './handlers/ViolationCollectionHandlers';
import { registerTestCoverageHandlers } from './handlers/TestCoverageHandlers';
import { registerApiProxyHandlers } from './services/ApiProxyService';
import { JWTService } from './services/JWTService';
import { registerGitHubIpcHandlers } from './version-control-providers/githubHandlers';
import { UserPreferencesHandler } from './stores/userPreferencesHandler';
import { A24zHandler } from './stores/a24zHandler';
import { AppVersionManagerAPIEvent } from '../window/main-process-api-implementations/appVersionManagerApi';
import { registerDockerHandlers } from './services/ipc/docker/dockerHandlers';
import { registerOptimizedDockerHandlers } from './services/ipc/docker/optimizedDockerHandlers';
import { registerKnipAnalysisHandlers } from './services/ipc/knip/knipAnalysisHandlers';
import { registerKnipHandlers } from './services/ipc/knip/knipHandlers';
import { registerPlanningHandlers } from './planning-mcp/planningHandlers';
import {
  registerDocumentSearchHandlers,
  shutdownDocumentSearch,
} from './services/ipc/documentSearchHandlers';

let mcpIntegration: ElectronMCPIntegration | null = null;
let agentSessionEventsHttpBridge: AgentSessionEventsHttpBridge | null = null;
let planningMCPBridgePort: number | null = null;

const agentEventsBridgePort = APP_BRANDING.BRIDGE_PORTS.AGENT_SESSION_EVENTS;
const planningBridgePort = APP_BRANDING.BRIDGE_PORTS.PLANNING_MCP;

// Setup MCP script path handler
const setupMCPScriptPathHandler = () => {
  ipcMain.handle('get-resolved-mcp-script-path', async () => {
    // Use the same pattern as hooks - assets folder
    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');

    const mcpServerPath = path.join(
      RESOURCES_PATH,
      APP_BRANDING.MCP_SERVER_FILENAME,
    );

    // Verify file exists and log for debugging
    if (!fs.existsSync(mcpServerPath)) {
      console.error(
        `[MCP Server] MCP server file not found at ${mcpServerPath}`,
      );
    }

    return mcpServerPath;
  });
};

// Setup app version handler
const setupAppVersionHandler = () => {
  ipcMain.handle(AppVersionManagerAPIEvent.GET_VERSION, () => {
    // Try to read from package.json first, fall back to app.getVersion()
    try {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || app.getVersion();
    } catch (error) {
      console.warn(
        '[Main] Failed to read package.json version, falling back to app.getVersion():',
        error,
      );
      return app.getVersion();
    }
  });
};

// Setup dev mode handler
const setupDevModeHandler = () => {
  ipcMain.handle(AppVersionManagerAPIEvent.IS_DEV_MODE, () => {
    return !app.isPackaged;
  });
};

// Setup knip analysis handler
const setupKnipAnalysisHandler = () => {
  ipcMain.handle('run-knip-analysis', async (_event, directoryPath: string) => {
    const { KnipAnalysisService } = await import(
      './services/knipAnalysisService'
    );
    return KnipAnalysisService.runAnalysis(directoryPath);
  });
};

// Setup HTTP bridges
const setupHttpBridges = async () => {
  // Initialize MCP Integration and HTTP Bridges first
  mcpIntegration = new ElectronMCPIntegration();
  agentSessionEventsHttpBridge = new AgentSessionEventsHttpBridge(
    agentEventsBridgePort,
  );

  // Start agent session events bridge
  await agentSessionEventsHttpBridge
    .start()
    .catch((err: any) =>
      console.error('Agent Session Events Bridge failed to start:', err),
    );

  // Start Planning MCP Bridge
  try {
    planningMCPBridgePort = await startPlanningMCPBridge();
    console.log(
      `[Main Process] Planning MCP Bridge started on port ${planningMCPBridgePort}`,
    );
  } catch (err) {
    console.error('Planning MCP Bridge failed to start:', err);
  }
};

// Register all IPC handlers
const registerAllIpcHandlers = async () => {
  // Register SecureTokenIPC handlers (lazy initialization - no keychain access)
  const { registerSecureTokenHandlers } = require('./services/SecureTokenIPC');
  registerSecureTokenHandlers(); // Registers handlers without creating instance

  registerMcpToolsIpcHandlers(applicationWindows);
  registerFileSystemIpcHandlers(applicationWindows);
  registerWindowManagerIpcHandlers(applicationWindows);
  registerModernWindowHandlers(); // Register modern window creation handlers
  //registerStorageHandlers();
  registerStoreHandlers();
  registerSecretHandlers();
  registerMCPBridgeHandlers();
  registerRepositoryHandlers();
  registerAlexandriaHandlers();
  registerAlexandriaDocsHandlers();
  registerRepositoryNotesHandlers();
  registerViolationCollectionHandlers();
  registerTestCoverageHandlers();
  registerApiProxyHandlers();
  JWTService.registerHandlers();

  // Register execute-command handler for git operations
  ipcMain.handle(
    'execute-command',
    async (
      _,
      params: {
        command: string;
        args: string[];
        cwd: string;
      },
    ) => {
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const child = spawn(params.command, params.args, {
          cwd: params.cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        child.on('close', (code: number) => {
          resolve({
            success: code === 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code,
          });
        });

        child.on('error', (error: Error) => {
          resolve({
            success: false,
            stdout: '',
            stderr: error.message,
            code: -1,
          });
        });
      });
    },
  );

  registerGitHubIpcHandlers(applicationWindows);
  registerGitHandlers();
  registerGitWatcherHandlers();
  setupSessionHandlers();
  // Agent installation handlers removed - we only configure hooks now
  setupAgentConfigHandlers();
  setupShellHandlers();
  registerArchiveHandlers();
  registerDockerHandlers();
  registerOptimizedDockerHandlers();
  registerKnipAnalysisHandlers();
  registerKnipHandlers();
  registerPlanningHandlers();
  registerDocumentSearchHandlers();

  // LLM Models handlers have been removed
  const typedStore = await getTypedStorageManager();

  // Register User Preferences handlers
  const userPreferencesHandler = new UserPreferencesHandler(typedStore);
  userPreferencesHandler.registerHandlers();

  // Register A24z handlers
  const a24zHandler = new A24zHandler();
  a24zHandler.registerHandlers();

  setupTypeSchemaHandlers();
  excalidrawHandlers.registerHandlers();
  setupTypeExtractionHandlers();
  registerPackageManagerHandlers();
  registerSystemHandlers();
  registerFeedbackHandlers();
  registerUserPromptHandlers();
  registerSessionViewHandlers();
};

// Setup terminal manager
const setupTerminalManager = () => {
  const terminalManager = getTerminalManager();
  // Clean up any existing terminal sessions on startup to avoid stale PTY processes
  console.log(
    '[Terminal] Cleaning up any existing terminal sessions on startup...',
  );
  terminalManager.destroyAllSessions();
  return terminalManager;
};

// Main initialization function
export const initializeServices = async () => {
  // Setup basic IPC handlers
  setupMCPScriptPathHandler();
  setupAppVersionHandler();
  setupDevModeHandler();
  setupKnipAnalysisHandler();

  // Initialize storage before setting up bridges
  await initializeStorage();

  // Setup HTTP bridges after storage is ready
  await setupHttpBridges();

  // Register all IPC handlers for services that use the appWindows map
  await registerAllIpcHandlers();

  // Scaffold layer handler has been removed

  // Setup terminal manager AFTER storage init to avoid early access to storage
  setTimeout(() => {
    setupTerminalManager();
  }, 1000);

  // Setup periodic cleanup for old archives
  setupArchiveCleanup();

  // Agent auto-update removed - agents are installed externally
};

// Setup periodic cleanup for archived sessions
const setupArchiveCleanup = () => {
  // Initialize auto-archiving service
  agentSessionAutoArchivingService
    .initialize()
    .catch((err) =>
      console.error(
        '[Main] Agent session auto-archiving service initialization failed:',
        err,
      ),
    );

  // Run cleanup on startup
  setTimeout(() => {
    agentSessionArchivingService
      .cleanupOldArchives()
      .catch((err) => console.error('[Main] Archive cleanup failed:', err));
  }, 30000); // 30 seconds after startup

  // Run cleanup every 24 hours
  setInterval(
    () => {
      agentSessionArchivingService
        .cleanupOldArchives()
        .catch((err) => console.error('[Main] Archive cleanup failed:', err));
    },
    24 * 60 * 60 * 1000,
  );
};

// Cleanup function for app shutdown
export const shutdownServices = async () => {
  console.log('[Main Process] Shutting down services.');

  // Clean up terminal sessions if terminal manager is available
  const terminalManager = getTerminalManager();
  if (terminalManager) {
    console.log('[Main Process] Cleaning up terminal sessions...');
    terminalManager.destroyAllSessions();
  }

  if (mcpIntegration) {
    await mcpIntegration.shutdown();
    console.log('[Main Process] ElectronMCPIntegration shutdown complete.');
  }

  if (agentSessionEventsHttpBridge) {
    await agentSessionEventsHttpBridge.stop();
    console.log('[Main Process] Agent Events HTTP Bridge stopped.');
  }

  // Stop Planning MCP Bridge
  stopPlanningMCPBridge();
  console.log('[Main Process] Planning MCP Bridge stopped.');

  // Shutdown agent auto-update service
  // Auto-update removed - agents are no longer installed by this app
  console.log('[Main Process] Agent auto-update service stopped.');

  // Shutdown document search service
  shutdownDocumentSearch();
  console.log('[Main Process] Document search service stopped.');
};

export { mcpIntegration, agentSessionEventsHttpBridge };
