# Orbit P2P Collaboration - IPC Implementation

## Overview

The Orbit P2P collaboration system now uses **Electron IPC (Inter-Process Communication)** to handle all API calls through the main process. This approach:

1. **Eliminates CORS issues** - No cross-origin requests from renderer
2. **Improves security** - API calls are proxied through main process
3. **Simplifies configuration** - No need for CORS headers on server

## Architecture

```
Renderer Process          Main Process           Server
     │                         │                    │
     ├──[IPC]──────────►      │                    │
     │  orbit:openAuth         ├──[HTTPS]─────────►│
     │                         │                    │
     ├──[IPC]──────────►      │                    │
     │  orbit:authenticate     ├──[HTTPS]─────────►│
     │                         │   (No CORS!)       │
     ├──[IPC]──────────►      │                    │
     │  orbit:checkStatus      ├──[HTTPS]─────────►│
     │                         │                    │
```

## Implementation Components

### 1. Main Process Service (`OrbitProxyService.ts`)
- Handles IPC messages from renderer
- Makes HTTP requests to server (no CORS)
- Returns results via IPC

### 2. Preload Script (`preload.ts`)
- Exposes `window.mainProcess.orbit` API
- Bridges renderer and main process

### 3. Renderer Service (`GitHubAuthIPC.ts`)
- Uses IPC instead of direct HTTP
- Same interface as before
- No CORS issues

### 4. API Types (`OrbitAPI.ts`)
- TypeScript interfaces for type safety
- Shared between main and renderer

## Usage

### In Renderer Components:

```typescript
// Open OAuth page
const result = await window.mainProcess.orbit.openAuth();

// Exchange code for token
const authResult = await window.mainProcess.orbit.authenticate(code);

// Check status
const status = await window.mainProcess.orbit.checkStatus(token);
```

### Benefits of IPC Approach:

1. **No CORS Configuration Needed**
   - Server doesn't need CORS headers
   - Works with any server configuration

2. **Enhanced Security**
   - Renderer can't directly access API
   - Main process validates all requests
   - API keys/secrets stay in main process

3. **Better Error Handling**
   - Network errors handled in main process
   - Consistent error responses
   - Can add retry logic centrally

4. **Easier Testing**
   - Can mock IPC calls
   - No need for test server
   - Deterministic behavior

## Files Modified

### Main Process:
- `/src/main/services/OrbitProxyService.ts` - IPC handlers
- `/src/main/initialization.ts` - Register handlers
- `/src/window/preload.ts` - Expose orbit API
- `/src/window/main-process-api-implementations/orbitApi.ts` - IPC client

### Renderer Process:
- `/src/renderer/services/p2p/GitHubAuthIPC.ts` - IPC-based auth service
- `/src/renderer/components/CollaborationPanelWithSync.tsx` - Use IPC service

### Type Definitions:
- `/src/shared/main-process-api-interfaces/OrbitAPI.ts` - API interface
- `/src/shared/main-process-api-interfaces/index.ts` - Include orbit API

## Testing

1. **Start the app**: `npm run start`
2. **Open a repository** in Develop mode
3. **Click Orbit button** to authenticate
4. **Check console** - No CORS errors!
5. **Verify authentication** works correctly

## Server Configuration

The server (`https://principle-md.com`) now doesn't need CORS headers for the Electron app. However, you may still want CORS for web-based clients.

## Security Considerations

1. **Main process validates** all requests
2. **Tokens stored securely** in renderer localStorage
3. **No direct API access** from renderer
4. **HTTPS only** for production

## Future Improvements

1. **Add request caching** in main process
2. **Implement retry logic** for failed requests
3. **Add request queuing** for offline support
4. **Store tokens in electron-store** instead of localStorage
5. **Add API key authentication** for additional security