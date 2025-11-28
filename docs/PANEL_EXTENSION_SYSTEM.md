# Panel Extension System Design

## Executive Summary

This document outlines the architecture for the panel extension system that enables third-party panel extensions to be dynamically loaded and displayed in the application. The system uses `@principal-ade/panel-framework-core` as the foundation and supports panels distributed via NPM with the `panel-extension` keyword.

---

## Table of Contents

1. [Current Implementation Status](#current-implementation-status)
2. [Architecture Overview](#architecture-overview)
3. [Panel Framework Core](#panel-framework-core)
4. [Extension Discovery](#extension-discovery)
5. [Extension Window](#extension-window)
6. [Extension API Contract](#extension-api-contract)
7. [Developer Guide](#developer-guide)
8. [Security Considerations](#security-considerations)

---

## Current Implementation Status

### Completed Components

✅ **Panel Framework Core** (`@principal-ade/panel-framework-core`)
- `PanelHarness` - Context provider for panels
- `PanelWrapper` - Error boundary and lifecycle wrapper
- `PanelEventBus` - Inter-panel communication
- `PanelRegistry` - Panel registration and lazy loading
- Core types: `PanelComponentProps`, `PanelContextValue`, `PanelDefinition`, etc.

✅ **Panel Extension Store Specification**
- NPM-based distribution model
- Multi-panel packages support
- `panels` array export format
- Lifecycle hooks (`onMount`, `onUnmount`, `onPackageLoad`, `onPackageUnload`)

✅ **DevWorkspace Integration**
- Panel framework layout in DevWorkspace window
- `RepositoryPanelContext` for repository-scoped panels
- Terminal and Visual Validation panels

### In Progress

🔄 **Extension Window** - New window to list and launch panel extensions

### Planned

📋 Extension discovery from `node_modules`
📋 Dynamic panel loading at runtime
📋 Extension management UI (enable/disable/configure)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Extension Window                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Extension List                                                  ││
│  │  - Lists discovered panel extensions                            ││
│  │  - Shows metadata (name, version, author, description)          ││
│  │  - Open panel action                                            ││
│  └─────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Panel Viewer                                                    ││
│  │  - Renders selected panel with PanelHarness                     ││
│  │  - Provides context, actions, and events                        ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  @principal-ade/panel-framework-core                                 │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐              │
│  │ PanelHarness  │ │ PanelRegistry │ │ PanelEventBus │              │
│  └───────────────┘ └───────────────┘ └───────────────┘              │
│  ┌───────────────┐ ┌───────────────┐                                │
│  │ PanelWrapper  │ │ Types/Utils   │                                │
│  └───────────────┘ └───────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Extension Discovery (Main Process)                                  │
│  - Scans node_modules for `panel-extension` keyword                 │
│  - Validates manifest and panel definitions                         │
│  - Provides list to renderer via IPC                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  NPM Packages (node_modules)                                         │
│  @industry-theme/visual-validation-panel                            │
│  @industry-theme/terminal-panel                                      │
│  @industry-theme/ghostty-terminal-panel                             │
│  @my-publisher/custom-panels                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Panel Framework Core

### Location
`/Users/griever/Developer/new-panels/panel-framework`

Published as: `@principal-ade/panel-framework-core`

### Key Exports

```typescript
// Components
export { PanelHarness, usePanelContext, usePanelActions, usePanelEvents } from './components/PanelHarness';
export { PanelWrapper } from './components/PanelWrapper';

// Events
export { PanelEventBus } from './events/PanelEventBus';

// Registry
export { PanelRegistry, globalPanelRegistry } from './utils/panelRegistry';

// Types
export type {
  PanelComponentProps,
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  PanelEvent,
  PanelEventType,
  PanelMetadata,
  PanelDefinition,
  PanelModule,
  PanelRegistryEntry,
  PanelLifecycleHooks,
  DataSlice,
  WorkspaceMetadata,
  RepositoryMetadata,
} from './types';
```

### PanelComponentProps

All panel components receive these props:

```typescript
interface PanelComponentProps {
  /** Access to shared data and state */
  context: PanelContextValue;

  /** Actions for interpanel communication */
  actions: PanelActions;

  /** Event system for panel-to-panel communication */
  events: PanelEventEmitter;
}
```

### PanelContextValue

```typescript
interface PanelContextValue {
  // Current scope information
  currentScope: {
    type: 'workspace' | 'repository';
    workspace?: WorkspaceMetadata;
    repository?: RepositoryMetadata;
  };

  // Dynamic data slice access
  slices: ReadonlyMap<string, DataSlice>;

  // Generic slice accessors
  getSlice<T = unknown>(name: string): DataSlice<T> | undefined;
  getWorkspaceSlice<T = unknown>(name: string): DataSlice<T> | undefined;
  getRepositorySlice<T = unknown>(name: string): DataSlice<T> | undefined;

  // Utility methods
  hasSlice(name: string, scope?: 'workspace' | 'repository'): boolean;
  isSliceLoading(name: string, scope?: 'workspace' | 'repository'): boolean;

  // Global refresh
  refresh(scope?: 'workspace' | 'repository', slice?: string): Promise<void>;
}
```

---

## Extension Discovery

### Discovery Mechanism

Extensions are discovered by scanning `node_modules` for packages with the `panel-extension` keyword in their `package.json`:

```json
{
  "name": "@my-publisher/awesome-panels",
  "version": "1.0.0",
  "keywords": ["panel-extension"],
  "main": "dist/panels.bundle.js",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

### Required Export Structure

Panel packages must export a `panels` array:

```typescript
// dist/panels.bundle.js
export const panels = [
  {
    id: 'my-publisher.panel-one',
    name: 'Panel One',
    icon: '📊',
    version: '1.0.0',
    description: 'First panel in the package',
    component: PanelOneComponent,
    onMount: async (context) => { /* lifecycle hook */ },
    onUnmount: async (context) => { /* lifecycle hook */ },
  },
  {
    id: 'my-publisher.panel-two',
    name: 'Panel Two',
    icon: '📈',
    version: '1.0.0',
    description: 'Second panel in the package',
    component: PanelTwoComponent,
  },
];

// Optional package-level hooks
export const onPackageLoad = async () => { /* called once when package loads */ };
export const onPackageUnload = async () => { /* called when package unloads */ };
```

### IPC Interface

```typescript
// Main Process API
interface PanelExtensionAPI {
  // Discover all installed panel extensions
  discoverExtensions(): Promise<DiscoveredExtension[]>;

  // Load a specific extension package
  loadExtension(packageName: string): Promise<LoadedExtension>;

  // Get extension bundle path for dynamic import
  getExtensionBundlePath(packageName: string): Promise<string>;
}

interface DiscoveredExtension {
  packageName: string;
  packagePath: string;
  bundlePath: string;
  panels: PanelMetadata[];
  packageVersion: string;
  packageAuthor?: string;
}
```

---

## Extension Window

### Purpose

A dedicated window for browsing and launching panel extensions. This window:
1. Lists all discovered panel extensions
2. Shows panel metadata (name, description, author, version)
3. Allows opening individual panels in a viewer
4. Provides context for panels (repository, workspace, or standalone)

### File Structure

```
src/renderer/extension-window/
├── index.tsx                          # Entry point
├── ExtensionWindowApp.tsx             # Main app component
├── ExtensionWindowTitlebar.tsx        # Window titlebar
├── components/
│   ├── ExtensionList.tsx              # List of discovered extensions
│   ├── ExtensionCard.tsx              # Individual extension display
│   ├── PanelViewer.tsx                # Renders selected panel
│   └── ContextSelector.tsx            # Choose repository/workspace context
└── services/
    └── ExtensionDiscoveryService.ts   # IPC wrapper for extension discovery
```

### Window Data

```typescript
interface ExtensionWindowData {
  // Optional: pre-select a specific repository context
  repositoryPath?: string;
  repositoryName?: string;

  // Optional: pre-select a specific panel to display
  panelId?: string;
}
```

### Layout Options

**Option A: Split Layout**
```
┌────────────────────────────────────────────────────────┐
│  Titlebar                                              │
├────────────────┬───────────────────────────────────────┤
│ Extension List │  Panel Viewer                         │
│ ┌────────────┐ │  ┌─────────────────────────────────┐  │
│ │ Panel A    │ │  │                                 │  │
│ │ Panel B  ● │ │  │    Selected Panel Renders       │  │
│ │ Panel C    │ │  │          Here                   │  │
│ │ Panel D    │ │  │                                 │  │
│ └────────────┘ │  └─────────────────────────────────┘  │
└────────────────┴───────────────────────────────────────┘
```

**Option B: Full Panel with Dropdown**
```
┌────────────────────────────────────────────────────────┐
│  Titlebar  [ Extension: Panel Name ▼ ] [ Context ▼ ]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│               Selected Panel Renders                   │
│                     Full Screen                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Extension API Contract

### Panel Definition Interface

```typescript
interface PanelDefinition {
  // Required
  id: string;           // Unique identifier (e.g., 'publisher.panel-name')
  name: string;         // Display name
  component: React.ComponentType<PanelComponentProps>;

  // Optional metadata
  icon?: string;        // Emoji or icon URL
  version?: string;     // Semantic version
  author?: string;      // Author name or organization
  description?: string; // Short description
  surfaces?: string[];  // Where panel can be displayed
  slices?: string[];    // Data dependencies

  // Optional lifecycle hooks
  onMount?: (context: PanelContextValue) => void | Promise<void>;
  onUnmount?: (context: PanelContextValue) => void | Promise<void>;
}
```

### Panel Component Example

```typescript
import React, { useEffect } from 'react';
import type { PanelComponentProps } from '@principal-ade/panel-framework-core';

export const MyPanel: React.FC<PanelComponentProps> = ({
  context,
  actions,
  events
}) => {
  // Access repository data
  const gitSlice = context.getRepositorySlice('git');

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = events.on('file:opened', (event) => {
      console.log('File opened:', event.payload);
    });
    return unsubscribe;
  }, [events]);

  // Use actions
  const handleOpenFile = (path: string) => {
    actions.openFile?.(path);
  };

  if (gitSlice?.loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>My Panel</h2>
      <p>Repository: {context.currentScope.repository?.name}</p>
      {/* Panel content */}
    </div>
  );
};
```

---

## Developer Guide

### Creating a Panel Extension Package

1. **Initialize package**
   ```bash
   mkdir my-panels && cd my-panels
   npm init -y
   ```

2. **Configure package.json**
   ```json
   {
     "name": "@my-publisher/my-panels",
     "version": "1.0.0",
     "main": "dist/panels.bundle.js",
     "keywords": ["panel-extension"],
     "peerDependencies": {
       "react": "^18.0.0",
       "react-dom": "^18.0.0"
     },
     "devDependencies": {
       "@principal-ade/panel-framework-core": "^1.0.0",
       "typescript": "^5.0.0",
       "vite": "^5.0.0"
     }
   }
   ```

3. **Create panel component**
   ```typescript
   // src/MyPanel.tsx
   import type { PanelComponentProps } from '@principal-ade/panel-framework-core';

   export const MyPanel: React.FC<PanelComponentProps> = ({ context }) => {
     return <div>Hello from My Panel!</div>;
   };
   ```

4. **Create entry point**
   ```typescript
   // src/index.tsx
   import { MyPanel } from './MyPanel';

   export const panels = [
     {
       id: 'my-publisher.my-panel',
       name: 'My Panel',
       icon: '🎨',
       description: 'A custom panel',
       component: MyPanel,
     },
   ];
   ```

5. **Configure Vite build**
   ```typescript
   // vite.config.ts
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     build: {
       lib: {
         entry: './src/index.tsx',
         fileName: 'panels.bundle',
         formats: ['es'],
       },
       rollupOptions: {
         external: ['react', 'react-dom'],
       },
     },
   });
   ```

6. **Build and publish**
   ```bash
   npm run build
   npm publish
   ```

### Testing Locally

1. Build your extension package
2. Use `npm link` to symlink to the desktop app
3. Open the Extensions Window
4. Your panels should appear in the list

---

## Security Considerations

### Execution Model

Panel extensions run in the same process as the main application with full Node.js access. This is intentional for maximum capability but requires trust.

### Recommendations

1. **Trusted Sources Only**: Only install extensions from trusted publishers
2. **Code Review**: Review extension source code before installation
3. **Version Pinning**: Pin extension versions in package.json
4. **Minimal Permissions**: Extensions should request only needed capabilities

### Future Enhancements

- Extension signature verification
- Permission system for sensitive operations
- Sandboxed execution option for untrusted extensions

---

## Related Documentation

- [Panel Extension Store Specification](/Users/griever/Developer/new-panels/panel-framework/PANEL_EXTENSION_STORE_SPECIFICATION.md)
- [Web Panel System Implementation Roadmap](/Users/griever/Developer/new-panels/panel-framework/WEB_PANEL_SYSTEM_IMPLEMENTATION_ROADMAP.md)
- [Panel Framework Core README](/Users/griever/Developer/new-panels/panel-framework/README.md)

---

*Document Version: 2.0*
*Last Updated: November 2025*
*Status: Active Development*
