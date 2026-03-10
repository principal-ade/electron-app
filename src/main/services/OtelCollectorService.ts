/**
 * OTEL Collector Service - Manages OpenTelemetry collector for trace collection
 */

import { OTELCollectorServer, ServerStats, WILDCARD_SOURCE, OTLPTraceRequest } from '@principal-ai/otel-collector-server';
import { app, MessageChannelMain, MessagePortMain } from 'electron';
import path from 'path';
import os from 'os';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

/** OTLP (OpenTelemetry Protocol) trace data payload */
type OTLPTraceData = OTLPTraceRequest;

interface StoredTrace {
  traceId: string;
  data: OTLPTraceData;
}

export class OtelCollectorService {
  private static instance: OtelCollectorService | null = null;
  private server: OTELCollectorServer | null = null;
  private isRunning: boolean = false;
  private traces: StoredTrace[] = [];
  private readonly MAX_TRACES = 50; // Store last 50 traces
  private monitorPort: MessagePortMain | null = null; // Catch-all port for trace monitoring

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OtelCollectorService {
    if (!OtelCollectorService.instance) {
      OtelCollectorService.instance = new OtelCollectorService();
    }
    return OtelCollectorService.instance;
  }

  /**
   * Initialize and start the OTEL collector
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[OtelCollectorService] Already running');
      return;
    }

    console.log('[OtelCollectorService] Starting OTEL Collector...');

    const tracer = getTracer('otel-collector-service');
    const span = tracer.startSpan('otel.collector.startup');

    try {
      // Determine binary path
      const binaryPath = this.getBinaryPath();

      // Determine ports based on environment
      // Dev instances use higher ports to avoid conflicts with production
      const isDev = !app.isPackaged;
      const otlpPort = parseInt(process.env.OTEL_OTLP_PORT || (isDev ? '14318' : '4318'), 10);
      const wrapperPort = parseInt(process.env.OTEL_WRAPPER_PORT || (isDev ? '14319' : '4319'), 10);
      const collectorPort = parseInt(process.env.OTEL_COLLECTOR_PORT || (isDev ? '14320' : '4320'), 10);

      // Create server instance
      this.server = new OTELCollectorServer({
        mode: 'electron',
        otlpPort,
        wrapperPort,
        collectorPort,
        binaryPath,
        logLevel: 'info',
        restartOnCrash: true,
      });

      // Start the server
      await this.server.start();
      this.isRunning = true;

      // Register a catch-all port to receive and store all traces
      this.registerMonitorPort();

      // Event: OTEL Collector Service started successfully
      span.addEvent('otel.collector.service_started', {
        'collector.mode': 'electron',
        'otlp.port': otlpPort,
        'wrapper.port': wrapperPort,
        'collector.port': collectorPort,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      console.log('[OtelCollectorService] OTEL Collector started successfully');
      console.log(`  - OTLP Endpoint: http://localhost:${otlpPort}`);
      console.log(`  - Wrapper Endpoint: http://localhost:${wrapperPort}`);
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
      console.error('[OtelCollectorService] Failed to start:', err);
      this.isRunning = false;
      throw err;
    } finally {
      span.end();
    }
  }

  /**
   * Register a catch-all MessagePort to receive and store all traces
   */
  private registerMonitorPort(): void {
    if (!this.server) {
      return;
    }

    try {
      // Create a MessageChannel - port1 goes to server, port2 stays with us
      const { port1, port2 } = new MessageChannelMain();

      // Listen for trace messages on port2
      port2.on('message', (event) => {
        try {
          const message = event.data;
          if (message?.type === 'RAW_OTLP_TRACE' && message.payload) {
            this.storeTrace(message.payload);
          }
        } catch (err) {
          console.error('[OtelCollectorService] Failed to process trace message:', err);
        }
      });

      // Start the port to receive messages
      port2.start();

      // Register port1 with the server using wildcard to receive ALL traces
      this.server.registerPort('__monitor__', WILDCARD_SOURCE, port1);
      this.monitorPort = port2;

      console.log('[OtelCollectorService] Registered catch-all monitor port for trace storage');
    } catch (err) {
      console.error('[OtelCollectorService] Failed to register monitor port:', err);
    }
  }

  /**
   * Stop the OTEL collector
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      console.log('[OtelCollectorService] Not running');
      return;
    }

    console.log('[OtelCollectorService] Stopping OTEL Collector...');

    try {
      // Clean up monitor port
      if (this.monitorPort) {
        this.monitorPort.close();
        this.monitorPort = null;
      }

      await this.server.stop();
      this.server = null;
      this.isRunning = false;
      console.log('[OtelCollectorService] OTEL Collector stopped');
    } catch (err) {
      console.error('[OtelCollectorService] Failed to stop:', err);
      throw err;
    }
  }

  /**
   * Register a MessagePort for a window to receive traces from a specific service
   * @param windowId - Unique window identifier
   * @param serviceIdentifier - Service identifier (e.g., "web-ade", repository path, or "*" for all)
   * @param port - MessagePort for trace delivery
   */
  registerPort(windowId: string, serviceIdentifier: string, port: MessagePortMain): void {
    if (!this.server) {
      throw new Error('OTEL Collector not started');
    }

    this.server.registerPort(windowId, serviceIdentifier, port);
    console.log(`[OtelCollectorService] Registered port for window ${windowId}, service: ${serviceIdentifier}`);
  }

