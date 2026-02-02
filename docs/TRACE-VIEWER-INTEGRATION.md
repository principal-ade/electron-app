# OpenTelemetry Trace Viewer Integration for Dev Workspace Window

## Overview

This document describes how to integrate the OpenTelemetry trace viewer components from `@industry-theme/principal-view-panels` into the dev workspace window.

**Integration Pattern:**
- **TraceListPanel** in left sidebar (persistent)
- **TraceDetailsPanel** opens as a custom tab when trace is selected

**Package**: `@industry-theme/principal-view-panels@0.9.0`
**Added**: 2026-02-01 (commit c173129)

---

## Available Components

### Panel Components

| Component | Purpose | Location | Usage in Dev Workspace |
|-----------|---------|----------|------------------------|
| **TraceListPanel** | List of traces with search/filter | `src/panels/TraceListPanel.tsx` | Left sidebar panel |
| **TraceDetailsPanel** | Detailed span tree and attributes | `src/panels/TraceDetailsPanel.tsx` | Opens as custom tab |

### Type Definitions

**File**: `src/types/otel.ts` (219 lines)

Key types:
- `OtelResourceSpans` - Top-level OTLP/JSON structure
- `OtelSpan` - Individual span with trace/span IDs, timestamps, attributes, events
- `OtelAttribute` - Key-value attributes
- `TraceInfo` - Aggregated trace representation (what panels consume)
- Helper functions: `getAttributeValue()`, `parseNanoTime()`, `getSpanDuration()`, `groupSpansByTrace()`

### Mock Data Generators

**File**: `src/mocks/otelMocks.ts` (421 lines)

For development and testing:
- `createMockSpan()`, `createMockClickSpan()`, `createMockAPISpan()`, `createMockDBSpan()`
- `generateCheckoutTrace()`, `generateAuthErrorTrace()`, `generateComplexTrace()`
- `generateRandomTraces(count)` - Bulk data for testing

---

## Integration Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Main Process                                                 │
│                                                              │
│  ┌──────────────┐      ┌───────────────────┐               │
│  │ OTEL         │─────▶│ Telemetry         │               │
│  │ Collector    │      │ Forwarder         │               │
│  └──────────────┘      └────────┬──────────┘               │
│                                  │                           │
└──────────────────────────────────┼───────────────────────────┘
                                   │ IPC/MessagePort
                                   │
┌──────────────────────────────────▼───────────────────────────┐
│ Renderer: Dev Workspace Window                               │
│                                                               │
│  ┌─────────────────┐                                         │
│  │ Left Sidebar    │         ┌──────────────────────────┐   │
│  │                 │         │ Tab Area                 │   │
│  │ ┌─────────────┐ │         │                          │   │
│  │ │ TraceList   │ │         │  ┌────────────────────┐ │   │
│  │ │ Panel       │ │ Select  │  │ TraceDetailsPanel  │ │   │
│  │ │             │ ├────────▶│  │ (as custom tab)    │ │   │
│  │ │ • Search    │ │ Trace   │  │                    │ │   │
│  │ │ • Filter    │ │         │  │ • Span tree        │ │   │
│  │ │ • List      │ │         │  │ • Attributes       │ │   │
│  │ └─────────────┘ │         │  │ • Events           │ │   │
│  │                 │         │  └────────────────────┘ │   │
│  └─────────────────┘         └──────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Event Communication

```typescript
// 1. User clicks a trace in TraceListPanel (left sidebar)
// TraceListPanel emits selection event
events.emit({
  type: 'custom',
  source: 'trace-list-panel',
  timestamp: Date.now(),
  payload: {
    action: 'selectTrace',
    trace: TraceInfo  // Complete trace with spans
  }
});

// 2. Dev workspace tab manager listens
tabManager.on('custom', (event) => {
  if (event.payload?.action === 'selectTrace') {
    // Open trace details as a new tab
    openTraceDetailsTab(event.payload.trace);
  }
});

// 3. Tab renders TraceDetailsPanel with selectedTrace prop
<TraceDetailsPanel
  context={context}
  actions={actions}
  events={events}
  selectedTrace={trace}
/>
```

---

## Implementation Steps

### Step 1: Add TraceListPanel to Left Sidebar

