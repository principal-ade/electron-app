/**
 * Shell Service - Wrapper for shell operations
 * Provides a centralized service for opening external URLs, files, and terminals
 */
import type { EditorId } from '../../shared/types/editor.types';
import type { TerminalId } from '../../shared/types/terminal.types';
export declare class ShellService {
    /**
     * Open a URL in the default browser
     */
    static openExternal(url: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Run a shell command
     */
    static runCommand(command: string, options?: {
        cwd?: string;
        timeout?: number;
    }): Promise<{
        success: boolean;
        output?: string;
        error?: string;
        stderr?: string;
        code?: number;
    }>;
    /**
     * Open a file or directory in an external editor
     */
    static openInEditor(params: {
        editor: EditorId;
        dir?: string;
        files?: string[];
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Open a terminal with optional command
     */
    static openInTerminal(params: {
        terminal: TerminalId;
        dir: string;
        command?: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Open a file or directory in the system's default application.
     * Similar to openExternal but specifically for local paths.
     */
    static openPath(path: string): Promise<void>;
    /**
     * Open a terminal window at the specified path.
     * Uses the system's default terminal application.
     */
    static openTerminal(path: string): Promise<void>;
    /**
     * Check if a command is available in the system PATH.
     * Returns information about the command's location and availability.
     */
    static checkCommand(command: string): Promise<{
        exists: boolean;
        path?: string;
        error?: string;
    }>;
    /**
     * Clear the cached PATH information.
     * Useful when the system PATH has been modified.
     */
    static clearPathCache(): Promise<void>;
    /**
     * Open a path in the default editor (simplified version)
     * This is a convenience method that uses VS Code as the default editor
     */
    static openInDefaultEditor(path: string): Promise<{
        success: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=ShellService.d.ts.map