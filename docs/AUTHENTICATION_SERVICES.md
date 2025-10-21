# Authentication Services Documentation

## Overview

This document describes the authentication services used in the Electron application, focusing on secure credential storage and the important consideration regarding macOS keychain access.

## Services

### AuthService

File: `src/main/services/AuthService.ts`

The primary authentication service that handles OAuth authentication for the application using WorkOS (with GitHub as the identity provider).

**Key Features:**
- OAuth authentication flow with WorkOS (GitHub provider)
- Secure credential storage using Electron's `safeStorage` API
- Session management and auth state tracking
- IPC handlers for renderer process communication

**Storage:**
- Uses `electron-store` for persistent storage WITHOUT encryption
- Credentials are encrypted separately using `safeStorage.encryptString()` when stored
- This approach avoids double encryption and provides better control over keychain access

**Important Note:**
- The service deliberately does NOT check `safeStorage.isEncryptionAvailable()` during initialization
- This check would trigger macOS keychain access prompts on startup
- Encryption availability is implicitly verified when actually encrypting/decrypting data

### SecureTokenIPC

File: `src/main/services/SecureTokenIPC.ts`

Provides IPC (Inter-Process Communication) handlers for secure token operations between the main and renderer processes.

**Key Features:**
- Lazy initialization - instance created only on first use
- Generic token storage/retrieval operations
- GitHub-specific auth token management
- Token migration from localStorage

**Implementation Details:**
- Uses singleton pattern with lazy initialization
- All IPC handlers are registered without creating the service instance
- The actual SecureTokenStorage instance is created only when first token operation occurs

### SecureTokenStorage

File: `src/main/services/SecureTokenStorage.ts`

Low-level secure storage service that handles the actual encryption/decryption of tokens.

**Key Features:**
- Uses Electron's `safeStorage` API for encryption
- Stores encrypted tokens in JSON file in userData directory
- In-memory cache for performance
- Singleton pattern for consistent access

**Storage Location:**
- `{userData}/secure-tokens.json` - Encrypted token storage file

## Keychain Access on macOS

### The Problem

On macOS, Electron's `safeStorage` API uses the system keychain for encryption operations. Certain operations can trigger keychain access prompts requiring the user's password:

1. **`safeStorage.isEncryptionAvailable()`** - Checking encryption availability
2. **`safeStorage.encryptString()`** - First encryption operation
3. **`safeStorage.decryptString()`** - First decryption operation

### The Solution

To avoid keychain prompts on application startup:

1. **Deferred Initialization:**
   - AuthService is initialized but doesn't check encryption availability
   - SecureTokenIPC handlers are registered without creating instances
   - SecureTokenStorage is created only when needed

2. **Lazy Access Pattern:**
   ```javascript
   // DON'T do this on startup:
   if (safeStorage.isEncryptionAvailable()) {
     console.log('Encryption available');
   }

   // DO this - check only when actually needed:
   async function storeToken(token) {
     // Keychain access happens here, when user actually needs it
     const encrypted = safeStorage.encryptString(token);
   }
   ```

3. **Service Registration:**
   - IPC handlers are registered using a factory pattern
   - Actual service instances are created on first IPC call
   - This delays keychain access until user performs an auth operation

## Architecture Benefits

### Security
- Credentials are always encrypted at rest
- Keychain integration provides OS-level security
- No hardcoded encryption keys in the application

### User Experience
- No keychain prompts on application startup
- Keychain access only when performing auth operations
- Smooth startup experience

### Maintainability
- Clear separation of concerns between services
- Lazy initialization pattern is explicit and documented
- Type-safe IPC communication using enums

## Usage Example

```typescript
// In main process - services are registered but not instantiated
import { registerSecureTokenHandlers } from `src/main/services/SecureTokenIPC`;

// Register handlers without triggering keychain
registerSecureTokenHandlers();

// In renderer process - triggers keychain only when called
const result = await window.mainProcess.authentication.check();
// Keychain prompt appears here on first auth check
```

## Best Practices

1. **Never call `safeStorage.isEncryptionAvailable()` during startup**
   - This immediately triggers keychain access on macOS
   - Encryption availability will be evident when encryption is attempted

2. **Use lazy initialization for security services**
   - Register handlers without creating instances
   - Create instances only when first operation is requested

3. **Document keychain access points**
   - Make it clear in code comments where keychain access occurs
   - Help future developers understand the implications

4. **Test on macOS**
   - Keychain behavior is macOS-specific
   - Always test authentication flows on macOS to verify user experience

## Related Files

- `src/shared/main-process-api-interfaces/SecureTokenAPI.ts` - API event definitions
- `src/shared/main-process-api-interfaces/AuthenticationAPI.ts` - Authentication interfaces
- `src/main/services/AuthStateManager.ts` - Auth state management
- `src/main/services/OAuthServerClient.ts` - OAuth client implementation