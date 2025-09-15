/**
 * AuthenticationAPI implementation for preload script
 *
 * This implementation wraps existing IPC channels to provide a unified
 * authentication interface. During migration, it forwards calls to the
 * existing handlers in AuthService, AuthStateManager, and SecureTokenIPC.
 */
import type { AuthenticationAPI } from '../../shared/main-process-api-interfaces/AuthenticationAPI';
export declare const authenticationAPI: AuthenticationAPI;
//# sourceMappingURL=authenticationApi.d.ts.map