Add the trace list panel to your left sidebar configuration:

```typescript
// src/renderer/dev-workspace/sidebar/SidebarConfig.ts (or similar)

import { TraceListPanel } from '@industry-theme/principal-view-panels';

export interface SidebarPanel {
  id: string;
  title: string;
  icon: LucideIcon;
  component: React.ComponentType<PanelComponentProps>;
}

export const SIDEBAR_PANELS: SidebarPanel[] = [
  // ... existing panels (file tree, git, etc.)
  {
    id: 'traces',
    title: 'Traces',
    icon: Activity,  // or Network, Radio, etc. from lucide-react
    component: TraceListPanel,
  },
];
```

### Step 2: Render Sidebar Panel

In your sidebar renderer:

```typescript
// src/renderer/dev-workspace/sidebar/Sidebar.tsx

import { useState } from 'react';
import { SIDEBAR_PANELS } from './SidebarConfig';

export const Sidebar: React.FC<{ context, actions, events }> = ({
  context,
  actions,
  events,
}) => {
  const [activePanel, setActivePanel] = useState('files');

  const ActivePanelComponent = SIDEBAR_PANELS.find(
    p => p.id === activePanel
  )?.component;

  return (
    <div className="flex h-full">
      {/* Tab buttons */}
      <div className="w-12 border-r flex flex-col">
        {SIDEBAR_PANELS.map(panel => (
          <button
            key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            className={cn(
              'p-3 hover:bg-accent',
              activePanel === panel.id && 'bg-accent'
            )}
          >
            <panel.icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1">
        {ActivePanelComponent && (
          <ActivePanelComponent
            context={context}
            actions={actions}
            events={events}
          />
        )}
      </div>
    </div>
  );
};
```

### Step 3: Listen for Trace Selection Events

In your tab manager or workspace container:

```typescript
// src/renderer/dev-workspace/WorkspaceContainer.tsx

import { useEffect } from 'react';
import type { TraceInfo } from '@industry-theme/principal-view-panels';

export const WorkspaceContainer: React.FC<{ context, actions, events }> = ({
  context,
  actions,
  events,
}) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Listen for trace selection events
  useEffect(() => {
    if (!events) return;

    const unsubscribe = events.on('custom', (event) => {
      if (
        event.source === 'trace-list-panel' &&
        event.payload?.action === 'selectTrace'
      ) {
        const trace = event.payload.trace as TraceInfo;
        openTraceDetailsTab(trace);
      }
    });

    return unsubscribe;
  }, [events]);

  const openTraceDetailsTab = (trace: TraceInfo) => {
    const tabId = `trace-${trace.traceId}`;

    // Check if tab already exists
    const existingTab = tabs.find(t => t.id === tabId);
    if (existingTab) {
      setActiveTabId(tabId);
      return;
    }

    // Create new tab
    const newTab: Tab = {
      id: tabId,
      type: 'trace-details',
      title: trace.rootSpanName || 'Trace Details',
      subtitle: `${trace.serviceName} • ${trace.spanCount} spans`,
      icon: Activity,
      closable: true,
      metadata: {
        trace,
      },
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
  };

  return (
    <div className="flex h-full">
      <Sidebar context={context} actions={actions} events={events} />
      <TabArea tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
    </div>
  );
};
```

### Step 4: Render TraceDetailsPanel in Custom Tab

Create a custom tab type for trace details:

```typescript
// src/renderer/dev-workspace/tabs/TabRenderer.tsx

import { TraceDetailsPanel } from '@industry-theme/principal-view-panels';
import type { TraceInfo } from '@industry-theme/principal-view-panels';

export interface Tab {
  id: string;
  type: 'file' | 'preview' | 'trace-details' | string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  closable: boolean;
  metadata?: any;
}

export const TabRenderer: React.FC<{
  tab: Tab;
  context: PanelContextValue;
  actions: PanelActions;
  events: PanelEventEmitter;
}> = ({ tab, context, actions, events }) => {
  switch (tab.type) {
    case 'file':
      return <FileEditor file={tab.metadata.file} />;

    case 'preview':
      return <PreviewPanel url={tab.metadata.url} />;

    case 'trace-details':
      return (
        <TraceDetailsPanel
          context={context}
          actions={actions}
          events={events}
          selectedTrace={tab.metadata.trace as TraceInfo}
        />
      );

    default:
      return <div>Unknown tab type: {tab.type}</div>;
  }
};
```

