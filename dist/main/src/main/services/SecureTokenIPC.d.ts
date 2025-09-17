import { SecureTokenStorage } from './SecureTokenStorage';
/**
 * IPC handlers for secure token storage
 * Provides a bridge between renderer process and secure storage in main process
 */
export declare class SecureTokenIPC {
    private storage;
    constructor();
    getStorage(): SecureTokenStorage;
    private setupHandlers;
}
export declare function registerSecureTokenHandlers(): void;
export declare const secureTokenIPC: SecureTokenIPC;
//# sourceMappingURL=SecureTokenIPC.d.ts.map