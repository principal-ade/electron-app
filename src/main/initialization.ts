import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { registerIpcMain } from '@egoist/tipc/main';
import {
  getTypedStorageManagerInstance,
  initializeStorage,
} from './stores/initialization';
import { terminalRouter } from './terminal/tipc';
import { initializeTerminalSettings } from './terminal/sessionManagerSingleton';
import { githubRouter } from './github/tipc';
import { appVersionRouter } from './app-version/tipc';
import { alexandriaRouter } from './alexandria/tipc';
import { topicRouter } from './topics/tipc';
import { subsystemModelRouter } from './subsystem-models/tipc/subsystemModelRouter';
import { geminiRouter } from './gemini/tipc';
// import { AgentSessionEventsHttpBridge } from './agent-session-events/AgentSessionEventsHttpBridge';
import {
  startEventServer,
  stopEventServer,
  getEventServerManager,
} from './agent-session-events/EventServerManager';
import {
  startPrincipalMCPBridge,
  stopPrincipalMCPBridge,
} from './principal-mcp/PrincipalMCPBridge';
import { applicationWindows } from './window/modernWindowManager';
import { registerAgentSessionSDKHandlers } from './agent-session-events/agentSessionSDKHandlers';

// Import all IPC handlers
import { registerWindowManagerIpcHandlers } from './window/windowManagerHandlers';
import { registerModernWindowHandlers } from './window/modernWindowHandlers';
import { registerStoreHandlers } from './stores/storeHandlers';
import { registerSecretHandlers } from './stores/secretHandlers';
import { registerLinksHandlers } from './stores/linksHandlers';
import { getTypedStorageManager } from './storage-providers';
import { registerGitHandlers } from './file-system/gitHandlers';
import { registerSSHSetupHandlers } from './services/ipc/git/sshSetupHandlers';
import { setupShellHandlers } from './file-system/shellHandlers';
import { setupTypeExtractionHandlers } from './services/ipc/typeExtractionHandlers';
import { registerPackageManagerHandlers } from './services/ipc/packageManager/packageManagerHandlers';
import { registerSystemHandlers } from './system/systemHandlers';
import { registerFeedbackHandlers } from './services/ipc/feedback/feedbackHandlers';
import { getTerminalManager } from './terminalWrapper';

import { setupAgentConfigHandlers } from './agent-management/agentConfigHandlers';
import { registerFileSystemIpcHandlers } from './file-system/fileSystemHandlers';
import { registerAlexandriaHandlers } from './stores/AlexandriaApiEventHandler';
import { registerWorkspaceHandlers } from './stores/WorkspaceApiEventHandler';
import { registerAlexandriaDocsHandlers } from './stores/AlexandriaDocsApiEventHandler';
import {
  registerRepositoryMonitoringHandlers,
  getManager as getRepositoryMonitoringManager,
} from './repository-monitoring/ipcHandlers';
import { RepositoryRegistrationManager } from '@principal-ai/repository-monitoring-server';
import { registerApiProxyHandlers } from './services/ApiProxyService';
import { registerCLIBridgeHandlers } from './services/ipc/cliBridgeHandlers';
import { JWTService } from './services/JWTService';
import { registerGitHubIpcHandlers } from './version-control-providers/githubHandlers';
import { UserPreferencesHandler } from './stores/userPreferencesHandler';
import {
  getTelemetrySettings,
  refreshTelemetrySettingsFromStore,
} from './telemetry/settings-cache';
import { AppVersionManagerAPIEvent } from '../window/main-process-api-implementations/appVersionManagerApi';
import { registerDockerHandlers } from './services/ipc/docker/dockerHandlers';
import { registerOptimizedDockerHandlers } from './services/ipc/docker/optimizedDockerHandlers';
import {
  registerDocumentSearchHandlers,
  shutdownDocumentSearch,
} from './services/ipc/documentSearchHandlers';
import { setupWindowSwitcherHandlers } from './window/windowSwitcher';
import { setupQuickOpenHandlers } from './window/quickOpen';
import { setupGoodbyeScreenHandlers } from './window/goodbyeScreen';
import { setupSplashScreenHandlers } from './window/splashScreen';
import { registerDevWorkspaceWindowHandlers } from './window/devWorkspaceWindowHandlers';
import { registerExtensionWindowHandlers } from './window/extensionWindowHandlers';
import { extensionDiscoveryService } from './services/ExtensionDiscoveryService';
import {
  registerLocalhostDetectionHandlers,
  cleanupLocalhostWatchers,
} from './services/ipc/localhost/localhostDetectionHandlers';
import { registerProcessHandlers } from './processes/processHandlers';
import { getProcessRegistry } from './processes/ProcessRegistry';
import { registerBrowserIpcHandlers } from './principal-mcp/browserRoutes';
import { registerProcessQuitHandler } from './processes/processLifecycle';
import { registerGitHubArtifactHandlers } from './services/ipc/githubArtifactHandlers';
import { ElectronClipboardAdapter } from './system/clipboardHandler';
import { registerSkillLockHandlers } from './skills/skillLockHandlers';
import { registerSkillEditingHandlers } from './skills/skillEditingHandlers';
import { registerFileCityImageHandlers } from './stores/FileCityImageService';
import { registerBrunoHandlers } from './bruno/brunoHandlers';
import { registerDocumentNotesHandlers } from './document-notes/documentNotesHandlers';

