/**
 * Consolidated authentication handlers for IPC communication
 *
 * This module registers unified authentication channel names that wrap
 * the existing handlers from AuthService, AuthStateManager, and SecureTokenIPC.
 *
 * During migration, both old and new channel names will work.
 * Once migration is complete, the logic will be moved here.
 */
export declare function registerAuthenticationHandlers(): void;
//# sourceMappingURL=authHandlers.d.ts.map