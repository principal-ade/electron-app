/**
 * Renderer Process OpenTelemetry Provider
 *
 * Initializes OpenTelemetry SDK for the Electron renderer process with:
 * - Trace exporting to OTLP HTTP endpoint
 * - Auto-instrumentation for browser (fetch, XHR, document load, user interaction)
 */

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations, Instrumentation } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { defaultTelemetryConfig } from '../../telemetry/config';

// Extend Window interface for app version
declare global {
  interface Window {
    appVersion?: string;
  }
}

class WebTelemetryProvider {
  private provider: WebTracerProvider | null = null;
  private isInitialized = false;

  /**
   * Initialize OpenTelemetry SDK for the renderer process
   */
  initialize(windowType: string): void {
    if (this.isInitialized) {
      console.info('[Telemetry] Renderer telemetry already initialized');
      return;
    }

    // Check if telemetry is disabled via localStorage or environment
    if (!this.isTelemetryEnabled()) {
      console.info('[Telemetry] Renderer telemetry disabled');
      return;
    }

    const config = defaultTelemetryConfig;
    const endpoint = config.collectorEndpoint;

    try {
      console.info(`[Telemetry] Initializing renderer telemetry for ${windowType}...`);

      // Get app version from window.mainProcess if available
      const appVersion = this.getAppVersion();

      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName,
        [ATTR_SERVICE_VERSION]: appVersion,
        'process.type': 'renderer',
        'window.type': windowType,
      });

      const exporter = new OTLPTraceExporter({
        url: `${endpoint}/v1/traces`,
      });

      // Create provider with resource and span processors
      this.provider = new WebTracerProvider({
        resource,
        spanProcessors: [
          new BatchSpanProcessor(exporter, {
            maxQueueSize: 100,
            maxExportBatchSize: 50,
            scheduledDelayMillis: 5000,
            exportTimeoutMillis: 30000,
          }),
        ],
      });

      // Register the provider with Zone context manager for async context propagation
      this.provider.register({
        contextManager: new ZoneContextManager(),
      });

      // Register instrumentations
      const instrumentations: Instrumentation[] = [];

      if (config.renderer.instrumentations.fetch) {
        instrumentations.push(
          new FetchInstrumentation({
            propagateTraceHeaderCorsUrls: [/localhost/], // Only propagate to localhost
            clearTimingResources: true,
          })
        );
      }

      if (config.renderer.instrumentations.xhr) {
        instrumentations.push(new XMLHttpRequestInstrumentation());
      }

      if (config.renderer.instrumentations.documentLoad) {
        instrumentations.push(new DocumentLoadInstrumentation());
      }

      if (config.renderer.instrumentations.userInteraction) {
        // Track recent events to prevent duplicates from event bubbling
        const recentEvents = new Map<string, number>();
        const DEDUPE_WINDOW_MS = 100;

        instrumentations.push(
          new UserInteractionInstrumentation({
            eventNames: ['click', 'submit'],
            shouldPreventSpanCreation: (eventType, element, _span) => {
              const now = Date.now();

              // Clean up old entries
              for (const [key, timestamp] of recentEvents.entries()) {
                if (now - timestamp > DEDUPE_WINDOW_MS) {
                  recentEvents.delete(key);
                }
              }

              // Check if we've seen this event recently
              const recentKey = `${eventType}:${element.tagName}`;
              const lastSeen = recentEvents.get(recentKey);

              if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
                // Duplicate event - prevent span creation
                return true;
              }

              // New event - record it and allow span creation
              recentEvents.set(recentKey, now);
              return false;
            },
          })
        );
      }

      registerInstrumentations({
        instrumentations,
        tracerProvider: this.provider,
      });

      this.isInitialized = true;

      console.info('[Telemetry] Renderer telemetry initialized successfully');
      console.info(`[Telemetry] Window type: ${windowType}`);
      console.info(`[Telemetry] Sending to: ${endpoint}`);
    } catch (error) {
      console.error('[Telemetry] Failed to initialize renderer telemetry:', error);
      this.provider = null;
      // Don't throw - allow app to continue without telemetry
    }
  }

  /**
   * Shutdown telemetry and flush pending spans
   */
  async shutdown(): Promise<void> {
    if (!this.provider) {
      return;
    }

    try {
      console.info('[Telemetry] Shutting down renderer telemetry...');
      await this.provider.shutdown();
      this.provider = null;
      this.isInitialized = false;
      console.info('[Telemetry] Renderer telemetry shutdown complete');
    } catch (error) {
      console.error('[Telemetry] Error during renderer shutdown:', error);
    }
  }

  /**
   * Check if telemetry is enabled
   */
  private isTelemetryEnabled(): boolean {
    // Check localStorage for user preference
    try {
      const stored = localStorage.getItem('telemetry-enabled');
      if (stored === 'false') {
        return false;
      }
    } catch {
      // localStorage not available
    }

    return defaultTelemetryConfig.renderer.enabled;
  }

  /**
   * Get app version from preload-exposed window.appVersion
   */
  private getAppVersion(): string {
    try {
      // This is synchronously exposed by the preload script
      if (typeof window !== 'undefined' && window.appVersion) {
        return window.appVersion;
      }
    } catch {
      // Ignore
    }
    return 'unknown';
  }

  /**
   * Get the tracer provider for custom instrumentation
   */
  getProvider(): WebTracerProvider | null {
    return this.provider;
  }

  /**
   * Check if telemetry is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
const webTelemetry = new WebTelemetryProvider();

/**
 * Initialize telemetry for a renderer window
 * Call this at the top of each renderer entry point before React renders
 */
export function initializeTelemetry(windowType: string): void {
  webTelemetry.initialize(windowType);
}

/**
 * Shutdown telemetry - call before window closes
 */
export async function shutdownTelemetry(): Promise<void> {
  await webTelemetry.shutdown();
}

export { webTelemetry };
