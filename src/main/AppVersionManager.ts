import { app, BrowserWindow, ipcMain } from 'electron';
import {
  autoUpdater,
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from 'electron-updater';
import log from 'electron-log';
import { Span, SpanStatusCode } from '@opentelemetry/api';

import { AppVersionManagerAPIEvent } from '../window/main-process-api-implementations/appVersionManagerApi';
import { getTracer } from './telemetry';

type WindowEventData =
  | UpdateInfo
  | UpdateDownloadedEvent
  | ProgressInfo
  | Error
  | { version: string }
  | null;

const tracer = getTracer('app-updates');

export default class AppVersionManager {
  private mainWindow: BrowserWindow | null = null;

  // Active workflow spans for tracking async operations
  private activeCheckSpan: Span | null = null;
  private activeDownloadSpan: Span | null = null;
  private activeInstallSpan: Span | null = null;

  // Track last known available version for telemetry
  private lastAvailableVersion: string = '';

  // Track GitHub request start time for duration calculation
  private githubRequestStartTime: number = 0;

  constructor() {
    // Emit manager initialization event (standalone span since it's synchronous)
    const initSpan = tracer.startSpan('app_updates.manager.initialized');
    initSpan.setAttributes({
      is_packaged: app.isPackaged,
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    });

    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    // Log the log file location
    console.log(
      '[AppUpdater] Log file location:',
      log.transports.file.getFile().path,
    );

    log.info('[AppUpdater] Initializing updater', {
      isPackaged: app.isPackaged,
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    });

    // Log what URL electron-updater will use
    console.log(
      '[AppUpdater] Platform:',
      process.platform,
      'Arch:',
      process.arch,
    );
    console.log(
      '[AppUpdater] Expected update URL path:',
      `${process.platform}-${process.arch}/latest-mac.yml`,
    );

    // Configure update behavior based on environment
    if (!app.isPackaged) {
      log.info(
        '[AppUpdater] Running in development mode - forcing dev update config',
      );
      autoUpdater.forceDevUpdateConfig = true;
      autoUpdater.autoDownload = false; // Don't auto-download in dev mode

      // In dev mode, allow downgrades so we can test any version
      autoUpdater.allowDowngrade = true;

      // Note: In dev mode, signature validation may fail for test builds
      // This is expected and does not affect production builds
      log.info(
        '[AppUpdater] DEV MODE: Using development update configuration with downgrade allowed',
      );
    } else {
      log.info('[AppUpdater] Running in production mode');
      // In production, let user control downloads and installation
      autoUpdater.autoDownload = false; // Let user control downloads
      autoUpdater.autoInstallOnAppQuit = false; // Don't auto-install

      // Ensure signature validation is enabled in production
      delete process.env.ELECTRON_UPDATER_ALLOW_INVALID_SIGNATURE;
    }

    // Configure update feed URL for GitHub releases (direct)
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'principal-ade',
        repo: 'landing-page',
      });
      log.info('[AppUpdater] Update feed URL configured for GitHub releases');
    } catch (error) {
      log.error('[AppUpdater] Failed to set update feed URL:', error);
    }

    // Setup event handlers immediately
    this.setupEventHandlers();

    // Setup IPC handlers
    // Legacy IPC handlers - delegate to public methods
    ipcMain.on(AppVersionManagerAPIEvent.DOWNLOAD_UPDATE, () => {
      this.downloadUpdate();
    });

    ipcMain.on(AppVersionManagerAPIEvent.INSTALL_UPDATE, () => {
      this.installUpdate();
    });

    ipcMain.on(AppVersionManagerAPIEvent.TEST_DOWNLOAD_UPDATE, () => {
      this.testDownloadUpdate();
    });

    ipcMain.on(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_MANUALLY, () => {
      this.checkForUpdate('manual');
    });

    ipcMain.on(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_SILENTLY, () => {
      this.checkForUpdate('silent');
    });

    // Check for updates every hour
    const PERIODIC_CHECK_INTERVAL_MS = 60 * 60 * 1000;
    const PERIODIC_CHECK_TIMEOUT_MS = 30 * 1000; // 30 second timeout

    setInterval(
      () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          log.info('[AppUpdater] Periodic update check triggered');

          // Start check workflow span for periodic check
          this.activeCheckSpan = tracer.startSpan('app_updates.check');
          this.activeCheckSpan.addEvent('app_updates.check.periodic', {
            'interval_ms': PERIODIC_CHECK_INTERVAL_MS,
            'timeout_ms': PERIODIC_CHECK_TIMEOUT_MS,
          });
          this.activeCheckSpan.addEvent('app_updates.check.started', {
            'trigger': 'periodic',
            'current_version': app.getVersion(),
          });

          // Create a timeout promise to catch hangs
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Update check timed out after ${PERIODIC_CHECK_TIMEOUT_MS}ms`));
            }, PERIODIC_CHECK_TIMEOUT_MS);
          });

          // Race the check against the timeout
          Promise.race([
            autoUpdater.checkForUpdates(),
            timeoutPromise,
          ]).catch((err) => {
            log.error('[AppUpdater] Periodic update check failed:', err);
            this.emitErrorEvent('check', err);
          });
        }
      },
      PERIODIC_CHECK_INTERVAL_MS,
    );

    initSpan.setStatus({ code: SpanStatusCode.OK });
    initSpan.end();
  }

  private setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      log.info('[AppUpdater] Checking for update - HTTP request started');

      // Record start time for duration calculation
      this.githubRequestStartTime = Date.now();

      // Add event to check span - this fires when the actual HTTP request begins
      this.activeCheckSpan?.addEvent('app_updates.github.request_started', {
        feed_url: 'github:principal-ade/landing-page',
      });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      // Calculate request duration and emit completion event
      const duration_ms = this.githubRequestStartTime > 0
        ? Date.now() - this.githubRequestStartTime
        : 0;
      this.activeCheckSpan?.addEvent('app_updates.github.request_completed', {
        duration_ms,
        result: 'update_available',
        cached: !this.githubRequestStartTime, // If no start time, likely cached
      });
      this.githubRequestStartTime = 0;

      // Track available version for telemetry
      this.lastAvailableVersion = info.version;

      // Add event to check span
      this.activeCheckSpan?.addEvent('app_updates.check.available', {
        available_version: info.version,
        current_version: app.getVersion(),
        release_date: info.releaseDate || '',
      });
      this.endCheckSpan(SpanStatusCode.OK);

      this.sendToWindow(AppVersionManagerAPIEvent.ON_UPDATE_AVAILABLE, info);
      this.sendToWindow('update-check-complete');
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('Update not available:', JSON.stringify(info, null, 2));

      // Calculate request duration and emit completion event
      const duration_ms = this.githubRequestStartTime > 0
        ? Date.now() - this.githubRequestStartTime
        : 0;
      this.activeCheckSpan?.addEvent('app_updates.github.request_completed', {
        duration_ms,
        result: 'update_not_available',
        cached: !this.githubRequestStartTime, // If no start time, likely cached
      });
      this.githubRequestStartTime = 0;

      // Add event to check span
      this.activeCheckSpan?.addEvent('app_updates.check.not_available', {
        current_version: app.getVersion(),
      });
      this.endCheckSpan(SpanStatusCode.OK);

      this.sendToWindow(
        AppVersionManagerAPIEvent.ON_UPDATE_NOT_AVAILABLE,
        info,
      );
      this.sendToWindow('update-check-complete');
    });

    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
      log_message = `${log_message} - Downloaded ${progressObj.percent}%`;
      log_message = `${log_message} (${progressObj.transferred}/${
        progressObj.total
      })`;
      log.info(log_message);

      // Add progress event to download span
      this.activeDownloadSpan?.addEvent('app_updates.download.progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytes_per_second: progressObj.bytesPerSecond,
      });

      this.sendToWindow(
        AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOAD_PROGRESS,
        progressObj,
      );
    });

    autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
      log.info('Update downloaded');

      // Add completion event to download span
      this.activeDownloadSpan?.addEvent('app_updates.download.completed', {
        version: info.version,
        download_path: info.downloadedFile || '',
      });
      this.endDownloadSpan(SpanStatusCode.OK);

      this.sendToWindow(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOADED, info);
      // No dialog - all update UI is handled in the Settings modal
    });

    autoUpdater.on('error', (err: Error) => {
      log.error('[AppUpdater] Error:', err);

      // Emit error event to the active span
      if (this.activeCheckSpan) {
        this.emitErrorEvent('check', err);
      } else if (this.activeDownloadSpan) {
        this.emitErrorEvent('download', err);
      }
    });
  }

  private emitErrorEvent(phase: 'check' | 'download' | 'install', err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorType = this.classifyError(errorMessage);

    const errorAttributes = {
      error_type: errorType,
      error_message: errorMessage,
      phase,
    };

    if (phase === 'check' && this.activeCheckSpan) {
      this.activeCheckSpan.addEvent('app_updates.error.occurred', errorAttributes);
      this.endCheckSpan(SpanStatusCode.ERROR, errorMessage);
    } else if (phase === 'download' && this.activeDownloadSpan) {
      this.activeDownloadSpan.addEvent('app_updates.error.occurred', errorAttributes);
      this.endDownloadSpan(SpanStatusCode.ERROR, errorMessage);
    } else if (phase === 'install' && this.activeInstallSpan) {
      this.activeInstallSpan.addEvent('app_updates.error.occurred', errorAttributes);
      this.endInstallSpan(SpanStatusCode.ERROR, errorMessage);
    }
  }

  private classifyError(errorMessage: string): string {
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      return 'file_not_found';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect')) {
      return 'connection_refused';
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timed out')) {
      return 'timeout';
    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return 'forbidden';
    } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return 'not_found';
    } else if (errorMessage.includes('CERT') || errorMessage.includes('certificate')) {
      return 'certificate';
    } else if (errorMessage.includes('sha512') || errorMessage.includes('checksum')) {
      return 'checksum';
    }
    return 'unknown';
  }

  private endCheckSpan(code: SpanStatusCode, message?: string) {
    if (this.activeCheckSpan) {
      this.activeCheckSpan.setStatus({ code, message });
      this.activeCheckSpan.end();
      this.activeCheckSpan = null;
    }
  }

  private endDownloadSpan(code: SpanStatusCode, message?: string) {
    if (this.activeDownloadSpan) {
      this.activeDownloadSpan.setStatus({ code, message });
      this.activeDownloadSpan.end();
      this.activeDownloadSpan = null;
    }
  }

  private endInstallSpan(code: SpanStatusCode, message?: string) {
    if (this.activeInstallSpan) {
      this.activeInstallSpan.setStatus({ code, message });
      this.activeInstallSpan.end();
      this.activeInstallSpan = null;
    }
  }

  private sendToWindow(channel: string, data?: WindowEventData) {
    // Broadcast to ALL windows since Settings can be open in any window
    const windows = BrowserWindow.getAllWindows();
    const activeWindows = windows.filter((w) => !w.isDestroyed());

    if (activeWindows.length === 0) {
      log.warn(
        `[AppUpdater] Unable to send event '${channel}' - no windows available`,
      );
      return;
    }

    for (const window of activeWindows) {
      window.webContents.send(channel, data);
    }
  }

  initializeUpdater(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    log.info('[AppUpdater] Main window initialized for updater');
  }

  // ===========================================================================
  // Public methods for TIPC router
  // ===========================================================================

  /**
   * Check for updates (manual or silent trigger)
   */
  checkForUpdate(trigger: 'manual' | 'silent'): void {
    log.info(`[AppUpdater] ${trigger} update check requested`);
    console.log(`[AppUpdater] ${trigger} update check requested via TIPC`);

    // Start check workflow span
    this.activeCheckSpan = tracer.startSpan('app_updates.check');
    // Add manual/silent trigger event to distinguish from periodic checks
    this.activeCheckSpan.addEvent('app_updates.check.user_triggered', {
      'trigger': trigger,
    });
    this.activeCheckSpan.addEvent('app_updates.check.started', {
      'trigger': trigger,
      'current_version': app.getVersion(),
    });

    // In dev mode, temporarily set allowDowngrade to ensure we can test
    if (!app.isPackaged) {
      autoUpdater.allowDowngrade = true;
      if (trigger === 'manual') {
        log.info('[AppUpdater] Dev mode: Allowing downgrade for testing');
      }
    }

    autoUpdater.checkForUpdates().catch((err) => {
      log.error(`[AppUpdater] ${trigger} update check failed:`, err);
      console.error(`[AppUpdater] ${trigger} update check failed:`, err);
      this.emitErrorEvent('check', err);
    });
  }

  /**
   * Download the available update
   */
  downloadUpdate(): void {
    log.info('[AppUpdater] Download update requested via TIPC');
    console.log('[AppUpdater] Starting update download...');

    // Start download workflow span
    this.activeDownloadSpan = tracer.startSpan('app_updates.download');
    this.activeDownloadSpan.addEvent('app_updates.download.started', {
      version: this.lastAvailableVersion,
    });

    autoUpdater.downloadUpdate().catch((err) => {
      log.error('[AppUpdater] Download failed:', err);
      console.error('[AppUpdater] Download failed:', err);
      this.emitErrorEvent('download', err);
      this.sendToWindow('update-error', err);
    });
  }

  /**
   * Install the downloaded update and restart
   */
  installUpdate(): void {
    log.info('[AppUpdater] Install update requested via TIPC');
    console.log('[AppUpdater] Installing update and restarting...');

    // Start install workflow span
    this.activeInstallSpan = tracer.startSpan('app_updates.install');
    this.activeInstallSpan.addEvent('app_updates.install.started', {
      version: this.lastAvailableVersion,
    });

    autoUpdater.quitAndInstall();
  }

  /**
   * Test download without auto-install (dev mode)
   */
  async testDownloadUpdate(): Promise<void> {
    log.info(
      '[AppUpdater] Test download requested - will download but NOT install',
    );
    console.log(
      '[AppUpdater] Test mode: downloading update without auto-install',
    );

    // Start download workflow span for test
    this.activeDownloadSpan = tracer.startSpan('app_updates.download');
    this.activeDownloadSpan.setAttribute('test_mode', true);

    // Send confirmation to renderer that test download is starting
    this.sendToWindow('update-checking');

    // Temporarily disable auto-install
    const originalAutoInstall = autoUpdater.autoInstallOnAppQuit;
    autoUpdater.autoInstallOnAppQuit = false;

    try {
      // First check if update is available
      const updateCheckResult = await autoUpdater.checkForUpdates();
      if (updateCheckResult && updateCheckResult.updateInfo) {
        log.info('[AppUpdater] Update found, starting test download');
        this.activeDownloadSpan?.addEvent('app_updates.download.started', {
          version: updateCheckResult.updateInfo.version,
        });
        await autoUpdater.downloadUpdate();
        log.info('[AppUpdater] Test download completed successfully');
      } else {
        log.info('[AppUpdater] No update available for test download');
        this.sendToWindow('update-not-available', {
          version: app.getVersion(),
        });
        this.endDownloadSpan(SpanStatusCode.OK);
      }
      // Restore original setting
      autoUpdater.autoInstallOnAppQuit = originalAutoInstall;
    } catch (err) {
      log.error('[AppUpdater] Test download failed:', err);
      console.error('[AppUpdater] Test download failed:', err);
      this.emitErrorEvent('download', err);
      this.sendToWindow(
        'update-error',
        err instanceof Error ? err : new Error(String(err)),
      );
      // Restore original setting
      autoUpdater.autoInstallOnAppQuit = originalAutoInstall;
    }
  }

  /**
   * Get current version info
   */
  getVersionInfo(): { version: string; isDevMode: boolean; isPackaged: boolean; platform: string; arch: string } {
    return {
      version: app.getVersion(),
      isDevMode: !app.isPackaged,
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
    };
  }
}
