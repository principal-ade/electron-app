/**
 * Renderer Service for CLI Bridge Diagnostics
 */

export interface CLIBridgeWorkerStatus {
  name: string;
  pid: number | null;
  isRunning: boolean;
  startedAt: number | null;
}

export interface CLIBridgeStatus {
  initialized: boolean;
  workers: CLIBridgeWorkerStatus[];
  pendingCalls: number;
  error?: string;
}

export interface CLIBridgeTestResult {
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

export interface CLIBridgeResponse {
  success: boolean;
  error?: string;
}

export class CLIBridgeService {
  /**
   * Get CLI Bridge status
   */
  static async getStatus(): Promise<CLIBridgeStatus> {
    try {
      return await window.mainProcess.cliBridge.getStatus();
    } catch (err) {
      console.error('[CLIBridgeService] Failed to get status:', err);
      return {
        initialized: false,
        workers: [],
        pendingCalls: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Test the worker by running a simple command
   */
  static async testWorker(): Promise<CLIBridgeTestResult> {
    try {
      return await window.mainProcess.cliBridge.testWorker();
    } catch (err) {
      console.error('[CLIBridgeService] Failed to test worker:', err);
      return {
        success: false,
        duration: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Restart the worker
   */
  static async restartWorker(): Promise<CLIBridgeResponse> {
    try {
      return await window.mainProcess.cliBridge.restartWorker();
    } catch (err) {
      console.error('[CLIBridgeService] Failed to restart worker:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Initialize CLI Bridge
   */
  static async initialize(): Promise<CLIBridgeResponse> {
    try {
      return await window.mainProcess.cliBridge.initialize();
    } catch (err) {
      console.error('[CLIBridgeService] Failed to initialize:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
