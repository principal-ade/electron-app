# Code City Event Highlight Integration

## Overview

This document describes the work needed to integrate agent event highlighting into the Code City panel in the dev-workspace and alexandria-workspace windows. This functionality was previously available in the repo-manager but needs to be migrated to work with the new `@industry-theme/code-city-panel` npm package.

## Current State

The Code City panel (`@industry-theme/code-city-panel@0.1.6`) has been integrated into:
- **Dev Workspace** (`DevWorkspacePanelFramework.tsx`) - as the default right panel
- **Alexandria Workspace** (`AlexandriaWorkspaceLayout.tsx`) - as an available panel option

The panel currently supports:
- File tree visualization from `FileTree` slice
- File type color-based highlighting (built into the panel)
- Click-to-open file functionality

## Missing Functionality: Agent Event Highlights

The repo-manager had the ability to show real-time agent activity on the Code City visualization:
- Highlight files being read (blue)
- Highlight files being written/edited (green/amber)
- Highlight files being searched (purple)
- Navigate through event history

### Existing Services (Still in Codebase)

#### 1. EventHighlightService (`src/renderer/repo-manager/services/EventHighlightService.ts`)

Converts agent events into Code City highlight layers:

```typescript
export class EventHighlightService extends EventEmitter {
  // Set repository context
  setRepository(repositoryRoot: string): void;

  // Process incoming agent event and create highlight layer
  processEvent(event: RepoNormalizedUniversalAgentSessionEvent): void;

  // Navigation through event history
  navigatePrevious(): void;
  navigateNext(): void;
  goLive(): void;

  // Get current highlight layers
  getCurrentHighlightLayers(): HighlightLayer[];

  // Events emitted
  // - 'highlight-update': HighlightLayer[] - when layers change
  // - 'event-selected': (event, index) - when navigating history
  // - 'repository-changed': string - when repo context changes
}
```

**Color Scheme:**
| Operation | Color | Hex |
|-----------|-------|-----|
| READ | Blue | `#3b82f6` |
| WRITE | Green | `#22c55e` |
| CREATE | Emerald | `#10b981` |
| EDIT | Amber | `#f59e0b` |
| DELETE | Red | `#ef4444` |
| SEARCH | Purple | `#8b5cf6` |
| LIST | Indigo | `#6366f1` |

#### 2. HighlightLayersContext (`src/renderer/contexts/HighlightLayersContext.tsx`)

React context for managing highlight layers across components:

```typescript
interface HighlightLayersContextValue {
  getAllLayers: () => HighlightLayer[];
  registerLayer: (id: string, layer: Omit<HighlightLayer, 'id'>) => void;
  unregisterLayer: (id: string) => void;
  setLayerEnabled: (id: string, enabled: boolean) => void;
  getLayer: (id: string) => HighlightLayer | undefined;
}
```

## Integration Plan

### Option A: Extend the Panel Package

Add highlight layer support directly to `@industry-theme/code-city-panel`:

1. **Add `highlightLayers` prop to CodeCityPanel**
   ```typescript
   interface CodeCityPanelProps extends PanelComponentProps {
     highlightLayers?: HighlightLayer[];
   }
   ```

2. **Accept layers via panel context**
   - Add a new slice type `agentEventLayers` that the panel can consume
   - Or extend the panel to accept layers via `events.on('highlight:update', ...)`

3. **Publish updated package**

### Option B: Create a Wrapper Component

Create a wrapper in the electron-app that:
1. Wraps the CodeCityPanel
2. Connects to agent event streams
3. Uses EventHighlightService to process events
4. Passes highlight layers to the panel

```typescript
// Example: CodeCityPanelWithEvents.tsx
export const CodeCityPanelWithEvents: React.FC<PanelComponentProps> = (props) => {
  const [highlightLayers, setHighlightLayers] = useState<HighlightLayer[]>([]);
  const eventServiceRef = useRef(new EventHighlightService());

  // Subscribe to agent events
  useEffect(() => {
    const service = eventServiceRef.current;
    service.setRepository(props.context.currentScope.repository?.path);

    service.on('highlight-update', setHighlightLayers);

    // Subscribe to agent events from context/events
    const unsub = props.events.on('agent:event', (e) => {
      service.processEvent(e.payload);
    });

    return () => {
      unsub();
      service.removeAllListeners();
    };
  }, [props.context.currentScope.repository?.path, props.events]);

  return (
    <CodeCityPanel
      {...props}
      highlightLayers={highlightLayers}
    />
  );
};
```

### Option C: Use Panel Framework Events

Leverage the panel framework's event system:

1. **Create an AgentEventHighlightProvider** that:
   - Listens to agent events from the main process
   - Uses EventHighlightService to process them
   - Emits `highlight:layers-updated` events

2. **Update CodeCityPanel** to:
   - Listen for `highlight:layers-updated` events via `events.on()`
   - Merge received layers with built-in file color layers

## Required Work

### Phase 1: Panel Package Update
- [ ] Add `highlightLayers` prop support to `@industry-theme/code-city-panel`
- [ ] Update `ArchitectureMapHighlightLayers` to accept external layers
- [ ] Publish new version of the panel package

### Phase 2: Event Integration in Electron App
- [ ] Create `useAgentEventHighlights` hook that:
  - Subscribes to agent events from IPC
  - Uses EventHighlightService to create layers
  - Returns current highlight layers
- [ ] Integrate hook in DevWorkspacePanelFramework
- [ ] Integrate hook in AlexandriaWorkspaceLayout

### Phase 3: UI Controls
- [ ] Add event navigation controls (prev/next/live)
- [ ] Add event history panel or timeline
- [ ] Add layer visibility toggles

## Agent Event Source

Agent events flow from:
1. Claude Code / AI agents running in terminal
2. Captured by agent monitoring in main process
3. Sent to renderer via IPC
4. Processed by EventHighlightService
5. Converted to HighlightLayers
6. Displayed on Code City visualization

The existing `@principal-ai/agent-monitoring` package provides the event types:
```typescript
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
```

## Files to Reference

- `src/renderer/repo-manager/services/EventHighlightService.ts` - Event to layer conversion
- `src/renderer/contexts/HighlightLayersContext.tsx` - Layer management context
- `src/renderer/contexts/GitChangesContext.tsx` - Example of git-based highlighting (search for "city" references)
- `@principal-ai/code-city-react` - The underlying visualization component