### Step 5: Tab Bar Integration

Update your tab bar to show trace tabs with appropriate icons:

```typescript
// src/renderer/dev-workspace/tabs/TabBar.tsx

import { Activity, X } from 'lucide-react';

export const TabBar: React.FC<{
  tabs: Tab[];
  activeTabId: string | null;
  onTabChange: (id: string) => void;
  onTabClose: (id: string) => void;
}> = ({ tabs, activeTabId, onTabChange, onTabClose }) => {
  return (
    <div className="flex border-b overflow-x-auto">
      {tabs.map(tab => {
        const Icon = tab.icon || Activity;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 border-r hover:bg-accent',
              activeTabId === tab.id && 'bg-accent border-b-2 border-primary'
            )}
          >
            <Icon className="w-4 h-4" />
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{tab.title}</span>
              {tab.subtitle && (
                <span className="text-xs text-muted-foreground">
                  {tab.subtitle}
                </span>
              )}
            </div>
            {tab.closable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="ml-2 hover:bg-destructive/10 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </button>
        );
      })}
    </div>
  );
};
```

---

## Providing Trace Data to TraceListPanel

The TraceListPanel needs access to trace data. Here are the recommended approaches:

### Option 1: Data Slice (Recommended)

Create a `telemetry` data slice that the panel can access via `context.getSlice('telemetry')`.

**In TraceListPanel** (currently uses mock data):

```typescript
// Current implementation (line 41-42):
const mockTraces = generateRandomTraces(20);

// Replace with:
const telemetrySlice = context.getSlice('telemetry');
const traces = (telemetrySlice?.data as TraceInfo[]) || [];
```

**Create TelemetryDataSliceProvider**:

```typescript
// src/main/telemetry/TelemetryDataSliceProvider.ts

import type { DataSliceProvider } from '@principal-ade/panel-framework-core';
import type { TraceInfo } from '@industry-theme/principal-view-panels';
import { groupSpansByTrace } from '@industry-theme/principal-view-panels';

export class TelemetryDataSliceProvider implements DataSliceProvider<TraceInfo[]> {
  private traces: TraceInfo[] = [];
  private sha: string = '';
  private listeners: Set<() => void> = new Set();
  private maxTraces = 1000;
  private maxAgeMs = 3600000; // 1 hour

  getName(): string {
    return 'telemetry';
  }

  getData(): TraceInfo[] {
    return this.traces;
  }

  getSha(): string {
    return this.sha;
  }

  async refresh(): Promise<void> {
    // Optionally fetch from database/API
    this.cleanupOldTraces();
    this.updateSha();
    this.notifyListeners();
  }

  addSpan(span: OtelSpan, resource: OtelResource): void {
    // Find or create trace
    const traceIndex = this.traces.findIndex(t => t.traceId === span.traceId);

    if (traceIndex >= 0) {
      // Add span to existing trace
      this.traces[traceIndex].spans.push(span);
      this.traces[traceIndex].spanCount += 1;
    } else {
      // Create new trace
      const newTraces = groupSpansByTrace([span], resource);
      this.traces.push(...newTraces);
    }

    this.cleanupOldTraces();
    this.updateSha();
    this.notifyListeners();
  }

  private cleanupOldTraces(): void {
    const now = Date.now();

    // Remove old traces
    this.traces = this.traces.filter(trace => {
      const age = now - parseNanoTime(trace.spans[0].startTimeUnixNano);
      return age < this.maxAgeMs;
    });

    // Limit total count
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }
  }

  private updateSha(): void {
    const crypto = require('crypto');
    this.sha = crypto
      .createHash('sha256')
      .update(JSON.stringify(this.traces.map(t => t.traceId)))
      .digest('hex')
      .substring(0, 16);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
```

**Register with Panel Framework**:

