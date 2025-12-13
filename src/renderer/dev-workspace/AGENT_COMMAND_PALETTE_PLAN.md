# Agent Command Palette Integration Plan for Dev-Workspace

This plan outlines integrating the Agent Command Palette from `@principal-ade/panel-layouts` into the dev-workspace page, following the pattern established in web-ade.

---

## Architecture Overview

### High-Level Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DEV-WORKSPACE WINDOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     DevWorkspaceEventProvider                            │   │
│  │                     (new - provides PanelEventEmitter)                   │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │   │
│  │  │                                                                    │  │   │
│  │  │  ┌──────────────────────────────────────────────────────────────┐ │  │   │
│  │  │  │                   DevWorkspaceTitlebar                        │ │  │   │
│  │  │  │                   (existing - no changes)                     │ │  │   │
│  │  │  └──────────────────────────────────────────────────────────────┘ │  │   │
│  │  │                                                                    │  │   │
│  │  │  ┌──────────────────────────────────────────────────────────────┐ │  │   │
│  │  │  │              DevWorkspacePanelFramework                       │ │  │   │
│  │  │  │              (existing - no changes)                          │ │  │   │
│  │  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │ │  │   │
│  │  │  │  │   LEFT     │  │   MIDDLE   │  │   RIGHT    │              │ │  │   │
│  │  │  │  │  Visual    │  │  Terminal  │  │ (collapsed)│              │ │  │   │
│  │  │  │  │ Validation │  │            │  │            │              │ │  │   │
│  │  │  │  └────────────┘  └────────────┘  └────────────┘              │ │  │   │
│  │  │  └──────────────────────────────────────────────────────────────┘ │  │   │
│  │  │                                                                    │  │   │
│  │  │  ┌──────────────────────────────────────────────────────────────┐ │  │   │
│  │  │  │              AgentCommandPalette (NEW)                        │ │  │   │
│  │  │  │              Slides up from bottom on Alt+P                   │ │  │   │
│  │  │  │  ┌──────────────────────────────────────────────────────┐    │ │  │   │
│  │  │  │  │  "What would you like to do?"                    [x] │    │ │  │   │
│  │  │  │  └──────────────────────────────────────────────────────┘    │ │  │   │
│  │  │  └──────────────────────────────────────────────────────────────┘ │  │   │
│  │  │                                                                    │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Tree (Before vs After)

```
BEFORE:                                    AFTER:
───────                                    ─────

DevWorkspaceApp                            DevWorkspaceApp
├── DevWorkspaceTitlebar                   └── DevWorkspaceEventProvider (NEW)
└── DevWorkspacePanelFramework                 ├── DevWorkspaceTitlebar
    ├── VisualValidationPanel                  ├── DevWorkspacePanelFramework
    └── TerminalPanel                          │   ├── VisualValidationPanel
                                               │   └── TerminalPanel
                                               └── AgentCommandPalette (NEW)
```

### Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION FLOW                              │
└────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐
  │   User   │
  └────┬─────┘
       │
       │ 1. Presses Alt+P
       ▼
  ┌──────────────────────┐
  │ AgentCommandPalette  │
  │   opens (slides up)  │
  └──────────┬───────────┘
             │
             │ 2. User types command
             │    Example: "/collapse" or "hide the sidebars"
             ▼
  ┌──────────────────────┐
  │   Mode Detection     │
  │                      │
  │  "/" prefix?         │
  │  ├─ YES → Quick Cmd  │
  │  └─ NO  → Natural    │
  └──────────┬───────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌───────────┐  ┌───────────────┐
