/**
 * Main process handler for Alexandria repository management
 */
import { ipcMain, BrowserWindow } from 'electron';
import { AlexandriaAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
export class AlexandriaApiEventHandler {
    registryService;
    constructor() {
        this.registryService = AlexandriaRegistryService.getInstance();
    }
    // This is implemented in the preload/renderer side, not in main process
    onRepositoryChange() {
        throw new Error('onRepositoryChange is only available in renderer process');
    }
    /**
     * Broadcast Alexandria events to all windows
     */
    broadcastAlexandriaEvent(eventType, data) {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((window) => {
            if (!window.isDestroyed()) {
                window.webContents.send(eventType, data);
            }
        });
    }
    async getRepositories() {
        return this.registryService.getRepositories();
    }
    async getRepository(name) {
        return this.registryService.getRepository(name);
    }
    async getRepositoryByPath(path) {
        return this.registryService.getRepositoryByPath(path);
    }
    async registerRepository(name, path) {
        const repo = await this.registryService.registerRepository(name, path);
        // Broadcast the event to all windows
        this.broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_ADDED, repo);
        return repo;
    }
    async removeRepository(name) {
        const success = await this.registryService.removeRepository(name);
        if (success) {
            // Broadcast the event to all windows
            this.broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_REMOVED, { name });
        }
        return success;
    }
    async searchRepositories(query) {
        return this.registryService.searchRepositories(query);
    }
    async getRepositoriesWithViews() {
        return this.registryService.getRepositoriesWithViews();
    }
    async refreshRepository(name) {
        const repo = await this.registryService.refreshRepository(name);
        if (repo) {
            // Broadcast the event to all windows
            this.broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_UPDATED, repo);
        }
        return repo;
    }
    async getRepositoryCount() {
        return this.registryService.getRepositoryCount();
    }
    /**
     * Clean up handlers when shutting down
     */
    destroy() {
        // Remove all handlers using enum values
        ipcMain.removeHandler(AlexandriaAPIEvent.GET_ALL);
        ipcMain.removeHandler(AlexandriaAPIEvent.GET);
        ipcMain.removeHandler(AlexandriaAPIEvent.GET_BY_PATH);
        ipcMain.removeHandler(AlexandriaAPIEvent.REGISTER);
        ipcMain.removeHandler(AlexandriaAPIEvent.REMOVE);
        ipcMain.removeHandler(AlexandriaAPIEvent.SEARCH);
        ipcMain.removeHandler(AlexandriaAPIEvent.GET_WITH_VIEWS);
        ipcMain.removeHandler(AlexandriaAPIEvent.REFRESH);
        ipcMain.removeHandler(AlexandriaAPIEvent.GET_COUNT);
    }
}
/**
 * Register Alexandria IPC handlers
 */
export function registerAlexandriaHandlers() {
    const handler = new AlexandriaApiEventHandler();
    // Register all IPC handlers using enum values
    ipcMain.handle(AlexandriaAPIEvent.GET_ALL, () => handler.getRepositories());
    ipcMain.handle(AlexandriaAPIEvent.GET, (_, name) => handler.getRepository(name));
    ipcMain.handle(AlexandriaAPIEvent.GET_BY_PATH, (_, path) => handler.getRepositoryByPath(path));
    ipcMain.handle(AlexandriaAPIEvent.REGISTER, (_, name, path) => handler.registerRepository(name, path));
    ipcMain.handle(AlexandriaAPIEvent.REMOVE, (_, name) => handler.removeRepository(name));
    ipcMain.handle(AlexandriaAPIEvent.SEARCH, (_, query) => handler.searchRepositories(query));
    ipcMain.handle(AlexandriaAPIEvent.GET_WITH_VIEWS, () => handler.getRepositoriesWithViews());
    ipcMain.handle(AlexandriaAPIEvent.REFRESH, (_, name) => handler.refreshRepository(name));
    ipcMain.handle(AlexandriaAPIEvent.GET_COUNT, () => handler.getRepositoryCount());
    console.log('[Alexandria] IPC handlers registered');
}
