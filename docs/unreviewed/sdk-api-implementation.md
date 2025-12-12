# SDK API Implementation

## Architecture Overview

We've implemented the SDK API following the existing conventions in the codebase:

### 1. API Interface Definition
- **Location**: `src/shared/main-process-api-interfaces/AgentSessionSDKAPI.ts`
- **Pattern**: Defines types, enums for events, and interface
- **Key Components**:
  - `AgentSessionSDKAPIEvents` enum - IPC event names
  - `AgentSessionSDKAPI` interface - Method signatures
  - `ProjectSessions`, `SessionSummary` types - Data structures

### 2. Window API Implementation
- **Location**: `src/window/main-process-api-implementations/agentSessionSDKApi.ts`
- **Pattern**: Uses `ipcRenderer.invoke()` for async calls
- **Connects**: Renderer process to main process via IPC

### 3. Main Process API Integration
- **Location**: `src/shared/main-process-api-interfaces/index.ts`
- **Pattern**: Added to `MainProcessAPI` interface
- **Exposed**: As `agentSessionSDK` property

### 4. Preload Script
- **Location**: `src/window/preload.ts`
- **Pattern**: Imports and exposes via `contextBridge`
- **Access**: Available as `window.mainProcess.agentSessionSDK`

### 5. Renderer Service
- **Location**: `src/renderer/main-process-api/AgentSessionSDKService.ts`
- **Pattern**: Static class methods that call IPC
- **Usage**: Components import and use this service

## Implementation Status

### ✅ Completed
1. API interface with proper enum for events
2. Window implementation with IPC calls
3. Added to MainProcessAPI interface
4. Exposed in preload script
5. Updated renderer service to use IPC instead of stubs

### 🔄 Next Steps
1. Create main process handlers (`agentSessionSDKHandlers.ts`)
2. Register handlers in main process initialization
3. Implement actual data fetching logic
4. Test with real data flow

## IPC Event Flow

```
Component (Renderer)
    ↓
AgentSessionSDKService.getActiveSessionsByProject()
    ↓
window.mainProcess.agentSessionSDK.getActiveSessionsByProject()
    ↓
ipcRenderer.invoke('sdk-sessions:get-active-by-project')
    ↓
Main Process Handler (to be implemented)
    ↓
Data from Storage/SDK
```

## Key Conventions Followed

1. **Enums for Events**: Using `AgentSessionSDKAPIEvents` enum instead of string literals
2. **Proper Typing**: All methods and data structures fully typed
3. **IPC Pattern**: Using `invoke()` for async operations, event listeners for real-time
4. **Interface Extension**: Properly added to `MainProcessAPI` interface
5. **Separation of Concerns**: Clear separation between renderer service, IPC layer, and main process

## Migration Benefits

1. **Type Safety**: Using SDK types (`RepoNormalizedUniversalAgentSessionEvent`) directly
2. **Repository-based**: Sessions grouped by repository, not directory
3. **Future-proof**: Ready for full SDK integration
4. **Backward Compatible**: Helper methods for directory-based queries
5. **Clean Architecture**: Following established patterns

## Testing

The renderer service still includes call tracking for debugging:
```javascript
// In console:
window.sdkServiceStats() // Shows which methods have been called
```

This helps identify which methods need implementation priority.