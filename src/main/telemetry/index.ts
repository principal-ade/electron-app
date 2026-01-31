/**
 * Main Process OpenTelemetry Provider
 *
 * Lightweight telemetry setup for the Electron main process.
 * Provides trace exporting to OTLP HTTP endpoint.
 * Manual instrumentation - call tracer.startSpan() where needed.
 */

import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';
import { app } from 'electron';
import { defaultTelemetryConfig, isTelemetryEnabled } from '../../telemetry/config';

class NodeTelemetryProvider {
  private provider: BasicTracerProvider | null = null;
  private isInitialized = false;

  /**
   * Initialize OpenTelemetry for the main process
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Telemetry] Main process telemetry already initialized');
      return;
    }

    if (!isTelemetryEnabled()) {
      console.log('[Telemetry] Main process telemetry disabled via config');
      return;
    }

    const config = defaultTelemetryConfig;
    const endpoint = config.collectorEndpoint;

    // Check if collector is available
    const collectorAvailable = await this.checkCollectorHealth(endpoint);
    if (!collectorAvailable) {
      console.warn('[Telemetry] Collector not available at', endpoint, '- telemetry disabled');
      return;
    }

    try {
      console.log('[Telemetry] Initializing main process telemetry...');

      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName,
        [ATTR_SERVICE_VERSION]: app.getVersion(),
        'process.type': 'main',
        'electron.packaged': String(app.isPackaged),
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
      console.log('[Telemetry] Main process telemetry initialized');
      console.log(`[Telemetry] Sending traces to: ${endpoint}/v1/traces`);
    } catch (error) {
      console.error('[Telemetry] Failed to initialize:', error);
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
      console.log('[Telemetry] Shutting down main process telemetry...');
      await this.provider.shutdown();
      this.provider = null;
      this.isInitialized = false;
      console.log('[Telemetry] Main process telemetry shutdown complete');
    } catch (error) {
      console.error('[Telemetry] Error during shutdown:', error);
    }
  }

  /**
   * Get a tracer for creating spans
   */
  getTracer(name: string = 'principal-ade-main') {
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

export const nodeTelemetry = new NodeTelemetryProvider();

/**
 * Convenience function to get a tracer for manual instrumentation
 *
 * Usage:
 *   const span = getTracer().startSpan('my-operation');
 *   try {
 *     // do work
 *   } finally {
 *     span.end();
 *   }
 */
export function getTracer(name: string = 'principal-ade-main') {
  return trace.getTracer(name);
}
