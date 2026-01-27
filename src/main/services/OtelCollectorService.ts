/**
 * OTEL Collector Service - Manages OpenTelemetry collector for trace collection
 */

import { OTELCollectorServer, ServerStats } from '@principal-ai/otel-collector-server';
import { app } from 'electron';
import path from 'path';
import os from 'os';

export class OtelCollectorService {
  private static instance: OtelCollectorService | null = null;
  private server: OTELCollectorServer | null = null;
  private isRunning: boolean = false;

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

    try {
      // Determine binary path
      const binaryPath = this.getBinaryPath();

      // Create server instance
      this.server = new OTELCollectorServer({
        mode: 'electron',
        otlpPort: 4318,
        wrapperPort: 4319,
        binaryPath,
        logLevel: 'info',
        restartOnCrash: true,
      });

      // Start the server
      await this.server.start();
      this.isRunning = true;

      console.log('[OtelCollectorService] OTEL Collector started successfully');
      console.log('  - OTLP Endpoint: http://localhost:4318');
      console.log('  - Wrapper Endpoint: http://localhost:4319');
    } catch (err) {
      console.error('[OtelCollectorService] Failed to start:', err);
      this.isRunning = false;
      throw err;
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
   * Register a MessagePort for a window
   */
  registerPort(windowId: string, sourceUrl: string, port: MessagePort): void {
    if (!this.server) {
      throw new Error('OTEL Collector not started');
    }

    this.server.registerPort(windowId, sourceUrl, port);
    console.log(`[OtelCollectorService] Registered port for window ${windowId}, source: ${sourceUrl}`);
  }

  /**
   * Unregister a MessagePort for a window
   */
  unregisterPort(windowId: string, sourceUrl: string): void {
    if (!this.server) {
      return;
    }

    this.server.unregisterPort(windowId, sourceUrl);
    console.log(`[OtelCollectorService] Unregistered port for window ${windowId}, source: ${sourceUrl}`);
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
      // Production: binary bundled with app
      return path.join(process.resourcesPath, 'binaries', binaryName);
    } else {
      // Development: binary in node_modules
      return path.join(
        app.getAppPath(),
        'node_modules',
        '@principal-ai',
        'otel-collector-server',
        'binaries',
        binaryName
      );
    }
  }
}
