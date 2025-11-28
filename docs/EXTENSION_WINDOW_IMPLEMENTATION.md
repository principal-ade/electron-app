# Extension Window Implementation

This document describes the implementation of the Extension Window, a dedicated interface for browsing and managing panel extensions in the application.

## Overview

The Extension Window provides users with a way to:
- View all installed panel extensions
- See detailed information about each extension and its panels
- Enable/disable extensions
- Uninstall extensions

Extensions are stored in the user's home directory (`~/.principal/extensions/`) and persist across application reinstalls.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Extension Window                              │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐ │
│  │  Extension List  │  │           Extension Details               │ │
│  │  ┌────────────┐  │  │  ┌────────────────────────────────────┐  │ │
│  │  │ Ext A      │  │  │  │ Package: @publisher/ext-a          │  │ │
│  │  │ Ext B    ●─┼──┼──┼─▶│ Version: 1.0.0                     │  │ │
│  │  │ Ext C      │  │  │  │ Author: Publisher                   │  │ │
│  │  └────────────┘  │  │  │                                     │  │ │
│  │                  │  │  │ Panels:                             │  │ │
│  │  [Toggle switches│  │  │  - Panel One                        │  │ │
│  │   for enable/    │  │  │  - Panel Two                        │  │ │
│  │   disable]       │  │  │                                     │  │ │
│  │                  │  │  │ [Enable/Disable] [Uninstall]        │  │ │
│  └──────────────────┘  │  └────────────────────────────────────┘  │ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ExtensionDiscoveryService                         │
│  - Scans ~/.principal/extensions/ for packages                       │
│  - Validates package.json for 'panel-extension' keyword             │
│  - Caches panel metadata for fast startup                           │
│  - Manages extensions.json registry                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    File System Storage                               │
│  ~/.principal/                                                       │
│  ├── extensions/           # Extension packages                      │
│  ├── extensions.json       # Registry (enabled state, versions)      │
│  └── extension-cache.json  # Cached panel metadata                   │
└─────────────────────────────────────────────────────────────────────┘
```

## File Structure

### Main Process

```
src/main/
├── services/
│   └── ExtensionDiscoveryService.ts    # Core discovery and management
├── window/
│   └── extensionWindowHandlers.ts      # Window creation handlers
└── initialization.ts                    # Service registration
```

### Shared Types

```
src/shared/
├── main-process-api-interfaces/
│   ├── ExtensionAPI.ts                 # Extension types and IPC events
│   └── ExtensionWindowAPI.ts           # Window preload API interface
├── ipc-events/
│   └── WindowEvents.ts                 # OPEN_EXTENSION_WINDOW event
└── types/
    └── userPreferences.types.ts        # extensionsDirectory preference
```

### Preload

```
src/window/
├── preload-extension-window.ts         # Preload script
└── main-process-api-implementations/
    └── extensionApi.ts                 # IPC wrapper for renderer
```

### Renderer

```
src/renderer/extension-window/
├── index.tsx                           # Entry point
├── ExtensionWindowApp.tsx              # Main application component
├── ExtensionWindowTitlebar.tsx         # Window titlebar
└── components/
    ├── ExtensionList.tsx               # Left sidebar list
    └── ExtensionDetails.tsx            # Right detail panel
