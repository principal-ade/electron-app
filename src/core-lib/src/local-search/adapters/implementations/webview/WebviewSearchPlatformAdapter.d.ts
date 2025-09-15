/**
 * Generic Webview implementation of SearchPlatformAdapter
 * Uses standard DOM/window APIs to work in any webview context
 */
import { SearchPlatformAdapter, SearchPlatformMessage, InputBoxOptions, QuickPickItem, QuickPickOptions, OpenFileOptions, ProgressOptions, ProgressReporter, PlatformInfo } from '../../../adapters';
export declare class WebviewSearchPlatformAdapter implements SearchPlatformAdapter {
    private messageHandlers;
    private messageTarget;
    constructor();
    private handleWindowMessage;
    sendMessage(message: SearchPlatformMessage): void;
    onMessage(handler: (message: SearchPlatformMessage) => void): () => void;
    showInputBox(options: InputBoxOptions): Promise<string | undefined>;
    showQuickPick<T extends QuickPickItem>(items: T[], options?: QuickPickOptions): Promise<T | undefined>;
    private showFallbackQuickPick;
    showInformationMessage(message: string, ...actions: string[]): Promise<string | undefined>;
    showErrorMessage(message: string, ...actions: string[]): Promise<string | undefined>;
    showWarningMessage(message: string, ...actions: string[]): Promise<string | undefined>;
    private showMessage;
    private showFallbackMessage;
    private showFallbackActionDialog;
    openFile(uri: string, options?: OpenFileOptions): Promise<void>;
    withProgress<T>(options: ProgressOptions, task: (progress: ProgressReporter) => Promise<T>): Promise<T>;
    private createProgressIndicator;
    private updateProgressIndicator;
    private removeProgressIndicator;
    getPlatformInfo(): PlatformInfo;
    requestAuthorization(): Promise<boolean>;
    getInitialQuery(): string;
    private getTheme;
    dispose(): void;
}
//# sourceMappingURL=WebviewSearchPlatformAdapter.d.ts.map