# Quick Start: Creating a New Panel

This guide shows how to implement a new panel using the existing architecture.

## Architecture Layers

```
┌─────────────────────────┐
│  Panel Component (React) │  <- User sees this
├─────────────────────────┤
│  RepositoryPanelContext │  <- Data source
├─────────────────────────┤
│  IPC Services           │  <- Main process bridge
├─────────────────────────┤
│  Main Process Handler   │  <- System access
└─────────────────────────┘
```

## 3-Step Implementation (Simple Panel)

### 1. Define in Panel Catalog
**File**: `src/shared/panels/repositoryPanelCatalog.ts`

```typescript
{
  id: 'myNewPanel',
  label: 'My New Panel',
  description: 'What this panel does.',
  surfaces: ['manager'] as const,  // Where it appears
}
```

### 2. Create React Component
**File**: `src/renderer/panels/components/MyNewPanel.tsx`

```typescript
import React from 'react';
import { useTheme } from '@a24z/industry-theme';

export const MyNewPanel: React.FC = () => {
  const { theme } = useTheme();
  
  return (
    <div style={{ padding: '16px' }}>
      My Panel Content
    </div>
  );
};
```

### 3. Register in Registry
**File**: `src/renderer/panels/registry.tsx`

```typescript
import { MyNewPanel } from './components/MyNewPanel';

const panelRenderers = {
  // ...existing panels
  myNewPanel: () => <MyNewPanel />,
};
```

Done! The panel will now appear in the UI.

## 6-Step Implementation (Data-Heavy Panel)

If your panel needs data from the main process:

### 1. Define Panel in Catalog
Add to `src/shared/panels/repositoryPanelCatalog.ts`

### 2. Create IPC Interface
**File**: `src/shared/main-process-api-interfaces/MyPanelAPI.ts`

```typescript
export enum MyPanelAPIEvents {
  GET_DATA = 'myPanel:getData',
  ON_UPDATE = 'myPanel:updated',
}

export interface MyPanelAPI {
  getData: () => Promise<MyPanelData[]>;
  onUpdate: (callback: (data: MyPanelData[]) => void) => () => void;
}
```

### 3. Create Renderer Service
**File**: `src/renderer/main-process-api/MyPanelService.ts`

```typescript
export class MyPanelService {
  static async getData(): Promise<MyPanelData[]> {
    return window.mainProcess.myPanel.getData();
  }

  static onUpdate(callback: (data: MyPanelData[]) => void): () => void {
    return window.mainProcess.myPanel.onUpdate(callback);
  }
}
```

### 4. Create IPC Implementation
**File**: `src/window/main-process-api-implementations/myPanelApi.ts`

```typescript
import { ipcRenderer } from 'electron';
import { MyPanelAPIEvents, MyPanelAPI } from '../../shared/main-process-api-interfaces/MyPanelAPI';

export const myPanelAPI: MyPanelAPI = {
  getData: async () => {
    return ipcRenderer.invoke(MyPanelAPIEvents.GET_DATA);
  },

  onUpdate: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(MyPanelAPIEvents.ON_UPDATE, listener);
    return () => ipcRenderer.removeListener(MyPanelAPIEvents.ON_UPDATE, listener);
  },
};
```

### 5. Implement Main Process Handler
**File**: `src/main/myPanelHandler.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { MyPanelAPIEvents } from '../shared/main-process-api-interfaces/MyPanelAPI';

class MyPanelHandler {
  private rendererWindows: Set<BrowserWindow> = new Set();

  constructor() {
    this.setupIPCHandlers();
  }

  private setupIPCHandlers() {
    ipcMain.handle(MyPanelAPIEvents.GET_DATA, async () => this.getData());
  }

  private async getData(): Promise<MyPanelData[]> {
    // Fetch data from system, database, etc.
    return [];
  }

  setMainWindow(window: BrowserWindow) {
    this.rendererWindows.add(window);
  }

  private broadcast(channel: string, data: any) {
    for (const window of this.rendererWindows) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    }
  }
}

export const myPanelHandler = new MyPanelHandler();
```

