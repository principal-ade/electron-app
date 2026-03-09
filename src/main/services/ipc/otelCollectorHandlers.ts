/**
 * IPC Handlers for OTEL Collector Service
 */

import { ipcMain, MessageChannelMain } from 'electron';
import { OtelCollectorService } from '../OtelCollectorService';
import { getTracer } from '../../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

const HANDLERS = {
  START_OTEL_COLLECTOR: 'otel-collector:start',
  STOP_OTEL_COLLECTOR: 'otel-collector:stop',
  GET_OTEL_COLLECTOR_STATUS: 'otel-collector:getStatus',
  REGISTER_TRACE_PORT: 'otel-collector:registerPort',
  REGISTER_TRACE_PORT_FOR_SERVICES: 'otel-collector:registerPortForServices',
  UNREGISTER_TRACE_PORT: 'otel-collector:unregisterPort',
  UNREGISTER_TRACE_WINDOW: 'otel-collector:unregisterWindow',
  SEND_TEST_TRACE: 'otel-collector:sendTestTrace',
  GET_TRACES: 'otel-collector:getTraces',
  CLEAR_TRACES: 'otel-collector:clearTraces',
} as const;

export function registerOtelCollectorHandlers(): void {
  const service = OtelCollectorService.getInstance();

  // Start collector
  ipcMain.handle(HANDLERS.START_OTEL_COLLECTOR, async () => {
    try {
      await service.start();
      return { success: true };
    } catch (err) {
      console.error('[IPC] Failed to start OTEL collector:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Stop collector
  ipcMain.handle(HANDLERS.STOP_OTEL_COLLECTOR, async () => {
    try {
      await service.stop();
      return { success: true };
    } catch (err) {
      console.error('[IPC] Failed to stop OTEL collector:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Get status
  ipcMain.handle(HANDLERS.GET_OTEL_COLLECTOR_STATUS, () => {
    try {
      const isRunning = service.getIsRunning();
      const stats = service.getStats();

      return {
        isRunning,
        stats: stats || null,
      };
    } catch (err) {
      console.error('[IPC] Failed to get OTEL collector status:', err);
      return {
        isRunning: false,
        stats: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Register port for trace delivery
  // NOTE: Uses postMessage pattern (like terminal) because MessagePorts can't be returned via invoke
  ipcMain.handle(
    HANDLERS.REGISTER_TRACE_PORT,
    (event, windowId: string, serviceIdentifier: string): { success: boolean; error?: string } => {
      const tracer = getTracer('otel-collector-ipc');
      const span = tracer.startSpan('otel.port.registration');

      try {
        // Event: IPC handler invoked
        span.addEvent('otel.ipc.handler_invoked', {
          'handler.name': 'otel-collector:registerPort',
          'window.id': windowId,
          'source.url': serviceIdentifier,
        });

        console.log(`[IPC] Registering trace port for window: ${windowId}, service: ${serviceIdentifier}`);

        // Create a MessageChannel
        const { port1, port2 } = new MessageChannelMain();

        // Register port1 with the service
        // The server (PortRouter) will send a CONNECTION_CONFIRMED heartbeat after registration
        service.registerPort(windowId, serviceIdentifier, port1);

        // Event: MessagePort registered for trace routing
        span.addEvent('otel.messageport.trace_routed', {
          'window.id': windowId,
          'source.url': serviceIdentifier,
          'message.type': 'REGISTER_PORT',
          'port.registered': true,
        });

        // Send port2 to the renderer via postMessage (same pattern as terminal)
        event.sender.postMessage('otel-collector:port', { windowId, serviceIdentifier }, [port2]);

        console.log(`[IPC] ✅ Trace port registered and sent to renderer`);

        span.setStatus({ code: SpanStatusCode.OK });
        return { success: true };
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
        console.error('[IPC] Failed to register trace port:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      } finally {
        span.end();
      }
    }
  );

  // Register port for multiple services (single port receives traces from all listed services)
  ipcMain.handle(
    HANDLERS.REGISTER_TRACE_PORT_FOR_SERVICES,
    (event, windowId: string, serviceIdentifiers: string[]): { success: boolean; error?: string } => {
      const tracer = getTracer('otel-collector-ipc');
      const span = tracer.startSpan('otel.port.registration');

      try {
        // Event: IPC handler invoked
        span.addEvent('otel.ipc.handler_invoked', {
          'handler.name': 'otel-collector:registerPortForServices',
          'window.id': windowId,
          'source.url': serviceIdentifiers.join(','),
          'services.count': serviceIdentifiers.length,
        });

        console.log(`[IPC] Registering trace port for window: ${windowId}, services: [${serviceIdentifiers.join(', ')}]`);

        // Create a MessageChannel
        const { port1, port2 } = new MessageChannelMain();

        // Register port1 with the service for all specified services
        service.registerPortForServices(windowId, serviceIdentifiers, port1);

        // Event: MessagePort registered for trace routing
        span.addEvent('otel.messageport.trace_routed', {
          'window.id': windowId,
          'source.url': serviceIdentifiers.join(','),
          'message.type': 'REGISTER_PORT_FOR_SERVICES',
          'port.registered': true,
          'services.count': serviceIdentifiers.length,
        });

        // Send port2 to the renderer via postMessage
        event.sender.postMessage('otel-collector:port', { windowId, serviceIdentifiers }, [port2]);

        console.log(`[IPC] ✅ Trace port registered for ${serviceIdentifiers.length} services and sent to renderer`);

        span.setStatus({ code: SpanStatusCode.OK });
        return { success: true };
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
        console.error('[IPC] Failed to register trace port for services:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      } finally {
        span.end();
      }
    }
  );

  // Unregister port
  ipcMain.handle(HANDLERS.UNREGISTER_TRACE_PORT, (event, windowId: string, serviceIdentifier: string) => {
    try {
      service.unregisterPort(windowId, serviceIdentifier);
      return { success: true };
    } catch (err) {
      console.error('[IPC] Failed to unregister trace port:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Unregister window
  ipcMain.handle(HANDLERS.UNREGISTER_TRACE_WINDOW, (event, windowId: string) => {
    try {
      service.unregisterWindow(windowId);
      return { success: true };
    } catch (err) {
      console.error('[IPC] Failed to unregister trace window:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Send test trace (for testing)
  ipcMain.handle(HANDLERS.SEND_TEST_TRACE, async (event, serviceIdentifier: string) => {
    try {
      // Generate valid OTLP trace and span IDs
      // traceId: 32 hex characters (16 bytes)
      // spanId: 16 hex characters (8 bytes)
      const generateHexId = (bytes: number): string => {
        const hex = [];
        for (let i = 0; i < bytes; i++) {
          hex.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
        }
        return hex.join('');
      };

      const traceId = generateHexId(16); // 32 hex chars
      const spanId = generateHexId(8);   // 16 hex chars
      const now = Date.now();

      // Send a test trace to the collector endpoint
      const testTrace = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: serviceIdentifier } },
                { key: 'dev.server.url', value: { stringValue: `http://localhost:3000` } },
              ],
              droppedAttributesCount: 0,
            },
            scopeSpans: [
              {
                scope: { name: 'test-tracer' },
                spans: [
                  {
                    traceId,
                    spanId,
                    name: 'Test trace from SystemMonitor',
                    kind: 1, // INTERNAL
                    startTimeUnixNano: String(now * 1000000),
                    endTimeUnixNano: String((now + 100) * 1000000),
                    attributes: [
                      { key: 'test', value: { boolValue: true } },
                    ],
                    droppedAttributesCount: 0,
                    events: [],
                    droppedEventsCount: 0,
                    links: [],
                    droppedLinksCount: 0,
                    status: { code: 1 }, // OK
                  },
                ],
              },
            ],
          },
        ],
      };

      // Store the trace before sending
      service.storeTrace(testTrace);

      // Send to collector endpoint
      const response = await fetch('http://localhost:4318/v1/traces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testTrace),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true };
    } catch (err) {
      console.error('[IPC] Failed to send test trace:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Get stored traces
  ipcMain.handle(HANDLERS.GET_TRACES, (event, limit?: number) => {
    const tracer = getTracer('otel-collector-ipc');
    const span = tracer.startSpan('otel.trace.visualization');

    try {
      const traces = service.getTraces(limit);

      // Event: IPC handler invoked for getting traces
      span.addEvent('otel.ipc.handler_invoked', {
        'handler.name': 'otel-collector:getTraces',
        'traces.limit': limit || 50,
        'traces.fetched': traces.length,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return { success: true, traces };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
      console.error('[IPC] Failed to get traces:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err), traces: [] };
    } finally {
      span.end();
    }
  });

  // Clear stored traces
  ipcMain.handle(HANDLERS.CLEAR_TRACES, () => {
    try {
      service.clearTraces();
      return { success: true };
    } catch (err) {
      console.error('[IPC] Failed to clear traces:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  console.log('[IPC] OTEL Collector handlers registered');
}

export { HANDLERS as OTEL_COLLECTOR_HANDLERS };
