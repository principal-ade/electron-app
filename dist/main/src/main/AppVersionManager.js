import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { AppVersionManagerAPIEvent } from '../window/main-process-api-implementations/appVersionManagerApi';
export default class AppVersionManager {
    mainWindow = null;
    constructor() {
        log.transports.file.level = 'info';
        autoUpdater.logger = log;
        // Log the log file location
        console.log('[AppUpdater] Log file location:', log.transports.file.getFile().path);
        log.info('[AppUpdater] Initializing updater', {
            isPackaged: app.isPackaged,
            version: app.getVersion(),
            platform: process.platform,
            arch: process.arch
        });
        // Log what URL electron-updater will use
        console.log('[AppUpdater] Platform:', process.platform, 'Arch:', process.arch);
        console.log('[AppUpdater] Expected update URL path:', `${process.platform}-${process.arch}/latest-mac.yml`);
        // Configure update behavior based on environment
        if (!app.isPackaged) {
            log.info('[AppUpdater] Running in development mode - forcing dev update config');
            autoUpdater.forceDevUpdateConfig = true;
            autoUpdater.autoDownload = false; // Don't auto-download in dev mode
            // In dev mode, allow downgrades so we can test any version
            autoUpdater.allowDowngrade = true;
            // Note: In dev mode, signature validation may fail for test builds
            // This is expected and does not affect production builds
            log.info('[AppUpdater] DEV MODE: Using development update configuration with downgrade allowed');
        }
        else {
            log.info('[AppUpdater] Running in production mode');
            // In production, let user control downloads and installation
            autoUpdater.autoDownload = false; // Let user control downloads
            autoUpdater.autoInstallOnAppQuit = false; // Don't auto-install
            // Ensure signature validation is enabled in production
            delete process.env.ELECTRON_UPDATER_ALLOW_INVALID_SIGNATURE;
        }
        // Configure update feed URL for custom endpoint (proxies to GitHub)
        try {
            autoUpdater.setFeedURL({
                provider: 'generic',
                url: 'https://principle-md.com/api/updates',
                channel: 'latest',
            });
            log.info('[AppUpdater] Update feed URL configured successfully');
        }
        catch (error) {
            log.error('[AppUpdater] Failed to set update feed URL:', error);
        }
        // Setup event handlers immediately
        this.setupEventHandlers();
        // Setup IPC handlers
        ipcMain.on(AppVersionManagerAPIEvent.DOWNLOAD_UPDATE, () => {
            log.info('[AppUpdater] Download update requested via IPC');
            console.log('[AppUpdater] Starting update download...');
            autoUpdater.downloadUpdate().catch((err) => {
                log.error('[AppUpdater] Download failed:', err);
                console.error('[AppUpdater] Download failed:', err);
                this.sendToWindow('update-error', err);
            });
        });
        ipcMain.on(AppVersionManagerAPIEvent.INSTALL_UPDATE, () => {
            log.info('[AppUpdater] Install update requested via IPC');
            console.log('[AppUpdater] Installing update and restarting...');
            autoUpdater.quitAndInstall();
        });
        // Test handler to download without installing
        ipcMain.on(AppVersionManagerAPIEvent.TEST_DOWNLOAD_UPDATE, async () => {
            log.info('[AppUpdater] Test download requested - will download but NOT install');
            console.log('[AppUpdater] Test mode: downloading update without auto-install');
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
                    await autoUpdater.downloadUpdate();
                    log.info('[AppUpdater] Test download completed successfully');
                }
                else {
                    log.info('[AppUpdater] No update available for test download');
                    this.sendToWindow('update-not-available', { version: app.getVersion() });
                }
                // Restore original setting
                autoUpdater.autoInstallOnAppQuit = originalAutoInstall;
            }
            catch (err) {
                log.error('[AppUpdater] Test download failed:', err);
                console.error('[AppUpdater] Test download failed:', err);
                this.sendToWindow('update-error', err);
                // Restore original setting
                autoUpdater.autoInstallOnAppQuit = originalAutoInstall;
            }
        });
        ipcMain.on(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_MANUALLY, () => {
            log.info('[AppUpdater] Manual update check requested');
            console.log('[AppUpdater] Manual update check requested via IPC');
            // In dev mode, temporarily set allowDowngrade to ensure we can test
            if (!app.isPackaged) {
                autoUpdater.allowDowngrade = true;
                log.info('[AppUpdater] Dev mode: Allowing downgrade for testing');
            }
            autoUpdater.checkForUpdates().catch((err) => {
                log.error('[AppUpdater] Update check failed:', err);
                console.error('[AppUpdater] Update check failed:', err);
            });
        });
        ipcMain.on(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_SILENTLY, () => {
            log.info('[AppUpdater] Silent update check requested');
            console.log('[AppUpdater] Silent update check requested via IPC');
            // In dev mode, temporarily set allowDowngrade to ensure we can test
            if (!app.isPackaged) {
                autoUpdater.allowDowngrade = true;
            }
            autoUpdater.checkForUpdates().catch((err) => {
                log.error('[AppUpdater] Silent update check failed:', err);
                console.error('[AppUpdater] Silent update check failed:', err);
            });
        });
        // Check for updates every hour
        setInterval(() => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                log.info('[AppUpdater] Periodic update check triggered');
                autoUpdater.checkForUpdates().catch((err) => {
                    log.error('[AppUpdater] Periodic update check failed:', err);
                });
            }
        }, 60 * 60 * 1000);
    }
    setupEventHandlers() {
        autoUpdater.on('update-available', (info) => {
            log.info('Update available:', JSON.stringify(info, null, 2));
            this.sendToWindow(AppVersionManagerAPIEvent.ON_UPDATE_AVAILABLE, info);
            this.sendToWindow('update-check-complete');
        });
        autoUpdater.on('update-not-available', (info) => {
            log.info('Update not available:', JSON.stringify(info, null, 2));
            this.sendToWindow(AppVersionManagerAPIEvent.ON_UPDATE_NOT_AVAILABLE, info);
            this.sendToWindow('update-check-complete');
        });
        autoUpdater.on('download-progress', (progressObj) => {
            let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
            log_message = `${log_message} - Downloaded ${progressObj.percent}%`;
            log_message = `${log_message} (${progressObj.transferred}/${progressObj.total})`;
            log.info(log_message);
            this.sendToWindow(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOAD_PROGRESS, progressObj);
        });
        autoUpdater.on('update-downloaded', (info) => {
            log.info('Update downloaded');
            this.sendToWindow(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOADED, info);
            // No dialog - all update UI is handled in the Settings modal
        });
    }
    sendToWindow(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
        else {
            // Log that we couldn't send the event because window isn't ready
            log.warn(`[AppUpdater] Unable to send event '${channel}' - window not available`);
        }
    }
    initializeUpdater(mainWindow) {
        this.mainWindow = mainWindow;
        log.info('[AppUpdater] Main window initialized for updater');
    }
}
