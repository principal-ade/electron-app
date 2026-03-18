/**
 * Utility Process OpenTelemetry Provider
 *
 * Lightweight telemetry setup for the Electron utility process.
 * Provides trace exporting to OTLP HTTP endpoint.
 */

import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, Tracer } from '@opentelemetry/api';

class UtilityProcessTelemetryProvider {
  private provider: BasicTracerProvider | null = null;
  private isInitialized = false;

  /**
   * Initialize OpenTelemetry for the utility process
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Use dev ports by default since utility process runs in dev mode
    const isDev = process.env.NODE_ENV !== 'production';
    const otlpPort = parseInt(process.env.OTEL_OTLP_PORT || (isDev ? '14318' : '4318'), 10);
    const endpoint = `http://localhost:${otlpPort}`;

    // Check if collector is available
    const collectorAvailable = await this.checkCollectorHealth(endpoint);
    if (!collectorAvailable) {
      console.warn('[UtilityTelemetry] Collector not available at', endpoint, '- telemetry disabled');
      return;
    }

    try {
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'principal-ade-event-processor',
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        'process.type': 'utility',
      });

      const exporter = new OTLPTraceExporter({
        url: `${endpoint}/v1/traces`,
      });

      this.provider = new BasicTracerProvider({
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

      // Register as the global tracer provider
      trace.setGlobalTracerProvider(this.provider);

      this.isInitialized = true;
      console.info('[UtilityTelemetry] Utility process telemetry initialized');
    } catch (error) {
      console.error('[UtilityTelemetry] Failed to initialize:', error);
      this.provider = null;
    }
  }

  /**
   * Shutdown and flush pending spans
   */
  async shutdown(): Promise<void> {
    if (!this.provider) {
      return;
    }

    try {
      await this.provider.shutdown();
      this.provider = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('[UtilityTelemetry] Error during shutdown:', error);
    }
  }

  /**
   * Get a tracer for creating spans
   */
  getTracer(name: string = 'principal-ade-utility'): Tracer {
    return trace.getTracer(name);
  }

  private async checkCollectorHealth(endpoint: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${endpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceSpans: [] }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.status < 500;
    } catch {
      return false;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const utilityTelemetry = new UtilityProcessTelemetryProvider();

/**
 * Convenience function to get a tracer for manual instrumentation
 */
export function getTracer(name: string = 'principal-ade-utility'): Tracer {
  return trace.getTracer(name);
}