  /**
   * Register a MessagePort for a window to receive traces from multiple services
   * @param windowId - Unique window identifier
   * @param serviceIdentifiers - Array of service identifiers
   * @param port - MessagePort for trace delivery
   */
  registerPortForServices(windowId: string, serviceIdentifiers: string[], port: MessagePortMain): void {
    if (!this.server) {
      throw new Error('OTEL Collector not started');
    }

    this.server.registerPortForServices(windowId, serviceIdentifiers, port);
    console.log(`[OtelCollectorService] Registered port for window ${windowId}, services: [${serviceIdentifiers.join(', ')}]`);
  }

  /**
   * Unregister a MessagePort for a window and service
   * @param windowId - Unique window identifier
   * @param serviceIdentifier - Service identifier to unregister
   */
  unregisterPort(windowId: string, serviceIdentifier: string): void {
    if (!this.server) {
      return;
    }

    this.server.unregisterPort(windowId, serviceIdentifier);
    console.log(`[OtelCollectorService] Unregistered port for window ${windowId}, service: ${serviceIdentifier}`);
  }

  /**
   * Unregister all ports for a window
   */
  unregisterWindow(windowId: string): void {
    if (!this.server) {
      return;
    }

    this.server.unregisterWindow(windowId);
    console.log(`[OtelCollectorService] Unregistered all ports for window ${windowId}`);
  }

  /**
   * Get server statistics
   */
  getStats(): ServerStats | null {
    if (!this.server) {
      return null;
    }

    return this.server.getStats();
  }

  /**
   * Check if collector is running
   */
  getIsRunning(): boolean {
    return this.isRunning && this.server !== null;
  }

  /**
   * Store a received trace
   */
  storeTrace(traceData: OTLPTraceData): void {
    const tracer = getTracer('otel-collector-service');
    const span = tracer.startSpan('otel.trace.delivery');

    try {
      // Extract trace ID from the data
      const traceId = this.extractTraceId(traceData);

      // Count spans in the trace data
      const resourceSpansCount = traceData.resourceSpans?.length || 0;
      const totalSpansCount = traceData.resourceSpans?.reduce((acc, rs) => {
        return acc + (rs.scopeSpans?.reduce((sacc, ss) => sacc + (ss.spans?.length || 0), 0) || 0);
      }, 0) || 0;

      // Event: Trace received by collector
      span.addEvent('otel.collector.trace_received', {
        'trace.id': traceId,
        'collector.mode': 'electron',
        'resource.spans.count': resourceSpansCount,
        'trace.format': 'otlp-json',
      });

      const trace: StoredTrace = {
        traceId,
        data: traceData,
      };

      this.traces.unshift(trace); // Add to beginning

      // Keep only MAX_TRACES
      if (this.traces.length > this.MAX_TRACES) {
        this.traces = this.traces.slice(0, this.MAX_TRACES);
      }

      // Event: Trace stored in buffer
      span.addEvent('otel.storage.trace_stored', {
        'trace.id': traceId,
        'storage.timestamp': new Date().toISOString(),
        'storage.size': this.traces.length,
        'storage.max_size': this.MAX_TRACES,
        'spans.count': totalSpansCount,
      });

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
      console.error('[OtelCollectorService] Failed to store trace:', err);
    } finally {
      span.end();
    }
  }

  /**
   * Get stored traces
   */
  getTraces(limit?: number): StoredTrace[] {
    const maxLimit = limit && limit > 0 ? Math.min(limit, this.MAX_TRACES) : this.MAX_TRACES;
    return this.traces.slice(0, maxLimit);
  }

  /**
   * Clear stored traces
   */
  clearTraces(): void {
    this.traces = [];
    console.log('[OtelCollectorService] Cleared all traces');
  }

  /**
   * Extract trace ID from OTLP trace data
   */
  private extractTraceId(traceData: OTLPTraceData): string {
    try {
      // OTLP format: resourceSpans[0].scopeSpans[0].spans[0].traceId
      const traceId = traceData.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]?.traceId;
      if (traceId) {
        // Handle both string and Uint8Array formats
        if (typeof traceId === 'string') {
          return traceId;
        } else {
          // Convert Uint8Array to hex string
          return Array.from(traceId)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        }
      }
      return `trace-${Date.now()}`;
    } catch {
      return `trace-${Date.now()}`;
    }
  }

  /**
   * Get the binary path for the current platform
   */
  private getBinaryPath(): string {
    const platform = os.platform();
    const arch = os.arch();

    const binaryMap: Record<string, string> = {
      'darwin-x64': 'otelcol_darwin_amd64',
      'darwin-arm64': 'otelcol_darwin_arm64',
      'linux-x64': 'otelcol_linux_amd64',
      'linux-arm64': 'otelcol_linux_arm64',
      'win32-x64': 'otelcol_windows_amd64.exe',
    };

    const platformKey = `${platform}-${arch}`;
    const binaryName = binaryMap[platformKey];

    if (!binaryName) {
      throw new Error(`Unsupported platform: ${platformKey}`);
    }

    // Check if we're in development or production
    if (app.isPackaged) {
      // Production: binary bundled with app in resources/bin
      return path.join(process.resourcesPath, 'bin', binaryName);
    } else {
      // Development: binary in resources/bin (from project root)
      // Use process.cwd() which is the project root in dev mode
      return path.join(process.cwd(), 'resources', 'bin', binaryName);
    }
  }
}