```typescript
// src/main/dev-workspace/DevWorkspaceWindowManager.ts

const telemetrySlice = new TelemetryDataSliceProvider();

const context = {
  currentScope: { type: 'repository', repository },
  slices: new Map([
    ['fileTree', fileTreeSlice],
    ['git', gitSlice],
    ['telemetry', telemetrySlice],  // Add telemetry slice
  ]),
  getSlice: (name: string) => context.slices.get(name),
  // ...
};
```

**Forward Spans to Data Slice**:

```typescript
// src/main/telemetry/TelemetryForwarder.ts

export class TelemetryForwarder {
  constructor(
    private windowManager: DevWorkspaceWindowManager,
    private telemetrySlice: TelemetryDataSliceProvider
  ) {}

  onSpanReceived(span: OtelSpan, resource: OtelResource): void {
    // Add to data slice (updates all subscribed panels)
    this.telemetrySlice.addSpan(span, resource);
  }
}
```

### Option 2: Event Stream

Alternative: Forward spans via panel events (TraceListPanel would need modification to listen):

```typescript
// In telemetry forwarder
function forwardSpan(span: OtelSpan, resource: OtelResource) {
  devWorkspaceWindow.webContents.send('panel:event', {
    type: 'telemetry:span',
    source: 'telemetry-provider',
    timestamp: Date.now(),
    payload: { span, resource },
  });
}

// TraceListPanel would need to listen and aggregate spans internally
// (requires panel modification - not currently implemented)
```

**Recommendation**: Use **Option 1 (Data Slice)** as it follows the existing panel framework patterns and requires no modification to TraceListPanel.

---

## Workflow Matching Integration

The trace viewer components automatically display workflow matching metadata when present in resource attributes:

### Adding Workflow Metadata to Spans

When instrumenting code or forwarding spans, include these attributes:

```typescript
const resourceAttributes = [
  { key: 'service.name', value: { stringValue: 'checkout-service' } },
  { key: 'pv.storyboard.id', value: { stringValue: 'checkout-flow' } },
  { key: 'pv.storyboard.name', value: { stringValue: 'Checkout Flow' } },
  { key: 'pv.workflow.id', value: { stringValue: 'complete-purchase' } },
  { key: 'pv.workflow.name', value: { stringValue: 'Complete Purchase' } },
  { key: 'pv.scenario.id', value: { stringValue: 'happy-path' } },
  { key: 'pv.scenario.name', value: { stringValue: 'Successful Purchase' } },
];
```

### Display in UI

These attributes will automatically appear as badges in:
- **TraceList**: Shows workflow name badge next to trace
- **TraceDetails**: Shows full storyboard/workflow/scenario in header

No additional code needed - the panels handle this automatically.

---

## Tab Metadata and State

### Tab Title and Subtitle

Customize tab titles to show relevant trace information:

```typescript
const newTab: Tab = {
  id: `trace-${trace.traceId}`,
  type: 'trace-details',
  title: trace.rootSpanName || 'Trace Details',
  subtitle: `${trace.serviceName} • ${trace.spanCount} spans • ${formatDuration(trace.duration)}`,
  icon: trace.hasError ? AlertCircle : Activity,
  closable: true,
  metadata: { trace },
};
```

### Persisting Tab State

If you want to persist open trace tabs across window reloads:

```typescript
// Save tab state
const saveTabState = (tabs: Tab[]) => {
  const traceTabIds = tabs
    .filter(t => t.type === 'trace-details')
    .map(t => t.metadata.trace.traceId);

  localStorage.setItem('openTraceTabIds', JSON.stringify(traceTabIds));
};

// Restore tabs on load
const restoreTraceTabs = async () => {
  const savedIds = JSON.parse(localStorage.getItem('openTraceTabIds') || '[]');

  for (const traceId of savedIds) {
    const trace = await fetchTraceById(traceId);
    if (trace) {
      openTraceDetailsTab(trace);
    }
  }
};
```

---

## Styling and Theme

Both components use `@principal-ade/industry-theme` for styling. Ensure your dev workspace has the theme provider:

```typescript
// src/renderer/dev-workspace/DevWorkspace.tsx

import { ThemeProvider } from '@principal-ade/industry-theme';

export const DevWorkspace: React.FC = () => {
  return (
    <ThemeProvider>
      <WorkspaceContainer />
    </ThemeProvider>
  );
};
```

