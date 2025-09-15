/**
 * Platform adapter interface for search UI components
 * Abstracts platform-specific operations to enable cross-platform search UI
 */
export type IndexedDocumentData = unknown;
export type PlatformIndexStats = unknown;
export type PlatformMessageExtension = unknown;
export interface SearchPlatformAdapter {
    sendMessage(message: SearchPlatformMessage): void;
    onMessage(handler: (message: SearchPlatformMessage) => void): () => void;
    showInputBox(options: InputBoxOptions): Promise<string | undefined>;
    showQuickPick<T extends QuickPickItem>(items: T[], options?: QuickPickOptions): Promise<T | undefined>;
    showInformationMessage(message: string, ...actions: string[]): Promise<string | undefined>;
    showErrorMessage(message: string, ...actions: string[]): Promise<string | undefined>;
    showWarningMessage(message: string, ...actions: string[]): Promise<string | undefined>;
    openFile(uri: string, options?: OpenFileOptions): Promise<void>;
    withProgress<T>(options: ProgressOptions, task: (progress: ProgressReporter) => Promise<T>): Promise<T>;
    getPlatformInfo(): PlatformInfo;
    requestAuthorization?(): Promise<boolean>;
    getInitialQuery?(): string;
}
export type SearchPlatformMessage = {
    type: 'ready';
} | {
    type: 'authorize';
} | {
    type: 'search';
    query: string;
} | {
    type: 'openFile';
    uri: string;
    slideIndex?: number;
} | {
    type: 'reindex';
} | {
    type: 'toggleFileWatching';
    enabled: boolean;
} | {
    type: 'debugDocument';
    fileName: string;
} | {
    type: 'indexingStep';
    step: string;
    message: string;
} | {
    type: 'filesFound';
    fileList: string[];
    totalFiles: number;
    hasMore: boolean;
} | {
    type: 'indexingProgress';
    progress: number;
    currentFile: string;
    filesProcessed: number;
} | {
    type: 'indexingComplete';
    documents: IndexedDocumentData[];
    stats: PlatformIndexStats;
} | {
    type: 'parseError';
    error: string;
} | {
    type: 'performSearch';
    query: string;
} | {
    type: 'initialState';
    isAuthorized: boolean;
    hasIndex: boolean;
    indexStats?: PlatformIndexStats;
    isFileWatchingEnabled: boolean;
} | {
    type: 'fileWatchingChanged';
    enabled: boolean;
} | {
    type: 'fileChanged';
    changeType: string;
    fileName: string;
} | {
    type: string;
    [key: string]: PlatformMessageExtension;
};
export interface InputBoxOptions {
    placeholder?: string;
    prompt?: string;
    value?: string;
    validateInput?: (value: string) => string | undefined | null;
}
export interface QuickPickItem {
    label: string;
    description?: string;
    detail?: string;
    picked?: boolean;
}
export interface QuickPickOptions {
    placeHolder?: string;
    canPickMany?: boolean;
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
}
export interface OpenFileOptions {
    slideIndex?: number;
    line?: number;
    column?: number;
    selection?: {
        start: {
            line: number;
            column: number;
        };
        end: {
            line: number;
            column: number;
        };
    };
}
export interface ProgressOptions {
    location?: 'notification' | 'window' | 'hidden';
    title?: string;
    cancellable?: boolean;
}
export interface ProgressReporter {
    report(value: {
        message?: string;
        increment?: number;
    }): void;
}
export interface PlatformInfo {
    type: 'vscode' | 'web' | 'electron' | 'mobile';
    capabilities: {
        fileWatching: boolean;
        authorization: boolean;
        progress: boolean;
        notifications: boolean;
        fileAccess: boolean;
    };
    theme?: 'light' | 'dark' | 'auto';
}
//# sourceMappingURL=SearchPlatformAdapter.d.ts.map