### 6. Create Panel Component
**File**: `src/renderer/panels/components/MyPanel.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { MyPanelService } from '../../main-process-api/MyPanelService';

export const MyPanel: React.FC = () => {
  const { theme } = useTheme();
  const [data, setData] = useState<MyPanelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await MyPanelService.getData();
        setData(result);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to updates
    const unsubscribe = MyPanelService.onUpdate((updated) => {
      setData(updated);
    });

    return unsubscribe;
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '16px' }}>
      {data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
};
```

## Common Patterns

### Using Repository Context
```typescript
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';

export const MyPanel: React.FC = () => {
  const {
    repositoryPath,      // Current repository path
    gitStatus,           // Git changes
    fileTree,            // File structure
    loading,             // Loading state
    refresh,             // Refresh function
  } = useRepositoryPanelContext();

  return <div>{repositoryPath}</div>;
};
```

### Opening External URLs
```typescript
import { ShellService } from '../../main-process-api/ShellService';

const handleOpenUrl = async (url: string) => {
  const result = await ShellService.openExternal(url);
  if (!result.success) {
    console.error(result.error);
  }
};
```

### Running Shell Commands
```typescript
const result = await ShellService.runCommand('npm run build', {
  cwd: repositoryPath,
  timeout: 30000,
});

if (result.success) {
  console.log(result.output);
} else {
  console.error(result.stderr);
}
```

### Handling Multiple Items (Like Terminals)
See: `src/renderer/panels/components/TabbedTerminalPanel.tsx`

Key pattern:
```typescript
const [items, setItems] = useState<Item[]>([]);
const [activeItemId, setActiveItemId] = useState<string | null>(null);

// Render only active item for performance
{items.map(item => (
  <div
    key={item.id}
    style={{ display: activeItemId === item.id ? 'flex' : 'none' }}
  >
    <ItemComponent item={item} isActive={activeItemId === item.id} />
  </div>
))}
```

## Testing Your Panel

1. Add to catalog
2. Restart dev server
3. Panel should appear in the UI menu
4. Click to show/hide

## Debugging

Enable logging in components:
```typescript
useEffect(() => {
  console.log('[MyPanel] Mounted with data:', data);
}, [data]);
```

Check IPC in DevTools:
```javascript
window.mainProcess.myPanel.getData().then(d => console.log(d));
```

## File Structure Checklist

```
src/
├── shared/
│   ├── panels/
│   │   └── repositoryPanelCatalog.ts      [STEP 1]
│   └── main-process-api-interfaces/
│       └── MyPanelAPI.ts                   [STEP 2]
├── renderer/
│   ├── main-process-api/
│   │   └── MyPanelService.ts              [STEP 3]
│   └── panels/
│       ├── registry.tsx                    [UPDATE]
│       └── components/
│           └── MyPanel.tsx                 [STEP 6]
└── window/
    └── main-process-api-implementations/
        └── myPanelApi.ts                   [STEP 4]

src/main/
└── myPanelHandler.ts                       [STEP 5]
```

## Real Examples to Reference

- **Simple panel**: `src/renderer/panels/components/FileTreePanelContent.tsx`
- **Context-based**: `src/renderer/panels/components/GitChangesPanel.tsx`
- **Data-heavy**: `src/renderer/panels/components/GitHubProjectsPanel.tsx`
- **Terminal-like**: `src/renderer/panels/components/TabbedTerminalPanel.tsx`
- **IPC intensive**: `src/main/terminal.ts` + `src/renderer/panels/TerminalPanelPackaged.tsx`

## Architecture Files

- Panel types: `/Users/griever/Developer/electron-app/src/shared/panels/repositoryPanelCatalog.ts`
- Registry: `/Users/griever/Developer/electron-app/src/renderer/panels/registry.tsx`
- Context: `/Users/griever/Developer/electron-app/src/renderer/panels/RepositoryPanelProvider.tsx`
- Terminal example: `/Users/griever/Developer/electron-app/src/main/terminal.ts`

## Next Steps

1. Choose a simple panel to start (don't need IPC if just displaying static content)
2. Add panel definition to catalog
3. Create React component
4. Register in panel registry
5. Test in UI
6. If you need data, add IPC layer following the 6-step pattern

Good luck!