// let agentSessionEventsHttpBridge: AgentSessionEventsHttpBridge | null = null;
let principalMCPBridgePort: number | null = null;

// Setup app version handler
const setupAppVersionHandler = () => {
  const getVersion = () => {
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
  };

  // Async handler for invoke()
  ipcMain.handle(AppVersionManagerAPIEvent.GET_VERSION, () => {
    return getVersion();
  });

  // Sync handler for sendSync() (used by preload for telemetry)
  ipcMain.on(AppVersionManagerAPIEvent.GET_VERSION, (event) => {
    event.returnValue = getVersion();
  });
};

// Setup OTEL endpoint handler
// The endpoint and the on/off switch are resolved once by the main process
// (saved preference > env > default) and handed to the renderer synchronously:
// the preload script runs before any renderer code and cannot await the store.
const setupOtelEndpointHandler = () => {
  const getOtelSettings = () => {
    const settings = getTelemetrySettings();
    return { endpoint: settings.endpoint, enabled: settings.enabled };
  };

  // Sync handler for sendSync() (used by preload for telemetry)
  ipcMain.on('get-otel-endpoint', (event) => {
    event.returnValue = getOtelSettings();
  });
};

// Setup dev mode handler
const setupDevModeHandler = () => {
  ipcMain.handle(AppVersionManagerAPIEvent.IS_DEV_MODE, () => {
    return !app.isPackaged;
  });
};

// Setup HTTP bridges
const setupHttpBridges = async () => {
  // Start the event processing server in utility process
  // This replaces the old AgentSessionEventsHttpBridge
  try {
    await startEventServer();
    const serverManager = getEventServerManager();
    const status = serverManager.getStatus();
    console.log(
      `[Main Process] Event Processing Server started on port ${status.port}`,
    );

    // Listen for server events
    serverManager.on('server-error', (error) => {
      console.error('[Main Process] Event server error:', error);
    });

    serverManager.on('stopped', (code) => {
      console.warn(`[Main Process] Event server stopped with code ${code}`);
    });
  } catch (err) {
    console.error('Event Processing Server failed to start:', err);
  }

  // Start Principal MCP Bridge
  try {
    principalMCPBridgePort = await startPrincipalMCPBridge();
    console.log(
      `[Main Process] Principal MCP Bridge started on port ${principalMCPBridgePort}`,
    );
  } catch (err) {
    console.error('Principal MCP Bridge failed to start:', err);
  }
};

// Register all IPC handlers
const registerAllIpcHandlers = async () => {
  // Register SecureTokenIPC handlers (lazy initialization - no keychain access)
  const { registerSecureTokenHandlers } = require('./services/SecureTokenIPC');
  registerSecureTokenHandlers(); // Registers handlers without creating instance

  // Initialize clipboard adapter
  new ElectronClipboardAdapter();

  registerFileSystemIpcHandlers(applicationWindows);
  registerWindowManagerIpcHandlers(applicationWindows);
  registerModernWindowHandlers(); // Register modern window creation handlers
  registerDevWorkspaceWindowHandlers(); // Register dev-workspace window handlers
  registerExtensionWindowHandlers(); // Register extension browser window handlers
  setupWindowSwitcherHandlers(); // Register window switcher handlers
  setupQuickOpenHandlers(); // Register quick open handlers
  setupGoodbyeScreenHandlers(); // Register goodbye screen handlers
  setupSplashScreenHandlers(); // Register splash screen handlers
  //registerStorageHandlers();
  registerStoreHandlers();
  await registerRepositoryMonitoringHandlers(); // Register repository monitoring handlers
  registerFileCityImageHandlers(); // Register File City image generation handlers
  registerDocumentNotesHandlers(); // Register document-notes IPC handlers
  registerCLIBridgeHandlers(); // Register CLI Bridge diagnostics handlers
  registerSecretHandlers();
  await registerLinksHandlers();
  registerAlexandriaHandlers();
  registerWorkspaceHandlers();
  registerAlexandriaDocsHandlers();
  registerApiProxyHandlers();
  registerBrunoHandlers(); // Register Bruno panel HTTP request handlers
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
  await registerSkillLockHandlers(); // Register skill lock file handlers
  await registerSkillEditingHandlers(); // Register skill editing handlers
  registerGitHandlers();
  registerSSHSetupHandlers();
  registerAgentSessionSDKHandlers(); // SDK-based handlers replace old session handlers
  // Agent installation handlers removed - we only configure hooks now
  setupAgentConfigHandlers();
  setupShellHandlers();
  registerDockerHandlers();
  registerOptimizedDockerHandlers();
  if (process.env.ENABLE_DOC_INDEX === 'true') {
    registerDocumentSearchHandlers();
  } else {
    console.info(
      '[Init] Document search handlers disabled (set ENABLE_DOC_INDEX=true to enable)',
    );
  }

  // LLM Models handlers have been removed
  const typedStore = await getTypedStorageManager();

  // Register User Preferences handlers
  const userPreferencesHandler = new UserPreferencesHandler(typedStore);
  userPreferencesHandler.registerHandlers();

  // Initialize terminal settings (reads daemon mode preference)
  await initializeTerminalSettings();

  // Initialize and register Extension Discovery handlers
  await extensionDiscoveryService.initialize();
  extensionDiscoveryService.registerHandlers();

  setupTypeExtractionHandlers();
  registerPackageManagerHandlers();
  registerSystemHandlers();
  registerFeedbackHandlers();
  registerLocalhostDetectionHandlers();
  registerProcessHandlers();
  registerBrowserIpcHandlers(getProcessRegistry());
  registerProcessQuitHandler();
  registerGitHubArtifactHandlers();
};