```

## Key Components

### ExtensionDiscoveryService

The main process service responsible for:

1. **Discovery** - Scans the extensions directory for packages with the `panel-extension` keyword
2. **Validation** - Ensures packages have valid `package.json` and bundle files
3. **Caching** - Stores panel metadata to avoid re-parsing bundles on every startup
4. **Registry** - Manages `extensions.json` with enabled/disabled state
5. **IPC Handlers** - Exposes discovery and management functions to renderer

```typescript
// Key methods
class ExtensionDiscoveryService {
  async discoverExtensions(): Promise<DiscoveredExtension[]>
  async loadExtension(packageName: string): Promise<LoadedExtension | null>
  async enableExtension(packageName: string): Promise<void>
  async disableExtension(packageName: string): Promise<void>
  async uninstallExtension(packageName: string): Promise<void>
}
```

### Extension Storage Format

**extensions.json** - Registry of installed extensions:
```json
{
  "installed": {
    "@publisher/my-panels": {
      "version": "1.0.0",
      "enabled": true,
      "installedAt": "2025-11-28T10:00:00Z"
    }
  }
}
```

**extension-cache.json** - Cached panel metadata:
```json
{
  "@publisher/my-panels": {
    "packageName": "@publisher/my-panels",
    "packageVersion": "1.0.0",
    "panels": [
      {
        "id": "publisher.panel-one",
        "name": "Panel One",
        "icon": "📊",
        "description": "A custom panel"
      }
    ],
    "cachedAt": 1732795200000
  }
}
```

### IPC Communication

The extension API uses Electron IPC for communication:

```typescript
// IPC Events
const ExtensionAPIEvents = {
  DISCOVER_EXTENSIONS: 'extension:discover',
  GET_EXTENSIONS_DIRECTORY: 'extension:get-directory',
  LOAD_EXTENSION: 'extension:load',
  ENABLE_EXTENSION: 'extension:enable',
  DISABLE_EXTENSION: 'extension:disable',
  UNINSTALL_EXTENSION: 'extension:uninstall',
  EXTENSIONS_CHANGED: 'extension:changed',
};
```

### Window Configuration

The extension window is created with minimal features:

```typescript
createSpecialWindow(
  windowName,
  {
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    title: 'Extensions',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  },
  {
    menu: true,
    devTools: true,
    contentSecurityPolicy: true,
    externalLinkHandler: true,
    errorHandlers: true,
  },
  metadata,
);
```

## User Preferences

The extensions directory can be customized via user preferences:

```typescript
interface UserPreferences {
  // ...
  extensionsDirectory?: string; // Default: ~/.principal/extensions
}
```

## Extension Package Requirements

For a package to be discovered as a panel extension:

1. **package.json** must include:
   - `"keywords": ["panel-extension"]`
   - `"main": "dist/panels.bundle.js"` (or similar)

2. **Bundle** must export:
   - `panels` array with panel definitions

Example package.json:
```json
{
  "name": "@publisher/my-panels",
  "version": "1.0.0",
  "keywords": ["panel-extension"],
  "main": "dist/panels.bundle.js",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

Example bundle export:
```typescript
export const panels = [
  {
    id: 'publisher.panel-one',
    name: 'Panel One',
    icon: '📊',
    description: 'A custom panel',
    component: PanelOneComponent,
  },
];
```

## Opening the Extension Window

The extension window can be opened via IPC:

```typescript
// From renderer process
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';

await ipcRenderer.invoke(WindowEvent.OPEN_EXTENSION_WINDOW, {
  panelId: 'optional-panel-to-preselect',
});
```

## Data Flow

1. **Startup**
   - `ExtensionDiscoveryService.initialize()` is called during app initialization
   - Service loads registry and cache from disk
   - Custom extensions directory is loaded from user preferences

2. **Opening Window**
   - `registerExtensionWindowHandlers()` handles `OPEN_EXTENSION_WINDOW` IPC
   - Creates window with `preload-extension-window.ts`
   - Loads `extension-window.html`

3. **Loading Extensions**
   - `ExtensionWindowApp` calls `discoverExtensions()` on mount
   - Service scans directory, validates packages, returns metadata
   - UI renders list and details

4. **Enabling/Disabling**
   - User toggles switch in UI
   - `enableExtension()` or `disableExtension()` called
   - Registry updated, `EXTENSIONS_CHANGED` event broadcast
   - All windows receive updated extension list

5. **Uninstalling**
   - User clicks uninstall button
   - Confirmation dialog shown
   - Package directory deleted
   - Registry and cache updated
   - `EXTENSIONS_CHANGED` event broadcast

## Future Enhancements

- **Panel Viewer**: Render selected panel within the extension window
- **Install from NPM**: Allow installing extensions directly from npm registry
- **Extension Settings**: Per-extension configuration UI
- **Update Checking**: Check for newer versions of installed extensions
- **Extension Marketplace**: Browse and discover new extensions

## Related Documentation

- [Panel Extension System Design](./PANEL_EXTENSION_SYSTEM.md)
- [Panel Extension Store Specification](/Users/griever/Developer/new-panels/panel-framework/PANEL_EXTENSION_STORE_SPECIFICATION.md)
- [Web Panel System Implementation Roadmap](/Users/griever/Developer/new-panels/panel-framework/WEB_PANEL_SYSTEM_IMPLEMENTATION_ROADMAP.md)

---

*Last Updated: November 2025*
