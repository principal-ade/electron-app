import type { EditorId } from '../../shared/types/editor.types';
import type { TerminalId } from '../../shared/types/terminal.types';
export declare const shellAPI: {
    openExternal: (url: string) => Promise<any>;
    runCommand: (command: string, options?: {
        cwd?: string;
        timeout?: number;
    }) => Promise<any>;
    runGrep: (params: {
        pattern: string;
        path?: string;
        glob?: string;
        output_mode?: string;
        [key: string]: any;
    }) => Promise<any>;
    runBashCommand: (params: {
        command: string;
        cwd?: string;
    }) => Promise<any>;
    openInEditor: (params: {
        editor: EditorId;
        dir?: string;
        files?: string[];
    }) => Promise<any>;
    openInTerminal: (params: {
        terminal: TerminalId;
        dir: string;
        command?: string;
    }) => Promise<any>;
    moveToTrash: (filePath: string) => Promise<any>;
    openPath: (path: string) => Promise<any>;
    openTerminal: (path: string) => Promise<any>;
    checkCommand: (command: string) => Promise<any>;
    clearPathCache: () => Promise<any>;
};
//# sourceMappingURL=shellApi.d.ts.map