│  QUICK    │  │   NATURAL     │
│  COMMAND  │  │   LANGUAGE    │
│           │  │               │
│ /collapse │  │ "hide the     │
│ /toggle   │  │  sidebars"    │
│ /switch   │  │               │
└─────┬─────┘  └───────┬───────┘
      │                │
      │                │ 3. Send to AI Provider
      │                │    (via IPC to main process)
      │                ▼
      │         ┌───────────────┐
      │         │  AI Provider  │
      │         │  (Gemini/     │
      │         │   OpenAI)     │
      │         └───────┬───────┘
      │                 │
      │                 │ 4. Returns tool calls
      │                 │    [{name: "collapse_all_panels"}]
      │                 ▼
      │         ┌───────────────┐
      └────────▶│ Tool Executor │◀────────┘
                │               │
                │ handleQuick   │
                │ Command() or  │
                │ executeToolFrom│
                │ AI()          │
                └───────┬───────┘
                        │
                        │ 5. Emits panel events
                        ▼
                ┌───────────────┐
                │ PanelEvent    │
                │ Emitter       │
                │               │
                │ 'panel:toggle'│
                │ 'panel:       │
                │  collapse-all'│
                └───────┬───────┘
                        │
                        │ 6. Event listeners update state
                        ▼
                ┌───────────────┐
                │ DevWorkspace  │
                │ App State     │
                │               │
                │ setCollapsed()│
                │ setLayout()   │
                └───────────────┘
```

### State Machine

```
                              ┌─────────┐
                              │  IDLE   │◀─────────────────────┐
                              └────┬────┘                      │
                                   │                           │
                                   │ User submits query        │
                                   ▼                           │
                              ┌─────────┐                      │
                         ┌───▶│THINKING │                      │
                         │    └────┬────┘                      │
                         │         │                           │
                         │         │ AI returns tool calls     │
                         │         ▼                           │
                         │    ┌──────────┐                     │
                         │    │EXECUTING │──────┐              │
                         │    └────┬─────┘      │              │
                         │         │            │              │
           More tools    │         │ All tools  │ Error        │
           to execute    │         │ complete   │              │
                         │         ▼            ▼              │
                         │    ┌─────────┐  ┌─────────┐         │
                         └────│COMPLETE │  │  ERROR  │─────────┤
                              └────┬────┘  └─────────┘         │
                                   │                           │
                                   │ Auto-close delay (1.5s)   │
                                   └───────────────────────────┘
```

### Event System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EVENT BUS (PanelEventEmitter)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   PUBLISHERS                          SUBSCRIBERS                               │
│   ──────────                          ───────────                               │
│                                                                                 │
│   AgentCommandPalette ─────┐     ┌───── DevWorkspaceApp                        │
│                            │     │      (layout state handlers)                 │
│   Events emitted:          │     │                                              │
│   • agent-command-palette: │     │      Events listened:                        │
│     submit                 │     │      • panel:toggle                          │
│   • agent-command-palette: │     │      • panel:collapse-all                    │
│     opened                 ├─────┤      • panel:expand-all                      │
│   • agent-command-palette: │     │      • panel:switch                          │
│     closed                 │     │      • panel:reset-layout                    │
│                            │     │                                              │
│   Tool Executor ───────────┘     └───── AgentCommandPalette                    │
│                                         (status updates)                        │
│   Events emitted:                                                               │
│   • panel:toggle                        Events listened:                        │
│   • panel:collapse-all                  • agent-command-palette:submit          │
│   • panel:expand-all                                                            │
│   • panel:switch                                                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### File Structure (Changes)

```
electron-app/src/renderer/dev-workspace/
├── DevWorkspaceApp.tsx              ← MODIFY (add imports, hooks, render)
├── DevWorkspaceEventContext.tsx     ← NEW (event emitter provider)
├── DevWorkspacePanelFramework.tsx   ← NO CHANGES
├── DevWorkspaceTitlebar.tsx         ← NO CHANGES
├── global.d.ts                      ← MODIFY (add AI IPC types - optional)
└── index.tsx                        ← NO CHANGES

