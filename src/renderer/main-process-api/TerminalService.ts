import { TerminalData, TerminalExit, TerminalInfo } from "../../shared/main-process-api-interfaces/TerminalService";

export class TerminalService {
  static async list(): Promise<TerminalInfo[]> {
    return window.mainProcess.terminal.list();
  }

  static async create(dir: string): Promise<string> {
    return window.mainProcess.terminal.create(dir);
  }
  
  static async getOrCreate(dir: string): Promise<string> {
    return window.mainProcess.terminal.getOrCreate(dir);
  }
  
  static async createWithCommand(dir: string, command: string): Promise<string> {
    return window.mainProcess.terminal.createWithCommand(dir, command);
  }

  static async destroy(id: string): Promise<void> {
    return window.mainProcess.terminal.destroy(id);
  }

  static async write(id: string, data: string): Promise<void> {
    return window.mainProcess.terminal.write(id, data);
  }

  static async onData(callback: (data: TerminalData) => void): Promise<() => void> {
    return window.mainProcess.terminal.onData(callback);
  }

  static async onExit(callback: (exit: TerminalExit) => void): Promise<() => void> {
    return window.mainProcess.terminal.onExit(callback);
  }

  static async popOut(id: string): Promise<{ windowId: number }> {
    return window.mainProcess.terminal.popOut(id);
  }
  
  static async focusWindow(windowId: number): Promise<void> {
    return window.mainProcess.terminal.focusWindow(windowId);
  }

  static async resize(id: string, cols: number, rows: number): Promise<void> {
    return window.mainProcess.terminal.resize(id, cols, rows);
  }

  static async refresh(id: string): Promise<boolean> {
    return window.mainProcess.terminal.refresh(id);
  }

  static onWindowReady(callback: (data: { terminalId?: string; agentSessionId?: string }) => void): () => void {
    return window.mainProcess.terminal.onWindowReady?.(callback) || (() => {});
  }
}