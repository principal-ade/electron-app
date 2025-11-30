/**
 * ExtensionDiscoveryService - Discovers and manages panel extensions
 *
 * Extensions are stored in ~/.principal/extensions/ by default, but this
 * can be configured via user preferences.
 *
 * Extension packages must have:
 * - "panel-extension" keyword in package.json
 * - A "main" field pointing to the bundle (e.g., "dist/panels.bundle.js")
 * - Export a "panels" array with panel definitions
 */

import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  DiscoveredExtension,
  ExtensionRegistry,
  LoadedExtension,
  PanelMetadata,
} from '../../shared/main-process-api-interfaces/ExtensionAPI';
import { ExtensionAPIEvents } from '../../shared/main-process-api-interfaces/ExtensionAPI';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';

const DEFAULT_EXTENSIONS_DIR = path.join(os.homedir(), '.principal', 'extensions');
const EXTENSIONS_REGISTRY_FILE = 'extensions.json';
const EXTENSION_CACHE_FILE = 'extension-cache.json';

interface PackageJson {
  name: string;
  version: string;
  main?: string;
  author?: string | { name: string };
  description?: string;
  keywords?: string[];
}

interface CachedExtensionMetadata {
  packageName: string;
  packageVersion: string;
  panels: PanelMetadata[];
  cachedAt: number;
}

export class ExtensionDiscoveryService {
  private static instance: ExtensionDiscoveryService;
  private extensionsDirectory: string;
  private registry: ExtensionRegistry;
  private cache: Map<string, CachedExtensionMetadata>;

  private constructor() {
    this.extensionsDirectory = DEFAULT_EXTENSIONS_DIR;
    this.registry = { installed: {} };
    this.cache = new Map();
  }

  static getInstance(): ExtensionDiscoveryService {
    if (!ExtensionDiscoveryService.instance) {
      ExtensionDiscoveryService.instance = new ExtensionDiscoveryService();
    }
    return ExtensionDiscoveryService.instance;
  }

  /**
   * Initialize the service - must be called after app is ready
   */
  async initialize(): Promise<void> {
    // Load custom extensions directory from user preferences if set
    try {
      const prefsHandler = UserPreferencesHandler.getInstance();
      const prefs = await prefsHandler.getUserPreferences();
      if (prefs.extensionsDirectory) {
        this.extensionsDirectory = prefs.extensionsDirectory;
      }
    } catch (error) {
      // UserPreferencesHandler may not be initialized yet, use default
      console.log('[ExtensionDiscoveryService] Using default extensions directory');
    }

    // Ensure extensions directory exists
    await this.ensureExtensionsDirectory();

    // Load registry
    await this.loadRegistry();

    // Load cache
    await this.loadCache();

    console.log('[ExtensionDiscoveryService] Initialized with directory:', this.extensionsDirectory);
  }

  /**
   * Get the current extensions directory
   */
  getExtensionsDirectory(): string {
    return this.extensionsDirectory;
  }

  /**
   * Set a custom extensions directory
   */
  async setExtensionsDirectory(directory: string): Promise<void> {
    this.extensionsDirectory = directory;
    await this.ensureExtensionsDirectory();
    await this.loadRegistry();
    await this.loadCache();
  }

