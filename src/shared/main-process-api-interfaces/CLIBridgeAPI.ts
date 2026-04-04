/**
 * CLI Bridge API Interface
 * Provides diagnostics and status information for the CLI Bridge worker system
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

export const CLIBridgeEvents = {
  GET_STATUS: 'cli-bridge:getStatus',
  TEST_WORKER: 'cli-bridge:testWorker',
  RESTART_WORKER: 'cli-bridge:restartWorker',
  INITIALIZE: 'cli-bridge:initialize',
} as const;

export interface CLIBridgeAPI {
  getStatus(): Promise<CLIBridgeStatus>;
  testWorker(): Promise<CLIBridgeTestResult>;
  restartWorker(): Promise<CLIBridgeResponse>;
  initialize(): Promise<CLIBridgeResponse>;
}
