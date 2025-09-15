import { TerminalData, TerminalExit, TerminalInfo } from "../../shared/main-process-api-interfaces/TerminalService";
export declare class TerminalService {
    static list(): Promise<TerminalInfo[]>;
    static create(dir: string): Promise<string>;
    static getOrCreate(dir: string): Promise<string>;
    static createWithCommand(dir: string, command: string): Promise<string>;
    static destroy(id: string): Promise<void>;
    static write(id: string, data: string): Promise<void>;
    static onData(callback: (data: TerminalData) => void): Promise<() => void>;
    static onExit(callback: (exit: TerminalExit) => void): Promise<() => void>;
    static popOut(id: string): Promise<{
        windowId: number;
    }>;
    static focusWindow(windowId: number): Promise<void>;
    static resize(id: string, cols: number, rows: number): Promise<void>;
    static refresh(id: string): Promise<boolean>;
    static onWindowReady(callback: (data: {
        terminalId?: string;
        agentSessionId?: string;
    }) => void): () => void;
}
//# sourceMappingURL=TerminalService.d.ts.map