  /**
   * Ensure the extensions directory and required files exist
   */
  private async ensureExtensionsDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.extensionsDirectory)) {
        await fs.promises.mkdir(this.extensionsDirectory, { recursive: true });
        console.log('[ExtensionDiscoveryService] Created extensions directory:', this.extensionsDirectory);
      }

      // Ensure .principal directory exists (parent of extensions)
      const principalDir = path.dirname(this.extensionsDirectory);
      if (!fs.existsSync(principalDir)) {
        await fs.promises.mkdir(principalDir, { recursive: true });
      }
    } catch (error) {
      console.error('[ExtensionDiscoveryService] Failed to create extensions directory:', error);
    }
  }

  /**
   * Load the extension registry from disk
   */
  private async loadRegistry(): Promise<void> {
    const registryPath = path.join(path.dirname(this.extensionsDirectory), EXTENSIONS_REGISTRY_FILE);

    try {
      if (fs.existsSync(registryPath)) {
        const data = await fs.promises.readFile(registryPath, 'utf-8');
        this.registry = JSON.parse(data);
      } else {
        this.registry = { installed: {} };
      }
    } catch (error) {
      console.error('[ExtensionDiscoveryService] Failed to load registry:', error);
      this.registry = { installed: {} };
    }
  }

  /**
   * Save the extension registry to disk
   */
  private async saveRegistry(): Promise<void> {
    const registryPath = path.join(path.dirname(this.extensionsDirectory), EXTENSIONS_REGISTRY_FILE);

    try {
      await fs.promises.writeFile(registryPath, JSON.stringify(this.registry, null, 2), 'utf-8');
    } catch (error) {
      console.error('[ExtensionDiscoveryService] Failed to save registry:', error);
    }
  }

  /**
   * Load the extension metadata cache from disk
   */
  private async loadCache(): Promise<void> {
    const cachePath = path.join(path.dirname(this.extensionsDirectory), EXTENSION_CACHE_FILE);

    try {
      if (fs.existsSync(cachePath)) {
        const data = await fs.promises.readFile(cachePath, 'utf-8');
        const cacheData = JSON.parse(data) as Record<string, CachedExtensionMetadata>;
        this.cache = new Map(Object.entries(cacheData));
      }
    } catch (error) {
      console.error('[ExtensionDiscoveryService] Failed to load cache:', error);
      this.cache = new Map();
    }
  }

  /**
   * Save the extension metadata cache to disk
   */
  private async saveCache(): Promise<void> {
    const cachePath = path.join(path.dirname(this.extensionsDirectory), EXTENSION_CACHE_FILE);

    try {
      const cacheData = Object.fromEntries(this.cache);
      await fs.promises.writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    } catch (error) {
      console.error('[ExtensionDiscoveryService] Failed to save cache:', error);
    }
  }

  /**
   * Check if a directory entry is a directory (or symlink to a directory)
   */
  private isDirectoryEntry(entry: fs.Dirent, parentPath: string): boolean {
    if (entry.isDirectory()) return true;
    if (entry.isSymbolicLink()) {
      try {
        const fullPath = path.join(parentPath, entry.name);
        const stat = fs.statSync(fullPath);
        return stat.isDirectory();
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Discover all installed panel extensions
   */
  async discoverExtensions(): Promise<DiscoveredExtension[]> {
    const extensions: DiscoveredExtension[] = [];

    if (!fs.existsSync(this.extensionsDirectory)) {
      return extensions;
    }

    try {
      const entries = await fs.promises.readdir(this.extensionsDirectory, { withFileTypes: true });

      for (const entry of entries) {
        if (!this.isDirectoryEntry(entry, this.extensionsDirectory)) continue;

        // Handle scoped packages (@org/package-name)
        if (entry.name.startsWith('@')) {
          const scopePath = path.join(this.extensionsDirectory, entry.name);
          const scopedEntries = await fs.promises.readdir(scopePath, { withFileTypes: true });

          for (const scopedEntry of scopedEntries) {
            if (!this.isDirectoryEntry(scopedEntry, scopePath)) continue;

            const packageName = `${entry.name}/${scopedEntry.name}`;
            const packagePath = path.join(scopePath, scopedEntry.name);
            const extension = await this.loadExtensionMetadata(packageName, packagePath);

            if (extension) {
              extensions.push(extension);
            }
          }
        } else {
          // Regular package
          const packagePath = path.join(this.extensionsDirectory, entry.name);
          const extension = await this.loadExtensionMetadata(entry.name, packagePath);

          if (extension) {
            extensions.push(extension);
          }
        }
      }
    } catch (error) {
      console.error('[ExtensionDiscoveryService] Failed to discover extensions:', error);
    }

    return extensions;
  }

  /**
   * Load metadata for a single extension package
   */
  private async loadExtensionMetadata(
    packageName: string,
    packagePath: string
  ): Promise<DiscoveredExtension | null> {
    const packageJsonPath = path.join(packagePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageJsonData = await fs.promises.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonData) as PackageJson;

      // Check for panel-extension keyword
      if (!packageJson.keywords?.includes('panel-extension')) {
        return null;
      }

      // Validate required fields
      if (!packageJson.main) {
        console.warn(`[ExtensionDiscoveryService] Extension ${packageName} missing 'main' field`);
        return null;
      }

      const bundlePath = path.join(packagePath, packageJson.main);

      if (!fs.existsSync(bundlePath)) {
        console.warn(`[ExtensionDiscoveryService] Extension ${packageName} bundle not found at ${bundlePath}`);
        return null;
      }

      // Get author string
      const author = typeof packageJson.author === 'string'
        ? packageJson.author
        : packageJson.author?.name;

      // Check cache for panel metadata
      let panels: PanelMetadata[] = [];
      const cached = this.cache.get(packageName);

      if (cached && cached.packageVersion === packageJson.version) {
        // Use cached panel metadata
        panels = cached.panels;
      } else {
        // Load and cache panel metadata
        panels = await this.extractPanelMetadata(bundlePath, packageName);

        // Update cache
        this.cache.set(packageName, {
          packageName,
          packageVersion: packageJson.version,
          panels,
          cachedAt: Date.now(),
        });
        await this.saveCache();
      }

      // Get enabled state from registry
      const registryEntry = this.registry.installed[packageName];
      const enabled = registryEntry?.enabled ?? true;
      const installedAt = registryEntry?.installedAt;

      // Update registry if this is a new extension
      if (!registryEntry) {
        this.registry.installed[packageName] = {
          version: packageJson.version,
          enabled: true,
          installedAt: new Date().toISOString(),
        };
        await this.saveRegistry();
      }

      return {
        packageName,
        packagePath,
        bundlePath,
        packageVersion: packageJson.version,
        packageAuthor: author,
        packageDescription: packageJson.description,
        panels,
        enabled,
        installedAt,
      };
    } catch (error) {
      console.error(`[ExtensionDiscoveryService] Failed to load extension ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Extract panel metadata from the extension bundle
   * Note: This loads the module to extract metadata, but doesn't keep it loaded
   */
  private async extractPanelMetadata(
    bundlePath: string,
    packageName: string
  ): Promise<PanelMetadata[]> {
    try {
      // Resolve symlinks to get the real path for dynamic import
      const realBundlePath = fs.realpathSync(bundlePath);
      // Use native Node.js import to bypass webpack's module resolution
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const importFn = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
      const module = await importFn(`file://${realBundlePath}`);

      if (!Array.isArray(module.panels)) {
        console.warn(`[ExtensionDiscoveryService] Extension ${packageName} must export a 'panels' array`);
        return [];
      }

      // Extract just the metadata (not the components)
      // Panel definitions use nested metadata: { metadata: { id, name, ... }, component }
      return module.panels.map((panel: any) => ({
        id: panel.metadata.id,
        name: panel.metadata.name,
        icon: panel.metadata.icon,
        version: panel.metadata.version,
        author: panel.metadata.author,
        description: panel.metadata.description,
        surfaces: panel.metadata.surfaces,
        slices: panel.metadata.slices,
      }));
    } catch (error) {
      console.error(`[ExtensionDiscoveryService] Failed to extract panel metadata from ${packageName}:`, error);
      return [];
    }
  }

  /**
   * Load an extension for use (returns bundle path for renderer to import)
   */
  async loadExtension(packageName: string): Promise<LoadedExtension | null> {
    const extensions = await this.discoverExtensions();
    const extension = extensions.find((e) => e.packageName === packageName);

    if (!extension) {
      console.error(`[ExtensionDiscoveryService] Extension not found: ${packageName}`);
      return null;
    }

    if (!extension.enabled) {
      console.error(`[ExtensionDiscoveryService] Extension is disabled: ${packageName}`);
      return null;
    }

    return {
      packageName: extension.packageName,
      bundlePath: extension.bundlePath,
      panels: extension.panels,
    };
  }

  /**
   * Fetch an extension's bundle content as a base64 string
   * This allows the renderer to load the bundle via Blob URL,
   * bypassing file:// protocol restrictions
   */
  async fetchExtensionBundle(packageName: string): Promise<string | null> {
    const extension = await this.loadExtension(packageName);

    if (!extension) {
      return null;
    }

    try {
      // Resolve symlinks to get the real path
      const realBundlePath = fs.realpathSync(extension.bundlePath);
      const bundleContent = await fs.promises.readFile(realBundlePath, 'utf-8');
      return bundleContent;
    } catch (error) {
      console.error(`[ExtensionDiscoveryService] Failed to fetch bundle for ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Enable an extension
   */
  async enableExtension(packageName: string): Promise<void> {
    if (this.registry.installed[packageName]) {
      this.registry.installed[packageName].enabled = true;
      await this.saveRegistry();
      this.broadcastExtensionsChanged();
    }
  }

  /**
   * Disable an extension
   */
  async disableExtension(packageName: string): Promise<void> {
    if (this.registry.installed[packageName]) {
      this.registry.installed[packageName].enabled = false;
      await this.saveRegistry();
      this.broadcastExtensionsChanged();
    }
  }

  /**
   * Uninstall an extension
   */
  async uninstallExtension(packageName: string): Promise<void> {
    // Determine package path
    let packagePath: string;
    if (packageName.startsWith('@')) {
      // Scoped package
      packagePath = path.join(this.extensionsDirectory, ...packageName.split('/'));
    } else {
      packagePath = path.join(this.extensionsDirectory, packageName);
    }

    try {
      if (fs.existsSync(packagePath)) {
        await fs.promises.rm(packagePath, { recursive: true, force: true });
      }

      // Remove from registry
      delete this.registry.installed[packageName];
      await this.saveRegistry();

      // Remove from cache
      this.cache.delete(packageName);
      await this.saveCache();

      this.broadcastExtensionsChanged();

      console.log(`[ExtensionDiscoveryService] Uninstalled extension: ${packageName}`);
    } catch (error) {
      console.error(`[ExtensionDiscoveryService] Failed to uninstall extension ${packageName}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast extensions changed event to all windows
   */
  private async broadcastExtensionsChanged(): Promise<void> {
    const extensions = await this.discoverExtensions();

    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(ExtensionAPIEvents.EXTENSIONS_CHANGED, extensions);
    });
  }

  /**
   * Register IPC handlers
   */
  registerHandlers(): void {
    ipcMain.handle(ExtensionAPIEvents.DISCOVER_EXTENSIONS, async () => {
      return this.discoverExtensions();
    });

    ipcMain.handle(ExtensionAPIEvents.GET_EXTENSIONS_DIRECTORY, async () => {
      return this.getExtensionsDirectory();
    });

    ipcMain.handle(ExtensionAPIEvents.LOAD_EXTENSION, async (_event, packageName: string) => {
      return this.loadExtension(packageName);
    });

    ipcMain.handle(ExtensionAPIEvents.FETCH_EXTENSION_BUNDLE, async (_event, packageName: string) => {
      return this.fetchExtensionBundle(packageName);
    });

    ipcMain.handle(ExtensionAPIEvents.ENABLE_EXTENSION, async (_event, packageName: string) => {
      return this.enableExtension(packageName);
    });

    ipcMain.handle(ExtensionAPIEvents.DISABLE_EXTENSION, async (_event, packageName: string) => {
      return this.disableExtension(packageName);
    });

    ipcMain.handle(ExtensionAPIEvents.UNINSTALL_EXTENSION, async (_event, packageName: string) => {
      return this.uninstallExtension(packageName);
    });

    console.log('[ExtensionDiscoveryService] IPC handlers registered');
  }
}

// Export singleton instance
export const extensionDiscoveryService = ExtensionDiscoveryService.getInstance();
