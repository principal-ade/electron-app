/**
 * Type definitions for electron-cli-bridge
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type WorkerCommandType = 'execute' | 'stream' | 'kill';
export type WorkerResponseType =
  | 'stdout'
  | 'stderr'
  | 'complete'
  | 'error'
  | 'progress';

export interface ExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  maxBuffer?: number;
  encoding?: BufferEncoding;
  shell?: boolean;
}

export interface ExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface StreamOptions extends ExecuteOptions {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onProgress?: (data: string) => void;
}

// Worker message types
export interface WorkerCommand {
  id: string;
  type: WorkerCommandType;
  command: string;
  args: string[];
  options: ExecuteOptions;
}

export interface WorkerResponse {
  id: string;
  type: WorkerResponseType;
  data?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
  duration?: number;
}

// ESLint specific types
export interface ESLintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  nodeType: string;
  messageId?: string;
  endLine?: number;
  endColumn?: number;
  fix?: {
    range: [number, number];
    text: string;
  };
}

export interface ESLintResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  source?: string;
}

export interface CLIBridgeOptions {
  maxWorkers?: number;
  workerTimeout?: number;
  logLevel?: LogLevel;
}

export interface PendingCall {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  options: ExecuteOptions;
  startTime: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}
