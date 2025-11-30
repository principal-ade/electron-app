/**
 * Extension API - Interface for panel extension discovery and management
 */

/**
 * Metadata for a single panel within an extension package
 */
export interface PanelMetadata {
  /** Unique identifier (e.g., 'publisher.panel-name') */
  id: string;
  /** Display name */
  name: string;
  /** Icon (emoji or URL) */
  icon?: string;
  /** Semantic version */
  version?: string;
  /** Author name or organization */
  author?: string;
  /** Short description */
  description?: string;
  /** Where panel can be displayed */
  surfaces?: string[];
  /** Data slice dependencies */
  slices?: string[];
}

/**
 * A discovered extension package
 */
export interface DiscoveredExtension {
  /** NPM package name (e.g., '@industry-theme/visual-validation-panel') */
  packageName: string;
  /** Absolute path to the package directory */
  packagePath: string;
  /** Absolute path to the bundle file */
  bundlePath: string;
  /** Package version from package.json */
  packageVersion: string;
  /** Package author from package.json */
  packageAuthor?: string;
  /** Package description from package.json */
  packageDescription?: string;
  /** All panels exported by this package */
  panels: PanelMetadata[];
  /** Whether the extension is enabled */
  enabled: boolean;
  /** When the extension was installed */
  installedAt?: string;
}

/**
 * Extension registry stored in extensions.json
 */
export interface ExtensionRegistry {
  /** Map of package name to installation info */
  installed: Record<
    string,
    {
      version: string;
      enabled: boolean;
      installedAt: string;
    }
  >;
}

/**
 * Result of loading an extension
 */
export interface LoadedExtension {
  packageName: string;
  bundlePath: string;
  panels: PanelMetadata[];
}

/**
 * IPC Event names for Extension API
 */
export const ExtensionAPIEvents = {
  // Discovery
  DISCOVER_EXTENSIONS: 'extension:discover',
  GET_EXTENSIONS_DIRECTORY: 'extension:get-directory',

  // Extension management
  LOAD_EXTENSION: 'extension:load',
  FETCH_EXTENSION_BUNDLE: 'extension:fetch-bundle',
  ENABLE_EXTENSION: 'extension:enable',
  DISABLE_EXTENSION: 'extension:disable',
  UNINSTALL_EXTENSION: 'extension:uninstall',

  // Events broadcast to renderer
  EXTENSIONS_CHANGED: 'extension:changed',
} as const;

/**
 * Extension API interface exposed to renderer
 */
export interface ExtensionAPI {
  /**
   * Discover all installed panel extensions
   */
  discoverExtensions(): Promise<DiscoveredExtension[]>;

  /**
   * Get the current extensions directory path
   */
  getExtensionsDirectory(): Promise<string>;

  /**
   * Load a specific extension and get its bundle path
   */
  loadExtension(packageName: string): Promise<LoadedExtension | null>;

  /**
   * Fetch an extension's bundle content as a base64 string
   * Used to load the bundle in the renderer via Blob URL
   */
  fetchExtensionBundle(packageName: string): Promise<string | null>;

  /**
   * Enable an extension
   */
  enableExtension(packageName: string): Promise<void>;

  /**
   * Disable an extension
   */
  disableExtension(packageName: string): Promise<void>;

  /**
   * Uninstall an extension (removes from extensions directory)
   */
  uninstallExtension(packageName: string): Promise<void>;

  /**
   * Subscribe to extension changes
   */
  onExtensionsChanged(callback: (extensions: DiscoveredExtension[]) => void): () => void;
}
