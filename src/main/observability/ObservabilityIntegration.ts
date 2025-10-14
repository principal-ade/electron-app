/**
 * ObservabilityIntegration - Connects RepoEvents from the event pipeline to the @a24z/observability-sdk
 *
 * This module integrates the agent monitoring pipeline with the observability SDK,
 * forwarding RepoNormalized events for centralized monitoring and analytics.
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as path from 'path';
// @ts-ignore - Type definitions not available yet
import { TursoObservabilitySDK } from '@a24z/observability-sdk';

interface TursoConfig {
  url: string;
  authToken?: string;
}
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { UnifiedSecureStorage } from '../services/UnifiedSecureStorage';

export type StorageMode = 'none' | 'local' | 'local-with-sync';

export interface ObservabilityConfig {
  storageMode?: StorageMode;
  localDbPath?: string;
  tursoUrl?: string;
  tursoAuthToken?: string;
  syncInterval?: number;
  environment?: 'development' | 'staging' | 'production';
  batchSize?: number;
  flushInterval?: number;
  debug?: boolean;
  enabled?: boolean;
}

export class ObservabilityIntegration extends EventEmitter {
  private sdk: TursoObservabilitySDK | null = null;
  private isInitialized: boolean = false;
  private eventCount: number = 0;
  private errorCount: number = 0;
  private config: ObservabilityConfig;
  private storage: UnifiedSecureStorage;

  constructor(config: ObservabilityConfig = {}) {
    super();
    this.config = config;
    this.storage = UnifiedSecureStorage.getInstance();

    // Don't initialize SDK in constructor - wait for initialize() to be called
    console.log(
      '[ObservabilityIntegration] Created, waiting for initialization',
    );
  }

  /**
   * Load configuration from UnifiedSecureStorage
   */
  private async loadConfiguration(): Promise<ObservabilityConfig | null> {
    try {
      const stored = await this.storage.getSecrets('observability-config');
      if (stored && Object.keys(stored).length > 0) {
        return {
          storageMode: (stored.storageMode as StorageMode) || 'none',
          localDbPath: stored.localDbPath,
          tursoUrl: stored.tursoUrl,
          tursoAuthToken: stored.tursoAuthToken,
          syncInterval: stored.syncInterval ? parseInt(stored.syncInterval) : 5000,
          environment: (stored.environment as 'development' | 'staging' | 'production') || 'development',
          enabled: stored.enabled === 'true',
          debug: stored.debug === 'true',
        };
      }
    } catch (error) {
      console.error(
        '[ObservabilityIntegration] Failed to load configuration:',
        error,
      );
    }
    return null;
  }

  /**
   * Save configuration to UnifiedSecureStorage
   */
  async saveConfiguration(config: ObservabilityConfig): Promise<void> {
    const secrets: Record<string, string> = {};
    if (config.storageMode) secrets.storageMode = config.storageMode;
    if (config.localDbPath) secrets.localDbPath = config.localDbPath;
    if (config.tursoUrl) secrets.tursoUrl = config.tursoUrl;
    if (config.tursoAuthToken) secrets.tursoAuthToken = config.tursoAuthToken;
    if (config.syncInterval !== undefined) secrets.syncInterval = config.syncInterval.toString();
    if (config.environment) secrets.environment = config.environment;
    secrets.enabled = config.enabled ? 'true' : 'false';
    secrets.debug = config.debug ? 'true' : 'false';

    await this.storage.storeSecrets(
      'observability-config',
      'observability-config',
      secrets,
    );
    this.config = config;
  }

  /**
   * Resolve database path to absolute path in userData directory
   * This is critical for packaged apps where relative paths may resolve to read-only directories
   */
  private resolveDbPath(dbPath?: string): string {
    const finalPath = dbPath || 'observability.db';

    // If it's already an absolute path, return it
    if (path.isAbsolute(finalPath)) {
      return finalPath;
    }

    // For relative paths, resolve from userData directory
    const userDataPath = app.getPath('userData');
    return path.resolve(userDataPath, finalPath);
  }

  /**
   * Initialize SDK based on storage mode
   */
  private async initializeSDK(storageMode: StorageMode, config: ObservabilityConfig): Promise<void> {
    // @ts-ignore - Type definitions not available yet
    const { TursoObservabilitySDK } = await import('@a24z/observability-sdk');

    // Resolve the database path to an absolute path in userData directory
    const resolvedDbPath = this.resolveDbPath(config.localDbPath);

    switch (storageMode) {
      case 'local':
        // Local mode - SQLite file only
        this.sdk = TursoObservabilitySDK.createLocal(resolvedDbPath);
        console.log(`[ObservabilityIntegration] Local mode initialized: ${resolvedDbPath}`);
        break;

      case 'local-with-sync':
        // Embedded replica mode - local file with cloud sync
        if (!config.tursoUrl) {
          throw new Error('Turso URL required for local-with-sync mode');
        }
        this.sdk = TursoObservabilitySDK.createEmbeddedReplica(
          resolvedDbPath,
          config.tursoUrl,
          config.tursoAuthToken || '',
          config.syncInterval || 5000
        );
        console.log(`[ObservabilityIntegration] Local-with-sync mode initialized: ${resolvedDbPath} syncing to ${config.tursoUrl}`);
        break;

      default:
        throw new Error(`Unknown storage mode: ${storageMode}`);
    }

    // Initialize the database schema (creates tables if they don't exist)
    await this.sdk.initializeSchema();

    console.log('[ObservabilityIntegration] SDK initialized with schema');
  }

  /**
   * Initialize the SDK and start processing events
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load configuration from UnifiedSecureStorage
      const loadedConfig = await this.loadConfiguration();
      if (loadedConfig) {
        this.config = { ...this.config, ...loadedConfig };
      }

      // Determine storage mode (fallback to env vars for backward compatibility)
      const storageMode = this.config.storageMode || 'none';

      // Check if observability is disabled
      if (storageMode === 'none' || this.config.enabled === false) {
        console.log('[ObservabilityIntegration] Observability disabled');
        return;
      }

      // For backward compatibility, check env vars if config is missing
      if (storageMode === 'local-with-sync') {
        this.config.tursoUrl = this.config.tursoUrl || process.env.TURSO_DATABASE_URL;
        this.config.tursoAuthToken = this.config.tursoAuthToken || process.env.TURSO_AUTH_TOKEN;
      }

      // Initialize the SDK based on storage mode
      await this.initializeSDK(storageMode, this.config);

      this.isInitialized = true;
      console.log('[ObservabilityIntegration] SDK ready for event processing');
      this.emit('initialized');
    } catch (error) {
      console.error('[ObservabilityIntegration] Failed to initialize:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process a RepoNormalized event from the pipeline
   */
  async processRepoEvent(
    event: RepoNormalizedUniversalAgentSessionEvent,
  ): Promise<void> {
    if (!this.isInitialized || !this.sdk) {
      return;
    }

    try {
      // Use the Turso SDK's writeNormalizedEvent method
      await this.sdk.writeNormalizedEvent(event);

      this.eventCount++;

      // Log progress periodically
      if (this.eventCount % 10 === 0) {
        console.log(
          `[ObservabilityIntegration] Processed ${this.eventCount} events`,
        );
      }

      // Emit for monitoring
      this.emit('event-tracked', event);
    } catch (error) {
      this.errorCount++;
      console.error(
        '[ObservabilityIntegration] Error processing event:',
        error,
      );
      this.emit('error', error);
    }
  }

  /**
   * Flush any pending events
   */
  async flush(): Promise<void> {
    // The SDK handles its own batching internally
    // No explicit flush method available
    console.log(
      '[ObservabilityIntegration] Flush requested (handled internally by SDK)',
    );
  }

  /**
   * Shutdown the integration
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized || !this.sdk) {
      return;
    }

    try {
      await this.sdk.close();
      this.isInitialized = false;
      console.log(
        `[ObservabilityIntegration] Shutdown complete. Processed ${this.eventCount} tool calls, ${this.errorCount} errors`,
      );
      this.emit('shutdown');
    } catch (error) {
      console.error('[ObservabilityIntegration] Error during shutdown:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get statistics about the integration
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      eventCount: this.eventCount,
      errorCount: this.errorCount,
      errorRate: this.eventCount > 0 ? this.errorCount / this.eventCount : 0,
    };
  }

  /**
   * Test connection with provided configuration
   */
  async testConnection(
    config: ObservabilityConfig,
  ): Promise<{ success: boolean; error?: string }> {
    const storageMode = config.storageMode || 'none';

    if (storageMode === 'none') {
      return { success: false, error: 'Storage mode is set to none' };
    }

    if (storageMode === 'local-with-sync' && !config.tursoUrl) {
      return { success: false, error: 'Turso Database URL is required for local-with-sync mode' };
    }

    try {
      // @ts-ignore - Type definitions not available yet
      const { TursoObservabilitySDK } = await import('@a24z/observability-sdk');

      // Resolve the database path to an absolute path in userData directory
      const resolvedDbPath = this.resolveDbPath(config.localDbPath);

      let testSdk;

      switch (storageMode) {
        case 'local':
          testSdk = TursoObservabilitySDK.createLocal(resolvedDbPath);
          break;

        case 'local-with-sync':
          testSdk = TursoObservabilitySDK.createEmbeddedReplica(
            resolvedDbPath,
            config.tursoUrl!,
            config.tursoAuthToken || '',
            config.syncInterval || 5000
          );
          break;

        default:
          return { success: false, error: `Unknown storage mode: ${storageMode}` };
      }

      // Initialize the schema (creates tables if they don't exist)
      await testSdk.initializeSchema();

      // Try to perform a simple operation to verify connectivity
      // The SDK will throw an error if it can't connect
      await testSdk.getRecentSessions(1);

      // Clean up the test SDK
      await testSdk.close();

      return { success: true };
    } catch (error) {
      console.error(
        '[ObservabilityIntegration] Connection test failed:',
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get current configuration
   */
  async getConfiguration(): Promise<ObservabilityConfig> {
    const stored = await this.loadConfiguration();
    return stored || this.config;
  }

  /**
   * Update configuration and restart if needed
   */
  async updateConfiguration(config: ObservabilityConfig): Promise<void> {
    await this.saveConfiguration(config);

    // If already initialized, restart with new config
    if (this.isInitialized) {
      await this.shutdown();
      await this.initialize();
    } else if (config.enabled && config.storageMode !== 'none') {
      // If not initialized but config enables observability, initialize now
      await this.initialize();
    }
  }
}

// Singleton instance
let observabilityIntegration: ObservabilityIntegration | null = null;

/**
 * Get or create the singleton observability integration
 */
export function getObservabilityIntegration(
  config?: ObservabilityConfig,
): ObservabilityIntegration {
  if (!observabilityIntegration) {
    observabilityIntegration = new ObservabilityIntegration(config);
  }
  return observabilityIntegration;
}
