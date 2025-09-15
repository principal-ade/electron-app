import type { EditorId } from '../../../shared/types/editor.types';
import type { TerminalId } from '../../../shared/types/terminal.types';
export declare const shell: {
    openExternal: (url: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
    runCommand: (command: string, options?: {
        cwd?: string;
        timeout?: number;
    }) => Promise<{
        success: boolean;
        output?: string;
        error?: string;
        stderr?: string;
        code?: number;
    }>;
    openInEditor: (params: {
        editor: EditorId;
        dir: string;
    }) => Promise<{
        success: boolean;
        error?: string;
    }>;
    openInTerminal: (params: {
        terminal: TerminalId;
        dir: string;
        command?: string;
    }) => Promise<{
        success: boolean;
        error?: string;
    }>;
};
//# sourceMappingURL=shell.d.ts.map