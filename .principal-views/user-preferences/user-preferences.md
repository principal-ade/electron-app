# User Preferences

User settings persistence and cross-window broadcast system.

## Overview

The User Preferences system manages application settings that persist across sessions and synchronize across all open Electron windows. It handles preferences like:

- Default editor selection
- UI visibility toggles (monitor button, search button, etc.)
- Theme settings and custom overrides
- Feature flags (Vim mode, PTY daemon, etc.)

## Architecture

### Components

1. **Renderer Service** (`UserPreferencesService`)
   - Exposes `getPreferences()` and `updatePreferences()` to UI components
   - Listens for `user-preferences-updated` events for external changes

2. **IPC Layer** (`UserPreferencesAPI`)
   - `userPreferences:getPreferences` - Fetch current preferences
   - `userPreferences:updatePreferences` - Update preferences
   - `userPreferences:changed` - Broadcast channel for changes

3. **Main Process Handler** (`UserPreferencesHandler`)
   - Singleton managing preference state
   - Persists to `TypedMultiStoreWrapper` with `USER_PREFERENCES` namespace
   - Broadcasts changes to all windows via IPC

### Data Flow

```
Settings UI
    ↓ updatePreferences({key: value})
UserPreferencesService (renderer)
    ↓ ipcRenderer.invoke('userPreferences:updatePreferences')
UserPreferencesHandler (main)
    ↓ deepMerge + typedStore.set()
TypedMultiStoreWrapper (storage)
    ↓ broadcastPreferencesChanged()
All BrowserWindows
    ↓ webContents.send('userPreferences:changed')
Renderer windows dispatch 'user-preferences-updated' CustomEvent
```

## Events

| Event | Description |
|-------|-------------|
| `user_preferences.get` | Preferences fetched from store |
| `user_preferences.update.started` | Update initiated from renderer |
| `user_preferences.update.persisted` | Saved to storage |
| `user_preferences.broadcast` | Broadcast to all windows |
| `user_preferences.update.complete` | Update finished successfully |
| `user_preferences.update.error` | Update failed |
| `user_preferences.renderer.received` | Renderer received update |

## Key Files

- `src/shared/types/userPreferences.types.ts` - Type definitions
- `src/main/stores/userPreferencesHandler.ts` - Main process handler
- `src/renderer/main-process-api/UserPreferencesService.ts` - Renderer service
- `src/window/main-process-api-implementations/userPreferencesApi.ts` - IPC bridge
- `src/renderer/principal-window/views/Settings/components/GeneralSettings.tsx` - Settings UI