// Main initialization function
export const initializeServices = async () => {
  // Register TIPC routers (type-safe RPC)
  registerIpcMain(terminalRouter);
  console.log('[Main Process] TIPC terminal router registered');
  registerIpcMain(githubRouter);
  console.log('[Main Process] TIPC github router registered');
  registerIpcMain(appVersionRouter);
  console.log('[Main Process] TIPC appVersion router registered');
  registerIpcMain(alexandriaRouter);
  console.log('[Main Process] TIPC alexandria router registered');
  registerIpcMain(topicRouter);
  console.log('[Main Process] TIPC topic router registered');
  registerIpcMain(subsystemModelRouter);
  console.log('[Main Process] TIPC subsystem model router registered');
  registerIpcMain(geminiRouter);
  console.log('[Main Process] TIPC gemini router registered');

  // Setup basic IPC handlers
  setupAppVersionHandler();
  setupOtelEndpointHandler();
  setupDevModeHandler();

  // Initialize storage before setting up bridges
  await initializeStorage();

  // Resolve the saved telemetry preference before anything consumes it: the
  // preload scripts read it synchronously, and the child processes below inherit
  // it in their spawn environment.
  await refreshTelemetrySettingsFromStore(
    await getTypedStorageManagerInstance(),
  );

  // Setup HTTP bridges after storage is ready
  await setupHttpBridges();

  // Register all IPC handlers for services that use the appWindows map
  await registerAllIpcHandlers();

  // Scaffold layer handler has been removed

  // initializeTerminalSettings already warms the backend and restores surviving
  // daemon sessions. Startup must never destroy those sessions.

  // Initialize repository monitoring and registration
  // This registers all repositories with the monitoring server and enables git watching
  setTimeout(async () => {
    try {
      console.log(
        '[Main Process] Initializing repository monitoring registration...',
      );
      // Use the singleton monitoring manager instance that IPC handlers use
      const monitoringManager = getRepositoryMonitoringManager();

      const registrationManager = RepositoryRegistrationManager.getInstance({
        monitoringManager,
      });
      await registrationManager.initialize();
      console.log(
        '[Main Process] Repository monitoring registration complete.',
      );
    } catch (error) {
      console.error(
        '[Main Process] Failed to initialize repository monitoring:',
        error,
      );
    }

    // Initialize app's own telemetry
    try {
      const { nodeTelemetry } = await import('./telemetry');
      await nodeTelemetry.initialize();
    } catch (error) {
      console.error(
        '[Main Process] Failed to initialize app telemetry:',
        error,
      );
    }
  }, 2000); // Delay to ensure storage is fully initialized

  // Agent auto-update removed - agents are installed externally
};

// Cleanup function for app shutdown
export const shutdownServices = async () => {
  console.log('[Main Process] Shutting down services.');

  // Shutdown terminal system (stops worker) if terminal manager is available
  const terminalManager = getTerminalManager();
  if (terminalManager) {
    console.log('[Main Process] Shutting down terminal system...');
    terminalManager.shutdown();
  }

  // Stop the event processing server
  try {
    await stopEventServer();
    console.log('[Main Process] Event Processing Server stopped.');
  } catch (err) {
    console.error('[Main Process] Failed to stop event server:', err);
  }

  // Stop Principal MCP Bridge
  stopPrincipalMCPBridge();
  console.log('[Main Process] Principal MCP Bridge stopped.');

  // Shutdown agent auto-update service
  // Auto-update removed - agents are no longer installed by this app
  console.log('[Main Process] Agent auto-update service stopped.');

  // Shutdown document search service
  shutdownDocumentSearch();
  console.log('[Main Process] Document search service stopped.');

  // Cleanup localhost detection watchers
  cleanupLocalhostWatchers();
  console.log('[Main Process] Localhost detection watchers cleaned up.');

  // Flush app telemetry
  try {
    const { nodeTelemetry } = await import('./telemetry');
    await nodeTelemetry.shutdown();
    console.log('[Main Process] App telemetry flushed and shutdown.');
  } catch (err) {
    console.error('[Main Process] Failed to shutdown app telemetry:', err);
  }
};
