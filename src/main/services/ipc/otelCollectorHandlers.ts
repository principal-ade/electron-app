/**
 * IPC Handlers for OTEL Collector Service
 */

import { ipcMain, MessageChannelMain } from 'electron';
import { OtelCollectorService } from '../OtelCollectorService';

const HANDLERS = {
  START_OTEL_COLLECTOR: 'otel-collector:start',
  STOP_OTEL_COLLECTOR: 'otel-collector:stop',
  GET_OTEL_COLLECTOR_STATUS: 'otel-collector:getStatus',
  REGISTER_TRACE_PORT: 'otel-collector:registerPort',
  UNREGISTER_TRACE_PORT: 'otel-collector:unregisterPort',
  UNREGISTER_TRACE_WINDOW: 'otel-collector:unregisterWindow',
  SEND_TEST_TRACE: 'otel-collector:sendTestTrace',
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
  ipcMain.handle(
    HANDLERS.REGISTER_TRACE_PORT,
    (event, windowId: string, sourceUrl: string): { success: boolean; port?: MessagePort; error?: string } => {
      try {
        // Create a MessageChannel
        const { port1, port2 } = new MessageChannelMain();

        // Register port1 with the service (service will send messages through this)
        service.registerPort(windowId, sourceUrl, port1);

        // Return port2 to the renderer (renderer will receive messages through this)
        return { success: true, port: port2 };
      } catch (err) {
        console.error('[IPC] Failed to register trace port:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  // Unregister port
  ipcMain.handle(HANDLERS.UNREGISTER_TRACE_PORT, (event, windowId: string, sourceUrl: string) => {
    try {
      service.unregisterPort(windowId, sourceUrl);
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
  ipcMain.handle(HANDLERS.SEND_TEST_TRACE, async (event, sourceUrl: string) => {
    try {
      // Send a test trace to the collector endpoint
      const testTrace = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'test-service' } },
                { key: 'dev.server.url', value: { stringValue: sourceUrl } },
              ],
              droppedAttributesCount: 0,
            },
            scopeSpans: [
              {
                scope: { name: 'test-tracer' },
                spans: [
                  {
                    traceId: `test-${Date.now()}`,
                    spanId: `span-${Date.now()}`,
                    name: 'Test trace from SystemMonitor',
                    kind: 1, // INTERNAL
                    startTimeUnixNano: String(Date.now() * 1000000),
                    endTimeUnixNano: String((Date.now() + 100) * 1000000),
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

  console.log('[IPC] OTEL Collector handlers registered');
}

export { HANDLERS as OTEL_COLLECTOR_HANDLERS };