electron-app/src/renderer/main-process-api/
└── AIService.ts                     ← NEW (service wrapper for AI IPC)
```

---

## Panel Tool Registration System

### How It Works

Panel tools are UTCP-compatible function definitions that AI agents and command palettes can invoke. The system uses a **registry + event-based** architecture:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PANEL TOOL REGISTRATION FLOW                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. TOOL DEFINITION                                                             │
│  ─────────────────                                                              │
│                                                                                 │
│  layoutTools (from @principal-ade/panel-layouts)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  {                                                                       │   │
│  │    name: 'collapse_all_panels',                                          │   │
│  │    description: 'Collapse both left and right panels',                   │   │
│  │    inputs: { type: 'object', properties: {}, required: [] },             │   │
│  │    outputs: { type: 'object', properties: { success: { type: 'bool' } } }│   │
│  │    tags: ['panel', 'layout', 'collapse', 'focus'],                       │   │
│  │    tool_call_template: {                                                 │   │
│  │      call_template_type: 'panel_event',                                  │   │
│  │      event_type: 'panel:collapse-all'  ← Event to emit when invoked      │   │
│  │    }                                                                     │   │
│  │  }                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  2. TOOL REGISTRATION                                                           │
│  ────────────────────                                                           │
│                                                                                 │
│  Panel metadata (or layout tools) → PanelToolRegistry.registerPanelTools()     │
│                                            ↓                                    │
│                                    Global Tool Registry                         │
│                                    (singleton instance)                         │
│                                                                                 │
│  3. TOOL DISCOVERY (by AI)                                                      │
│  ─────────────────────────                                                      │
│                                                                                 │
│  registry.getToolsAsAIFunctions() → [{ name, description, parameters }, ...]   │
│                                            ↓                                    │
│                                    Sent to LLM with user query                  │
│                                                                                 │
│  4. TOOL INVOCATION                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  LLM decides: "collapse_all_panels" matches "hide the sidebars"                │
│                                            ↓                                    │
│  registry.invokeTool('collapse_all_panels', {})                                │
│                                            ↓                                    │
│  Registry looks up tool_call_template.event_type                               │
│                                            ↓                                    │
│  eventEmitter.emit({ type: 'panel:collapse-all', payload: {} })                │
│                                                                                 │
│  5. EVENT HANDLING                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  DevWorkspaceApp listens for 'panel:collapse-all' event                        │
│                                            ↓                                    │
│  setCollapsed({ left: true, right: true })                                     │
│                                            ↓                                    │
│  UI updates, panels collapse                                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Available Layout Tools

The `layoutTools` array from `@principal-ade/panel-layouts` includes:

| Tool Name             | Event Emitted          | Description                    |
| --------------------- | ---------------------- | ------------------------------ |
| `toggle_panel`        | `panel:toggle`         | Collapse/expand a side panel   |
| `collapse_all_panels` | `panel:collapse-all`   | Collapse both sidebars         |
| `expand_all_panels`   | `panel:expand-all`     | Expand both sidebars           |
| `switch_panel`        | `panel:switch`         | Change panel content in a slot |
| `focus_panel`         | `panel:focus`          | Set focus to a panel slot      |
| `reset_layout`        | `panel:reset-layout`   | Reset to default layout        |
| `get_visible_panels`  | `panel:get-visibility` | Query current panel visibility |

### Registering Custom Tools

You can register additional tools from panel packages:

```typescript
import { getGlobalToolRegistry } from '@principal-ade/panel-framework-core';

useEffect(() => {
  const registry = getGlobalToolRegistry();

  // Register tools from an external panel package
  import('@industry-theme/visual-validation-panel').then((mod) => {
    const panel = mod.VisualValidationPanel;
    if (panel?.metadata?.tools) {
      registry.registerPanelTools(panel.metadata);
      console.log('[DevWorkspace] Registered visual validation tools');
    }
  });

  return () => {
    registry.unregisterPanelTools('visual-validation');
  };
}, []);
```

### Tool Definition Structure (UTCP)

```typescript
interface PanelTool {
  name: string; // Tool identifier
  description: string; // For AI to understand purpose
  inputs: JsonSchema; // JSON Schema for parameters
  outputs: JsonSchema; // JSON Schema for return value
  tags: string[]; // For search/discovery
  tool_call_template: {
    call_template_type: 'panel_event';
    event_type: string; // Event to emit when invoked
    target_panel?: string; // Optional specific panel target
  };
}
```

### Converting Tools for AI Providers

```typescript
import {
  layoutTools,
  toolsToGeminiFormat,
  toolsToOpenAIFormat,
  toolsToAnthropicFormat,
} from '@principal-ade/panel-layouts';

