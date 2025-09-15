import { BrowserWindow } from 'electron';
interface TerminalSession {
    id: string;
    pty: any;
    directory: string;
    agentSessionId?: string;
    createdAt: number;
    lastActivity: number;
}
declare class TerminalManager {
    private sessions;
    private sessionsByRepo;
    private maxSessions;
    private terminalWindows;
    private mainWindow;
    constructor();
    setMainWindow(window: BrowserWindow): void;
    private cleanupSession;
    private createTerminalForDirectory;
    private handleTerminalCreate;
    private setupIPCHandlers;
    createTerminalWithCommand(directory: string, command: string): Promise<string | null>;
    createTerminalWindow(sessionId: string, session: TerminalSession): Promise<{
        windowId: number;
    }>;
    destroyAllSessions(): void;
}
declare let terminalManager: TerminalManager | null;
export default terminalManager;
export { terminalManager };
//# sourceMappingURL=terminal.d.ts.map