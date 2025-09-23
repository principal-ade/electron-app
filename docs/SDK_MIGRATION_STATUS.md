# SDK Migration Status

## Completed Steps

### 1. Created New SDK Service (`AgentSessionSDKService`)
- Location: `src/renderer/main-process-api/AgentSessionSDKService.ts`
- Features:
  - Uses new SDK types (`RepoNormalizedUniversalAgentSessionEvent`)
  - All methods are stubs that log calls and return mock data
  - Built-in call tracking to see what's actually used
  - Helper methods for directory → repository mapping

### 2. Migrated Components

#### Successfully Migrated:
1. **SessionEventsView.tsx** ✅
   - Now uses `getSDKSessionEvents()`
   - Returns `RepoNormalizedUniversalAgentSessionEvent[]`
   - Already had type alias ready!

2. **useAgentSessions.ts** ✅
   - Now uses `getActiveSessionsForDirectory()`
   - Uses `getSDKSession()` for full details
   - Maps directory to repository concept

3. **EventHistoryModal.tsx** ✅
   - Updated to use SDK service
   - Works with new event type

4. **EventSegmenterService.ts** ✅
   - Updated all methods to use `RepoNormalizedUniversalAgentSessionEvent`
   - Service logic unchanged, just type updates

5. **RepositoryManager.tsx** ✅
   - Uses `getActiveSessionsByProject()`
   - Updated to use repository instead of directory

### 3. Debug Component Added
- Created `SDKServiceDebug.tsx` component
- Shows button to print call statistics
- Added to RepositoryManager page
- Access stats via console: `window.sdkServiceStats()`

## How to Test

1. Run the app: `npm start`
2. Navigate to any repository view
3. Use the app normally
4. Click "Print Call Stats" button (bottom right) or run `window.sdkServiceStats()` in console
5. See which SDK methods are actually called

## Call Tracking

The SDK service tracks every method call with:
- Method name
- Call count
- Arguments passed
- Call stack (to see where it's called from)

Example console output:
```
[SDK Service] getActiveSessionsByProject called: {
  count: 1,
  args: undefined,
  stack: "at RepositoryManager.tsx:733"
}
```

## Next Steps

### What's Still Using Legacy Service

These components still need migration:
- `AgentSessionsTab.tsx` - Uses `updateSessionMetadata()` and event listeners
- `AgentSessionDebugModal.tsx` - Debug features
- `MultiFileEditorWindow.tsx` - Event listeners
- `LocalDevelopmentView.tsx` - Event listeners
- Other components listed in UI_SERVICE_USAGE.md

### Migration Strategy

1. **Run the app** with current migrations
2. **Track calls** to see which stubs are invoked
3. **Implement only used methods** in the SDK service
4. **Gradually migrate** remaining components
5. **Remove legacy service** once all migrated

## Key Changes in New Format

### Event Structure
```typescript
// Old: NormalizedAgentSessionEvent
{
  eventType: string,
  sessionId: string,
  workingDirectory: string,
  files?: NormalizedPathInfo[],
  // ...
}

// New: RepoNormalizedUniversalAgentSessionEvent
{
  eventType: string,
  sessionId: string,
  workingDirectory: string,
  repository?: {
    root: string,
    name: string,
    provider: string,
    owner: string
  },
  files?: NormalizedPathInfo[],
  // ...
}
```

### Session Grouping
- **Old**: Grouped by directory (`DirectorySessions`)
- **New**: Grouped by repository (`ProjectSessions`)
- **Helper**: `mapDirectoryToRepository()` for compatibility

## Benefits

1. **Type Safety**: Using SDK types directly, no conversion needed
2. **Visibility**: Can see exactly what methods are used
3. **Gradual Migration**: UI still works with stubs
4. **Clean Architecture**: Clear separation between old and new

## Notes

- The UI won't fully work until stubs are implemented
- Some features may error with mock data
- Check console for SDK service logs
- All stub methods return reasonable mock data for testing