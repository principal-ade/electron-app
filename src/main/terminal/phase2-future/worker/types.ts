/**
 * Message types for communication between main process and PTY worker
 */

// Messages sent from main process to worker
export type WorkerControlMessage =
  | {
      type: 'CREATE_SESSION';
      sessionId: string;
      cols: number;
      rows: number;
      cwd: string;
      env: Record<string, string>;
      shell: string;
      args: string[];
      command?: string; // Optional initial command to run
    }
  | {
      type: 'DESTROY_SESSION';
      sessionId: string;
    }
  | {
      type: 'RESIZE_SESSION';
      sessionId: string;
      cols: number;
      rows: number;
    }
  | {
      type: 'WRITE_SESSION';
      sessionId: string;
      data: string;
    };

// Messages sent from worker to main process
export type WorkerEventMessage =
  | {
      type: 'SESSION_CREATED';
      sessionId: string;
      success: boolean;
      error?: string;
    }
  | {
      type: 'SESSION_EXIT';
      sessionId: string;
      exitCode: number;
    }
  | {
      type: 'SESSION_ERROR';
      sessionId: string;
      error: string;
    }
  | {
      type: 'WORKER_READY';
    }
  | {
      type: 'WORKER_ERROR';
      error: string;
    };

// Messages sent through MessagePort (PTY data to renderer)
export interface PtyDataMessage {
  type: 'DATA';
  data: string;
}

// Messages sent from renderer through MessagePort
export type RendererPortMessage =
  | {
      type: 'WRITE';
      data: string;
      token?: string; // Optional ownership token
    }
  | {
      type: 'RESIZE';
      cols: number;
      rows: number;
      token?: string;
    };

export interface WorkerSessionInfo {
  sessionId: string;
  ptyPid: number;
  port: MessagePort;
  ownershipToken?: string;
}
