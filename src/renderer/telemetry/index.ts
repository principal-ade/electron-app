/**
 * Renderer Process OpenTelemetry Provider
 *
 * Initializes OpenTelemetry SDK for the Electron renderer process with:
 * - Trace exporting to OTLP HTTP endpoint
 * - Auto-instrumentation for browser (fetch, XHR, document load, user interaction)
 *
 * The endpoint and the on/off switch are resolved once, in the main process
 * (saved preference > `OTEL_EXPORTER_OTLP_ENDPOINT` > default), and read over
 * the synchronous `get-otel-endpoint` IPC. A change made in Settings arrives via
 * `UserPreferencesService` and re-initialises this provider in place, so no
 * window reload is needed.
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
import { trace, type Tracer } from '@opentelemetry/api';
import {
  defaultTelemetryConfig,
  RESOLVED_ENABLED_ENV,
  RESOLVED_ENDPOINT_ENV,
  resolveTelemetrySettings,
  type TelemetrySettings,
} from '../../telemetry/config';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

// Extend Window interface for app version
declare global {
  interface Window {
    appVersion?: string;
    /** Snapshot of the OTLP base endpoint main resolved, exposed by preload. */
    otelCollectorEndpoint?: string;
    /** Snapshot ("true"/"false") of whether main resolved telemetry as on. */
    telemetryExportEnabled?: string;
    /** Re-read the live resolved settings from main. Exposed by preload. */
    getTelemetrySettings?: () => {
      endpoint: string;
      enabled: boolean;
    };
  }
}

/**
 * What main resolved, in the shape the shared resolver expects. Main applies the
 * same precedence (preference > env > default), so the renderer does not
 * re-apply the preference itself — doing so would let a stale saved value beat a
 * live change.
 */
function rendererTelemetryEnv(): Record<string, string | undefined> {
  let endpoint = window.otelCollectorEndpoint;
  let enabled = window.telemetryExportEnabled;

  try {
    // Prefer a fresh read: the preload snapshot is taken once, when the window
    // is created, and would otherwise pin the endpoint for the window's life.
    const fresh = window.getTelemetrySettings?.();
    if (fresh) {
      endpoint = fresh.endpoint;
      enabled = String(fresh.enabled);
    }
  } catch (error) {
    console.warn(
      '[Telemetry] Could not read resolved telemetry settings, using the preload snapshot:',
      error,
    );
  }

  return {
    [RESOLVED_ENDPOINT_ENV]: endpoint,
    [RESOLVED_ENABLED_ENV]: enabled,
  };
}

class WebTelemetryProvider {
  private provider: WebTracerProvider | null = null;
  private isInitialized = false;
  private unregisterInstrumentations: (() => void) | null = null;
  private windowType: string | null = null;
  private settings: TelemetrySettings | null = null;

  /**
   * Initialize OpenTelemetry SDK for the renderer process
   */
  initialize(windowType: string): void {
    this.windowType = windowType;

    if (this.isInitialized) {
      console.info('[Telemetry] Renderer telemetry already initialized');
      return;
    }

    const settings = resolveTelemetrySettings({ env: rendererTelemetryEnv() });
    this.settings = settings;

    if (!settings.enabled) {
      console.info('[Telemetry] Renderer telemetry disabled via settings');
      return;
    }

    const config = defaultTelemetryConfig;
    const endpoint = settings.endpoint;

    try {
      console.info(`[Telemetry] Initializing renderer telemetry for ${windowType}...`);

      // Get app version from window.mainProcess if available
      const appVersion = this.getAppVersion();

      // Use window-type-specific service name for proper scope separation
      const serviceName = `principal-ade-${windowType}`;

      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
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
            ignoreUrls: [/\/v1\/traces$/, /\/v1\/metrics$/, /\/v1\/logs$/], // Don't instrument OTLP exports
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

      // Keep the cleanup function: re-initialising after a settings change has to
      // unregister first, or each browser global is patched again and every span
      // is reported once per change.
      this.unregisterInstrumentations = registerInstrumentations({
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
   * Re-read the resolved settings and restart the provider if they changed.
   * Triggered by a preference update, in this window or another one.
   */
  applySettingsChange(): void {
    const next = resolveTelemetrySettings({ env: rendererTelemetryEnv() });

    if (
      this.settings &&
      this.settings.enabled === next.enabled &&
      this.settings.endpoint === next.endpoint
    ) {
      return;
    }

    void this.reinitialize(next);
  }

  private async reinitialize(next: TelemetrySettings): Promise<void> {
    await this.shutdown();

    if (!next.enabled || !this.windowType) {
      return;
    }

    console.info('[Telemetry] Renderer telemetry settings changed, re-initializing');
    this.initialize(this.windowType);
  }

  /**
   * Shutdown telemetry and flush pending spans
   */
  async shutdown(): Promise<void> {
    if (this.unregisterInstrumentations) {
      try {
        this.unregisterInstrumentations();
      } catch (error) {
        console.error('[Telemetry] Error unregistering instrumentations:', error);
      }
      this.unregisterInstrumentations = null;
    }

    if (!this.provider) {
      this.isInitialized = false;
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

// One subscription per renderer bundle, however many windows share it.
let subscribedToPreferences = false;

/**
 * Initialize telemetry for a renderer window
 * Call this at the top of each renderer entry point before React renders
 */
export function initializeTelemetry(windowType: string): void {
  webTelemetry.initialize(windowType);

  if (subscribedToPreferences) {
    return;
  }

  subscribedToPreferences = true;
  UserPreferencesService.onPreferencesUpdated(() => {
    webTelemetry.applySettingsChange();
  });
}

/**
 * Shutdown telemetry - call before window closes
 */
export async function shutdownTelemetry(): Promise<void> {
  await webTelemetry.shutdown();
}

/**
 * Get a tracer for manual instrumentation in the renderer process
 * Use this to create custom spans for tracking operations
 *
 * @example
 * const tracer = getTracer('quality-panel');
 * const span = tracer.startSpan('quality.artifact.fetching');
 * try {
 *   // do work
 *   span.setStatus({ code: SpanStatusCode.OK });
 * } catch (error) {
 *   span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
 *   throw error;
 * } finally {
 *   span.end();
 * }
 */
export function getTracer(name: string = 'principal-ade-renderer'): Tracer {
  return trace.getTracer(name);
}

export { webTelemetry };
