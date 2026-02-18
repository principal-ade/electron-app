/**
 * Preload API implementation for OTEL Collector Service
 */

import { ipcRenderer } from 'electron';
import type {
  OtelCollectorAPI,
  OtelCollectorResponse,
  OtelCollectorStatus,
  RegisterPortResponse,
  GetTracesResponse,
} from '../../shared/main-process-api-interfaces/OtelCollectorAPI';

// ============================================
// OTEL Collector MessagePort Management
// ============================================

// Type alias for MessagePort to avoid TypeScript type/value confusion
type Port = InstanceType<typeof MessagePort>;

// OTEL collector port storage (key: windowId:serviceIdentifier)
const otelPorts = new Map<string, Port>();

// Message subscribers - for receiving trace data
const otelMessageSubscribers = new Map<string, Set<(data: unknown) => void>>();

// Listen for MessagePort delivery from main process
ipcRenderer.on('otel-collector:port', (event, data: { windowId: string; serviceIdentifier: string }) => {
  console.info('[otelCollectorApi] 📨 Received otel-collector:port event', data);

  const [port] = event.ports;
  if (!port) {
    console.warn('[otelCollectorApi] ❌ Received otel-collector:port event without a port');
    return;
  }

  const key = `${data.windowId}:${data.serviceIdentifier}`;

  // Store the port
  otelPorts.set(key, port);

  // Start the port to enable messaging
  port.start();
  console.info(`[otelCollectorApi] ✅ OTEL port started for ${key}`);

  // Set up message handler to route to subscribers
  port.onmessage = (e: MessageEvent) => {
    const subscribers = otelMessageSubscribers.get(key);
    if (subscribers && subscribers.size > 0) {
      subscribers.forEach((cb) => cb(e.data));
    } else {
      console.warn(`[otelCollectorApi] No subscribers for OTEL messages on ${key}`);
    }
  };

  console.info(`[otelCollectorApi] ✅ OTEL port ready for ${key}`);
});

export const otelCollectorApi: OtelCollectorAPI = {
  /**
   * Start the OTEL collector
   */
  async start(): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:start');
  },

  /**
   * Stop the OTEL collector
   */
  async stop(): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:stop');
  },

  /**
   * Get collector status
   */
  async getStatus(): Promise<OtelCollectorStatus> {
    return await ipcRenderer.invoke('otel-collector:getStatus');
  },

  /**
   * Register a MessagePort to receive traces for a specific service
   * Port is handled in preload; messages are delivered via window.electron.onOtelMessage()
   */
  async registerPort(windowId: string, serviceIdentifier: string): Promise<RegisterPortResponse> {
    const key = `${windowId}:${serviceIdentifier}`;

    try {
      // Trigger the IPC call to register the port (main will send it via postMessage to preload)
      const response = await ipcRenderer.invoke('otel-collector:registerPort', windowId, serviceIdentifier);

      return response;
    } catch (error) {
      console.error(`[otelCollectorApi] ❌ Failed to register port for ${key}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  /**
   * Unregister a trace port
   */
  async unregisterPort(windowId: string, serviceIdentifier: string): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:unregisterPort', windowId, serviceIdentifier);
  },

  /**
   * Unregister all ports for a window
   */
  async unregisterWindow(windowId: string): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:unregisterWindow', windowId);
  },

  /**
   * Send a test trace to the collector
   */
  async sendTestTrace(serviceIdentifier: string): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:sendTestTrace', serviceIdentifier);
  },

  /**
   * Get stored traces
   */
  async getTraces(limit?: number): Promise<GetTracesResponse> {
    return await ipcRenderer.invoke('otel-collector:getTraces', limit);
  },

  /**
   * Clear stored traces
   */
  async clearTraces(): Promise<OtelCollectorResponse> {
    return await ipcRenderer.invoke('otel-collector:clearTraces');
  },

  /**
   * Subscribe to OTEL messages (abstracts MessagePort)
   */
  onOtelMessage(
    windowId: string,
    serviceIdentifier: string,
    callback: (data: unknown) => void,
  ): () => void {
    const key = `${windowId}:${serviceIdentifier}`;
    console.info(`[otelCollectorApi] 📝 Subscribing to OTEL messages for ${key}`);

    // Initialize subscriber set for this key if needed
    let subscribers = otelMessageSubscribers.get(key);
    if (!subscribers) {
      subscribers = new Set();
      otelMessageSubscribers.set(key, subscribers);
    }

    // Add the callback to subscribers
    subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = otelMessageSubscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback);
        console.info(`[otelCollectorApi] 🗑️ Unsubscribed from OTEL messages for ${key}`);

        // Clean up empty subscriber sets
        if (subscribers.size === 0) {
          otelMessageSubscribers.delete(key);
        }
      }
    };
  },

  /**
   * Send message to OTEL port
   */
  sendOtelMessage(windowId: string, serviceIdentifier: string, data: unknown): boolean {
    const key = `${windowId}:${serviceIdentifier}`;
    const port = otelPorts.get(key);
    if (port) {
      try {
        port.postMessage(data);
        console.info(`[otelCollectorApi] 📤 Sent message to OTEL port ${key}`);
        return true;
      } catch (err) {
        console.error(`[otelCollectorApi] Error sending to OTEL port ${key}:`, err);
        return false;
      }
    }
    console.warn(`[otelCollectorApi] No OTEL port found for ${key}`);
    return false;
  },

  /**
   * Helper to remove OTEL port on cleanup
   */
  removeOtelPort(windowId: string, serviceIdentifier: string): void {
    const key = `${windowId}:${serviceIdentifier}`;
    const port = otelPorts.get(key);
    if (port) {
      try {
        port.close();
      } catch (err) {
        console.warn(`[otelCollectorApi] Error closing OTEL port ${key}:`, err);
      }
      otelPorts.delete(key);
      otelMessageSubscribers.delete(key);
      console.info(`[otelCollectorApi] 🗑️ Removed OTEL port ${key}`);
    }
  },
};