// For Google Gemini
const geminiTools = toolsToGeminiFormat(layoutTools);

// For OpenAI
const openAITools = toolsToOpenAIFormat(layoutTools);

// For Anthropic Claude
const anthropicTools = toolsToAnthropicFormat(layoutTools);
```

---

## Prerequisites

**Update `@principal-ade/panel-layouts` to version `^0.2.8`** (current: `^0.2.5`)

The agent command palette exports (`useAgentCommandPalette`, `AgentCommandPalette`, etc.) are available in version 0.2.8 of the package.

```bash
npm install @principal-ade/panel-layouts@^0.2.8
```

---

## Implementation Steps

### Step 1: Update Package Version

**File:** `electron-app/package.json`

Update the panel-layouts dependency:

```json
"@principal-ade/panel-layouts": "^0.2.8"
```

Run `npm install` to update.

---

### Step 2: Create Panel Event Emitter

The agent command palette requires a `PanelEventEmitter` instance from `@principal-ade/panel-framework-core`. The dev-workspace doesn't currently use the event system.

**Option A: Minimal - Use a standalone event emitter**

Create a simple event emitter context for the dev-workspace:

**New File:** `electron-app/src/renderer/dev-workspace/DevWorkspaceEventContext.tsx`

```typescript
import React, { createContext, useContext, useMemo } from 'react';
import { PanelEventEmitter } from '@principal-ade/panel-framework-core';

interface DevWorkspaceEventContextValue {
  events: PanelEventEmitter;
}

const DevWorkspaceEventContext = createContext<DevWorkspaceEventContextValue | null>(null);

export function DevWorkspaceEventProvider({ children }: { children: React.ReactNode }) {
  const events = useMemo(() => new PanelEventEmitter(), []);

  return (
    <DevWorkspaceEventContext.Provider value={{ events }}>
      {children}
    </DevWorkspaceEventContext.Provider>
  );
}

export function useDevWorkspaceEvents() {
  const context = useContext(DevWorkspaceEventContext);
  if (!context) {
    throw new Error('useDevWorkspaceEvents must be used within DevWorkspaceEventProvider');
  }
  return context;
}
```

---

### Step 3: Integrate Agent Command Palette Hook

**File:** `electron-app/src/renderer/dev-workspace/DevWorkspaceApp.tsx`

Add the following imports and hook setup:

```typescript
// Add imports
import {
  AgentCommandPalette,
  useAgentCommandPalette,
  layoutTools,
} from '@principal-ade/panel-layouts';
import {
  useDevWorkspaceEvents,
  DevWorkspaceEventProvider,
} from './DevWorkspaceEventContext';

// Inside DevWorkspaceApp component (after wrapping with provider)
const { events } = useDevWorkspaceEvents();

const agentPalette = useAgentCommandPalette({
  events,
  keyboard: { key: 'p', altKey: true }, // Alt+P to open
  config: {
    placeholder: 'What would you like to do?',
    autoCloseDelay: 1500,
  },
  onExecuteTool: handleQuickCommand,
  initialSuggestions: [
    'hide sidebars',
    'show validation panel',
    'focus on terminal',
    'switch to visual validation',
  ],
});
```

---

### Step 4: Implement Tool Execution Handler

**File:** `electron-app/src/renderer/dev-workspace/DevWorkspaceApp.tsx`

Add a tool execution handler for quick commands (commands prefixed with `/`):

```typescript
const handleQuickCommand = useCallback(
  async (name: string, args: Record<string, unknown>) => {
    switch (name) {
      case 'toggle':
        const panel = (args.args as string[])?.[0];
        if (panel === 'left') {
          setCollapsed((prev) => ({ ...prev, left: !prev.left }));
        } else if (panel === 'right') {
          setCollapsed((prev) => ({ ...prev, right: !prev.right }));
        }
        return { success: true };

      case 'collapse':
        setCollapsed({ left: true, right: true });
        return { success: true };

      case 'expand':
        setCollapsed({ left: false, right: false });
        return { success: true };

      case 'switch':
        const [slot, panelName] = (args.args as string[]) || [];
        if (slot && panelName) {
          setLayout((prev) => ({ ...prev, [slot]: panelName }));
        }
        return { success: true };

      default:
        return { error: `Unknown command: ${name}` };
    }
  },
  [],
);
```

---

### Step 5: Wire Up AI Integration (Natural Language Mode)

For natural language commands, you need an AI provider. Following the codebase's service wrapper pattern (like `UserPreferencesService`, `RepositoryMonitoringService`), create a dedicated service class.

**Option A: Create AIService (Recommended - Follows Codebase Pattern)**

First, create the service wrapper:

**New File:** `electron-app/src/renderer/main-process-api/AIService.ts`

```typescript
import type { PanelTool } from '@principal-ade/panel-framework-core';