### Custom Styling

If you need to customize the trace panels:

```typescript
// TraceListPanel in sidebar - constrain height
<div className="h-full overflow-hidden">
  <TraceListPanel
    context={context}
    actions={actions}
    events={events}
  />
</div>

// TraceDetailsPanel in tab - full height
<div className="h-full">
  <TraceDetailsPanel
    context={context}
    actions={actions}
    events={events}
    selectedTrace={selectedTrace}
  />
</div>
```

---

## Testing

### Development with Mock Data

The TraceListPanel currently uses mock data by default (line 41-42). For development:

```typescript
// Temporarily keep mock data for UI development
const mockTraces = generateRandomTraces(20);

// Or connect to data slice
const telemetrySlice = context.getSlice('telemetry');
const traces = telemetrySlice?.data || generateRandomTraces(20); // Fallback to mock
```

### Storybook

The UI team has provided Storybook stories for component development:

```bash
cd /Users/griever/Developer/visual-validation/industry-themed-principal-view-panels
npm run storybook

# View at http://localhost:6006
# Navigate to: Panels > TraceListPanel, TraceDetailsPanel
```

### Integration Testing

Test the full flow:

```typescript
import { generateRandomTraces } from '@industry-theme/principal-view-panels/mocks';

describe('Trace Viewer Integration', () => {
  it('should open trace details tab when trace is selected', async () => {
    const mockTraces = generateRandomTraces(5);

    // Render dev workspace
    render(<DevWorkspace />);

    // Click on traces sidebar tab
    fireEvent.click(screen.getByLabelText('Traces'));

    // Click on a trace
    fireEvent.click(screen.getByText(mockTraces[0].rootSpanName));

    // Verify tab was opened
    expect(screen.getByRole('tab', { name: /Trace Details/ })).toBeInTheDocument();

    // Verify TraceDetailsPanel is rendered
    expect(screen.getByText('Span Tree')).toBeInTheDocument();
  });
});
```

---

## Performance Considerations

### Sidebar Panel Performance

TraceListPanel supports virtual scrolling for large lists:

```typescript
// Automatically enabled for > 100 traces
// Configure in component if needed
```

### Tab Limit

Limit number of open trace tabs to prevent performance issues:

```typescript
const MAX_TRACE_TABS = 10;

const openTraceDetailsTab = (trace: TraceInfo) => {
  const traceTabsCount = tabs.filter(t => t.type === 'trace-details').length;

  if (traceTabsCount >= MAX_TRACE_TABS) {
    // Close oldest trace tab
    const oldestTraceTab = tabs.find(t => t.type === 'trace-details');
    if (oldestTraceTab) {
      closeTab(oldestTraceTab.id);
    }
  }

  // ... create new tab
};
```

---

## Summary

**Integration Checklist:**

- [ ] Add TraceListPanel to sidebar configuration
- [ ] Create TelemetryDataSliceProvider
- [ ] Register telemetry slice with panel framework
- [ ] Listen for trace selection events in tab manager
- [ ] Create custom tab type for TraceDetailsPanel
- [ ] Update tab renderer to handle 'trace-details' type
- [ ] Add tab bar support for trace tabs
- [ ] Forward OTEL spans to telemetry data slice
- [ ] Test with mock data
- [ ] Connect to real OTEL collector
- [ ] Add workflow matching metadata (optional)

---

## Related Documentation

- [OTEL Event Structure](../../visual-validation/industry-themed-principal-view-panels/docs/OTEL-EVENT-STRUCTURE.md)
- [Panel Trace Viewer Integration](../../visual-validation/industry-themed-principal-view-panels/docs/TRACE-VIEWER-INTEGRATION.md)
- [OTEL Span Matching](../../visual-validation/principal-view-core-library/.principal-views/OTEL-SPAN-MATCHING.md)
- [OTEL Collector Integration](./OTEL_COLLECTOR_INTEGRATION.md)

---

## Next Steps

1. Implement TelemetryDataSliceProvider
2. Add TraceListPanel to sidebar
3. Add trace details tab handler
4. Test with mock data
5. Connect to real OTEL collector
6. Add keyboard shortcuts (e.g., Cmd+K to open trace search)
