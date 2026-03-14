/**
 * PTY Daemon OpenTelemetry Provider
 *
 * Lightweight telemetry setup for the standalone PTY daemon process.
 * Sends traces to the local OTLP collector for workflow visualization.
 *
 * Model:
 * - Each workflow is a SPAN (e.g., terminal.daemon.startup)
 * - Each node/step is an EVENT attached to that span via span.addEvent()
 */

import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, Tracer, SpanStatusCode, Span, context, Context } from '@opentelemetry/api';

class DaemonTelemetryProvider {
  private provider: BasicTracerProvider | null = null;
  private isInitialized = false;
  private startupTime = Date.now();

  // Active workflow spans
  private activeStartupSpan: Span | null = null;
  private activeStartupContext: Context | null = null;

  /**
   * Initialize OpenTelemetry for the daemon process
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Use port 4318 for HTTP OTLP (standard port)
    const otlpPort = parseInt(process.env.OTEL_OTLP_PORT || '4318', 10);
    const endpoint = `http://localhost:${otlpPort}`;

    // Check if collector is available
    const collectorAvailable = await this.checkCollectorHealth(endpoint);
    if (!collectorAvailable) {
      console.warn('[DaemonTelemetry] Collector not available at', endpoint, '- telemetry disabled');
      return;
    }

    try {
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'principal-ade-daemon',
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        'process.type': 'pty-daemon',
        'process.pid': process.pid,
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
      console.info('[DaemonTelemetry] Daemon telemetry initialized, endpoint:', endpoint);
    } catch (error) {
      console.error('[DaemonTelemetry] Failed to initialize:', error);
      this.provider = null;
    }
  }

  /**
   * Shutdown and flush pending spans
   */
  async shutdown(): Promise<void> {
    // End any active spans
    if (this.activeStartupSpan) {
      this.activeStartupSpan.end();
      this.activeStartupSpan = null;
      this.activeStartupContext = null;
    }

    if (!this.provider) {
      return;
    }

    try {
      await this.provider.shutdown();
      this.provider = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('[DaemonTelemetry] Error during shutdown:', error);
    }
  }

  /**
   * Get a tracer for creating spans
   */
  getTracer(name: string = 'terminal.daemon'): Tracer {
    return trace.getTracer(name);
  }

  /**
   * Get uptime in milliseconds
   */
  getUptimeMs(): number {
    return Date.now() - this.startupTime;
  }

  /**
   * Start the daemon startup workflow span
   */
  startStartupWorkflow(): void {
    if (this.activeStartupSpan) {
      return; // Already started
    }

    const tracer = this.getTracer();
    this.activeStartupSpan = tracer.startSpan('terminal.daemon.startup', {
      attributes: {
        'process.pid': process.pid,
      },
    });
    this.activeStartupContext = trace.setSpan(context.active(), this.activeStartupSpan);
  }

  /**
   * Add an event to the active startup workflow span
   */
  addStartupEvent(name: string, attributes: Record<string, string | number | boolean>): void {
    if (!this.activeStartupSpan) {
      return;
    }
    this.activeStartupSpan.addEvent(name, attributes);
  }

  /**
   * End the daemon startup workflow span
   */
  endStartupWorkflow(): void {
    if (this.activeStartupSpan) {
      this.activeStartupSpan.end();
      this.activeStartupSpan = null;
      this.activeStartupContext = null;
    }
  }

  /**
   * Get the active startup span (for adding events from other modules)
   */
  getActiveStartupSpan(): Span | null {
    return this.activeStartupSpan;
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

export const daemonTelemetry = new DaemonTelemetryProvider();

/**
 * Convenience function to get a tracer
 */
export function getTracer(name: string = 'terminal.daemon'): Tracer {
  return trace.getTracer(name);
}

// =============================================================================
// Event helpers - these add events to the active workflow span
// =============================================================================

/**
 * Add a terminal.daemon.phase event (lifecycle phase change)
 */
export function addPhaseEvent(
  phase: 'starting' | 'ready' | 'shutdown',
  reason?: string,
): void {
  daemonTelemetry.addStartupEvent('terminal.daemon.phase', {
    'phase': phase,
    'reason': reason || '',
    'uptime.ms': daemonTelemetry.getUptimeMs(),
  });
}

/**
 * Add a terminal.daemon.server_event
 */
export function addServerEvent(
  event: 'listening' | 'stopped' | 'error',
  clientsCount: number,
): void {
  daemonTelemetry.addStartupEvent('terminal.daemon.server_event', {
    'event': event,
    'clients.count': clientsCount,
  });
}

/**
 * Add a terminal.daemon.session_action event
 */
export function addSessionActionEvent(
  action: 'created' | 'destroyed' | 'attached',
  sessionId: string,
  sessionsCount: number,
): void {
  daemonTelemetry.addStartupEvent('terminal.daemon.session_action', {
    'action': action,
    'session.id': sessionId,
    'sessions.count': sessionsCount,
  });
}

/**
 * Add a terminal.socket.connection event
 */
export function addSocketConnectionEvent(
  state: 'connected' | 'disconnected' | 'error',
  clientId: number,
  error?: string,
): void {
  daemonTelemetry.addStartupEvent('terminal.socket.connection', {
    'state': state,
    'client.id': clientId,
    'attempt': 1,
    'error': error || '',
  });
}

/**
 * Add a terminal.daemon.idle event
 */
export function addIdleEvent(
  idleDurationMs: number,
  sessionsCount: number,
  clientsCount: number,
  action: 'checking' | 'timeout' | 'cancelled',
): void {
  daemonTelemetry.addStartupEvent('terminal.daemon.idle', {
    'idle.duration.ms': idleDurationMs,
    'sessions.count': sessionsCount,
    'clients.count': clientsCount,
    'action': action,
  });
}

/**
 * Add a terminal.health.check event
 */
export function addHealthCheckEvent(
  direction: 'ping' | 'pong',
  latencyMs: number,
  missedCount: number,
): void {
  daemonTelemetry.addStartupEvent('terminal.health.check', {
    'direction': direction,
    'latency.ms': latencyMs,
    'missed.count': missedCount,
  });
}

/**
 * Add a terminal.error event
 */
export function addErrorEvent(
  source: string,
  errorMessage: string,
  errorCode?: string,
  sessionId?: string,
  recoverable?: boolean,
): void {
  const span = daemonTelemetry.getActiveStartupSpan();
  if (span) {
    span.addEvent('terminal.error', {
      'source': source,
      'error.message': errorMessage,
      'error.code': errorCode || '',
      'session.id': sessionId || '',
      'recoverable': recoverable ?? false,
    });
    span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
  }
}