export interface AIToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AIProcessingResult {
  toolCalls?: AIToolCall[];
  message?: string;
  error?: string;
}

/**
 * Service wrapper for AI-related IPC calls.
 * Follows the same pattern as UserPreferencesService, GitService, etc.
 */
export class AIService {
  /**
   * Process a natural language query and return tool calls.
   */
  static async processNaturalLanguage(
    query: string,
    tools: PanelTool[],
  ): Promise<AIProcessingResult> {
    try {
      const result = await window.mainProcess.ai.processNaturalLanguage({
        query,
        tools,
      });
      return result;
    } catch (error) {
      console.error('[AIService] Error processing natural language:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

Then use it in DevWorkspaceApp:

```typescript
// In DevWorkspaceApp.tsx
import { AIService } from '../main-process-api/AIService';

useEffect(() => {
  if (!events) return;

  const unsubscribe = events.on(
    'agent-command-palette:submit',
    async (event) => {
      const { query, mode } = event.payload as { query: string; mode: string };

      if (mode === 'quick-command') {
        // Handled by onExecuteTool callback
        return;
      }

      // Natural language mode - send to AI via service
      try {
        agentPalette.setStatus?.('thinking');

        // Use AIService instead of direct window.mainProcess call
        const response = await AIService.processNaturalLanguage(
          query,
          layoutTools,
        );

        if (response.error) {
          agentPalette.setStatus?.('error');
          console.error('[DevWorkspace] AI processing failed:', response.error);
          return;
        }

        // Execute returned tool calls
        for (const toolCall of response.toolCalls || []) {
          await executeToolFromAI(toolCall.name, toolCall.args);
        }

        agentPalette.setStatus?.('complete');
        if (response.message) {
          agentPalette.setAgentResponse?.(response.message);
        }
      } catch (error) {
        agentPalette.setStatus?.('error');
        console.error('[DevWorkspace] AI processing failed:', error);
      }
    },
  );

  return () => unsubscribe();
}, [events, agentPalette]);
```

**Option B: Quick Commands Only (No AI)**

If you don't need natural language processing, just use quick commands:

```typescript
// Only support /toggle, /collapse, /expand, /switch commands
// Natural language mode will show an error or be disabled
```

---

### Step 6: Implement AI Tool Execution

**File:** `electron-app/src/renderer/dev-workspace/DevWorkspaceApp.tsx`

```typescript
const executeToolFromAI = useCallback(
  async (name: string, args: Record<string, unknown>) => {
    const toolId = `ai-${Date.now()}`;
    agentPalette.addPendingTool?.({ id: toolId, name, args });
    agentPalette.updateToolStatus?.(toolId, 'running');

    try {
      switch (name) {
        case 'toggle_panel':
          const panel = args.panel as 'left' | 'right';
          setCollapsed((prev) => ({ ...prev, [panel]: !prev[panel] }));
          break;

        case 'collapse_all_panels':
          setCollapsed({ left: true, right: true });
          break;

        case 'expand_all_panels':
          setCollapsed({ left: false, right: false });
          break;

        case 'switch_panel':
          const { slot, panel: newPanel } = args as {
            slot: string;
            panel: string;
          };
          setLayout((prev) => ({ ...prev, [slot]: newPanel }));
          break;

        case 'focus_panel':
          // If you have focus management, handle it here
          break;

        case 'reset_layout':
          setLayout({
            left: 'visualValidation',
            middle: 'terminal',
            right: '',
          });
          setCollapsed({ left: false, right: true });
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      agentPalette.updateToolStatus?.(toolId, 'success');
    } catch (error) {
      agentPalette.updateToolStatus?.(
        toolId,
        'error',
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  },
  [agentPalette],
);
```

---

### Step 7: Add Panel Event Listeners

Wire up event listeners for panel control events:

```typescript
useEffect(() => {
  if (!events) return;

  const listeners = [
    events.on('panel:toggle', (event) => {
      const { panel } = event.payload as { panel: 'left' | 'right' };
      setCollapsed((prev) => ({ ...prev, [panel]: !prev[panel] }));
    }),
    events.on('panel:collapse-all', () => {
      setCollapsed({ left: true, right: true });
    }),
    events.on('panel:expand-all', () => {
      setCollapsed({ left: false, right: false });
    }),
    events.on('panel:switch', (event) => {
      const { slot, panel } = event.payload as { slot: string; panel: string };
      setLayout((prev) => ({ ...prev, [slot]: panel }));
    }),
    events.on('panel:reset-layout', () => {
      setLayout({ left: 'visualValidation', middle: 'terminal', right: '' });
      setCollapsed({ left: false, right: true });
    }),
  ];

  return () => listeners.forEach((unsub) => unsub());
}, [events]);
```

---

### Step 8: Render the Agent Command Palette

**File:** `electron-app/src/renderer/dev-workspace/DevWorkspaceApp.tsx`

Add the component to the render tree:

```tsx
return (
  <DevWorkspaceEventProvider>
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex flex-col">
      <DevWorkspaceTitlebar
      // ... existing props
      />
      <div className="flex-1 overflow-hidden">
        <DevWorkspacePanelFramework
        // ... existing props
        />
      </div>

      {/* Agent Command Palette - Alt+P to open */}
      <AgentCommandPalette
        palette={agentPalette}
        config={{
          placeholder: 'What would you like to do?',
        }}
      />
    </div>
  </DevWorkspaceEventProvider>
);
```

---

### Step 9: Update Type Declarations (if needed)

If using IPC for AI calls, update the type declarations:

**File:** `electron-app/src/renderer/dev-workspace/global.d.ts`

```typescript
interface DevWorkspaceAPI {
  // ... existing declarations

  ai?: {
    processNaturalLanguage: (params: {
      query: string;
      tools: unknown[];
    }) => Promise<{
      toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
      message?: string;
    }>;
  };
}
```

---

## File Changes Summary

| File                           | Action | Description                                         |
| ------------------------------ | ------ | --------------------------------------------------- |
| `package.json`                 | Edit   | Update `@principal-ade/panel-layouts` to `^0.2.8`   |
| `DevWorkspaceEventContext.tsx` | Create | New event emitter context                           |
| `DevWorkspaceApp.tsx`          | Edit   | Add imports, hook, handlers, and render component   |
| `AIService.ts`                 | Create | Service wrapper for AI IPC (in `main-process-api/`) |
| `global.d.ts`                  | Edit   | Add AI IPC type declarations (optional)             |

---

## Quick Commands Available

After integration, users can use these quick commands (prefix with `/`):

| Command                           | Description                              |
| --------------------------------- | ---------------------------------------- |
| `/toggle left`                    | Toggle left sidebar                      |
| `/toggle right`                   | Toggle right sidebar                     |
| `/collapse`                       | Collapse all sidebars                    |
| `/expand`                         | Expand all sidebars                      |
| `/switch left terminal`           | Switch left panel to terminal            |
| `/switch middle visualValidation` | Switch middle panel to visual validation |

---

## Keyboard Shortcuts

| Shortcut  | Action                     |
| --------- | -------------------------- |
| `Alt+P`   | Open Agent Command Palette |
| `Enter`   | Execute command            |
| `Escape`  | Close palette              |
| `↑` / `↓` | Navigate command history   |

---

## Testing Checklist

- [ ] Package updated to 0.2.8 successfully
- [ ] `Alt+P` opens the command palette
- [ ] Quick command `/toggle left` works
- [ ] Quick command `/collapse` works
- [ ] Escape closes the palette
- [ ] History navigation works with arrow keys
- [ ] Natural language mode connects to AI (if implemented)
- [ ] Tool execution shows visual feedback
- [ ] Auto-close after completion works

---

## Optional Enhancements

1. **Add keyboard shortcut indicator in titlebar** - Show "Alt+P" hint
2. **Custom tools** - Add dev-workspace-specific tools (run command, open file, etc.)
3. **Terminal integration** - Add tools to interact with the terminal
4. **Voice input** - Add speech-to-text for natural language input

---

## Visual Reference

### Agent Command Palette UI

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DEV-WORKSPACE                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ Titlebar: Repository Name | main | ● | [Panel Controls]                     ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│  ┌────────────────────┬────────────────────────────────────────────────────────┐│
│  │                    │                                                         ││
│  │  Visual Validation │                    Terminal                             ││
│  │                    │                                                         ││
│  │  [Screenshot]      │  $ npm run dev                                          ││
│  │  [Comparison]      │  > Starting development server...                       ││
│  │  [Results]         │  > Ready on http://localhost:3000                       ││
│  │                    │  $ █                                                    ││
│  │                    │                                                         ││
│  │                    │                                                         ││
│  │                    │                                                         ││
│  └────────────────────┴────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ╔══════════════════════════════════════════════════════════════════════════════╗
│  ║                                                                              ║
│  ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
│  ║  │ What would you like to do?                                         [×] │  ║
│  ║  │ ________________________________________________________________       │  ║
│  ║  │                                                                        │  ║
│  ║  │ Suggestions:                                                           │  ║
│  ║  │   • hide sidebars                                                      │  ║
│  ║  │   • show validation panel                                              │  ║
│  ║  │   • focus on terminal                                                  │  ║
│  ║  └────────────────────────────────────────────────────────────────────────┘  ║
│  ║                                                                              ║
│  ╚══════════════════════════════════════════════════════════════════════════════╝
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
         ▲
         │
         └── Agent Command Palette (slides up from bottom on Alt+P)
```

### Tool Execution Feedback UI

```
┌────────────────────────────────────────────────────────────────────────┐
│ What would you like to do?                                         [×] │
│ hide all sidebars and focus on terminal________________________       │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │  Status: EXECUTING                                                 │ │
│ │                                                                    │ │
│ │  ✓ collapse_all_panels                              [success]      │ │
│ │  ● focus_panel { slot: "middle" }                   [running]      │ │
│ │                                                                    │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Comparison: Quick Command vs Natural Language

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           QUICK COMMAND MODE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  User types: /collapse                                                          │
│             ▼                                                                   │
│  Detected: "/" prefix → Quick Command Mode                                      │
│             ▼                                                                   │
│  Parsed: { command: "collapse", args: [] }                                      │
│             ▼                                                                   │
│  Execute: handleQuickCommand("collapse", {})                                    │
│             ▼                                                                   │
│  Result: setCollapsed({ left: true, right: true })                              │
│             ▼                                                                   │
│  ✓ Instant (no AI call)                                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        NATURAL LANGUAGE MODE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  User types: hide all the sidebars                                              │
│             ▼                                                                   │
│  Detected: No "/" prefix → Natural Language Mode                                │
│             ▼                                                                   │
│  Status: THINKING...                                                            │
│             ▼                                                                   │
│  AI Request: {                                                                  │
│    messages: [{ role: "user", content: "hide all the sidebars" }],              │
│    tools: [layoutTools schema...]                                               │
│  }                                                                              │
│             ▼                                                                   │
│  AI Response: {                                                                 │
│    toolCalls: [{ name: "collapse_all_panels", args: {} }]                       │
│  }                                                                              │
│             ▼                                                                   │
│  Status: EXECUTING...                                                           │
│             ▼                                                                   │
│  Execute: executeToolFromAI("collapse_all_panels", {})                          │
│             ▼                                                                   │
│  Result: setCollapsed({ left: true, right: true })                              │
│             ▼                                                                   │
│  Status: COMPLETE ✓                                                             │
│             ▼                                                                   │
│  Auto-close after 1.5s                                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Integration Pattern Comparison (web-ade vs dev-workspace)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WEB-ADE (Reference)                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  EditorLayout.tsx                                                               │
│  ├── usePanelProvider() → events                                                │
│  ├── useGemini() → sendMessage                                                  │
│  ├── useAgentCommandPalette({ events, ... })                                    │
│  └── <AgentCommandPalette palette={agentPalette} />                             │
│                                                                                 │
│  AI Integration: GeminiContext (browser-side API calls)                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DEV-WORKSPACE (Target)                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DevWorkspaceApp.tsx                                                            │
│  ├── DevWorkspaceEventProvider                                                  │
│  │   └── useDevWorkspaceEvents() → events                                       │
│  ├── useAgentCommandPalette({ events, ... })                                    │
│  └── <AgentCommandPalette palette={agentPalette} />                             │
│                                                                                 │
│  AI Integration: IPC to main process (Electron-native)                          │
│                  window.mainProcess.ai.processNaturalLanguage()                 │
│                                                                                 │
│  Key Difference: Event emitter is standalone (not from PanelProvider)           │
│                  AI calls go through IPC instead of browser fetch               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Sequence Diagram: Full Integration Flow

```
┌──────┐  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐
│ User │  │ AgentCommand    │  │ Event        │  │ Main        │  │ DevWorkspace│
│      │  │ Palette         │  │ Emitter      │  │ Process AI  │  │ App State   │
└──┬───┘  └───────┬─────────┘  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘
   │              │                   │                 │                │
   │ Alt+P        │                   │                 │                │
   │─────────────▶│                   │                 │                │
   │              │ open()            │                 │                │
   │              │──────────────────▶│                 │                │
   │              │                   │ 'agent-command- │                │
   │              │                   │  palette:opened'│                │
   │              │                   │                 │                │
   │ Type query   │                   │                 │                │
   │─────────────▶│                   │                 │                │
   │              │                   │                 │                │
   │ Enter        │                   │                 │                │
   │─────────────▶│                   │                 │                │
   │              │ emit('submit')    │                 │                │
   │              │──────────────────▶│                 │                │
   │              │                   │                 │                │
   │              │                   │ IPC call        │                │
   │              │                   │────────────────▶│                │
   │              │                   │                 │                │
   │              │ setStatus         │                 │                │
   │              │ ('thinking')      │                 │                │
   │              │◀──────────────────│                 │                │
   │              │                   │                 │                │
   │              │                   │ AI response     │                │
   │              │                   │◀────────────────│                │
   │              │                   │ (tool calls)    │                │
   │              │                   │                 │                │
   │              │ setStatus         │                 │                │
   │              │ ('executing')     │                 │                │
   │              │◀──────────────────│                 │                │
   │              │                   │                 │                │
   │              │                   │ 'panel:collapse │                │
   │              │                   │  -all'          │                │
   │              │                   │────────────────────────────────▶│
   │              │                   │                 │                │
   │              │                   │                 │ setCollapsed() │
   │              │                   │                 │                │
   │              │ setStatus         │                 │                │
   │              │ ('complete')      │                 │                │
   │              │◀──────────────────│                 │                │
   │              │                   │                 │                │
   │              │ auto-close        │                 │                │
   │              │ (1.5s delay)      │                 │                │
   │              │                   │                 │                │
   │              │ close()           │                 │                │
   │              │──────────────────▶│                 │                │
   │              │                   │ 'agent-command- │                │
   │              │                   │  palette:closed'│                │
   │              │                   │                 │                │
   └──────────────┴───────────────────┴─────────────────┴────────────────┘
```
