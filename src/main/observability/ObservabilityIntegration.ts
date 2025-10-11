/**
 * ObservabilityIntegration - Connects RepoEvents from the event pipeline to the @a24z/observability-sdk
 *
 * This module integrates the agent monitoring pipeline with the observability SDK,
 * forwarding RepoNormalized events for centralized monitoring and analytics.
 */

import { EventEmitter } from 'events';
// @ts-ignore - Type definitions not available yet
import { TursoObservabilitySDK } from '@a24z/observability-sdk';

interface TursoConfig {
  url: string;
  authToken?: string;
}
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { UnifiedSecureStorage } from '../services/UnifiedSecureStorage';

export interface ObservabilityConfig {
  tursoUrl?: string;
  tursoAuthToken?: string;
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
          tursoUrl: stored.tursoUrl,
          tursoAuthToken: stored.tursoAuthToken,
          environment: (stored.environment as any) || 'development',
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
    if (config.tursoUrl) secrets.tursoUrl = config.tursoUrl;
    if (config.tursoAuthToken) secrets.tursoAuthToken = config.tursoAuthToken;
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
   * Initialize SDK with Turso configuration
   */
  private async initializeSDK(config: TursoConfig): Promise<void> {
    // Initialize the Turso SDK
    this.sdk = new TursoObservabilitySDK(config);

    // Initialize the database schema (creates tables if they don't exist)
    await this.sdk.initializeSchema();

    console.log('[ObservabilityIntegration] Turso SDK initialized with schema');
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

      // Check if we have Turso configuration
      const tursoUrl = this.config.tursoUrl || process.env.TURSO_DATABASE_URL;
      const tursoAuthToken =
        this.config.tursoAuthToken || process.env.TURSO_AUTH_TOKEN;

      if (!tursoUrl || this.config.enabled === false) {
        console.log(
          '[ObservabilityIntegration] Observability disabled or no Turso URL configured',
        );
        return;
      }

      // Initialize the SDK with Turso configuration
      await this.initializeSDK({
        url: tursoUrl,
        authToken: tursoAuthToken,
      });

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
    if (!config.tursoUrl) {
      return { success: false, error: 'Turso Database URL is required' };
    }

    try {
      // Create a temporary SDK instance to test the connection
      const testSdk = new TursoObservabilitySDK({
        url: config.tursoUrl,
        authToken: config.tursoAuthToken,
      });

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

    // If already initialized and config changed, restart
    if (this.isInitialized) {
      await this.shutdown();
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
