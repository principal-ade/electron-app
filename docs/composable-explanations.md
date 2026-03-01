# Composable Explanations

> Design document for agent-generated codebase explanations using Principal View canvases and workflows.

## Overview

This document explores how to create a **composable format** that allows agents to produce structured explanations of codebases using the existing Principal View infrastructure (canvases, workflows, scenarios).

The core idea: agents reference and compose existing visual artifacts (canvases) with narrative content to explain code in context.

---

## Use Cases

| Use Case | Trigger | Key Need |
|----------|---------|----------|
| **Code Review** | PR opened | Highlight changes, show impact across architecture |
| **Design Spec** | Before implementation | Propose additions, show integration points |
| **Exploration** | "How does X work?" | Navigate existing canvases, progressive disclosure |
| **Incident Analysis** | Something broke | Trace failure path, correlate with OTEL data |
| **Onboarding** | New team member | Curated tour through architecture |
| **Impact Analysis** | "What if I change X?" | Find dependencies, highlight risk |
| **Audit/Compliance** | Security review | Filter by data type, trace sensitive flows |

---

## Cross-Canvas Referencing

### Reference Format

Elements are referenced using `canvas-alias:element-id` format:

```
mcp-bridge:express-server
architecture:main-process
auth-flow:token-validator
```

### Canvas Registry

Each explanation document declares the canvases it references:

```json
{
  "canvases": {
    "mcp-bridge": ".principal-views/principal-mcp-bridge/principal-mcp-bridge.otel.canvas",
    "architecture": ".principal-views/architecture/architecture.canvas",
    "repo-monitoring": ".principal-views/repository-monitoring/repository-monitoring.canvas"
  }
}
```

### Entity Mapping

The same logical entity may appear in multiple canvases with different representations:

```json
{
  "entities": {
    "main-process": {
      "description": "The Electron main process",
      "occurrences": [
        "architecture:main-process",
        "mcp-bridge:express-server"
      ]
    },
    "repo-worker": {
      "description": "Repository monitoring worker process",
      "occurrences": [
        "architecture:worker-process",
        "mcp-bridge:monitoring-worker",
        "repo-monitoring:watcher-process"
      ]
    }
  }
}
```

### Cross-Canvas Bridges

Explicit relationships that span canvas boundaries:

```json
{
  "bridges": [
    {
      "id": "mcp-to-repo",
      "from": "mcp-bridge:repo-monitoring-calling",
      "to": "repo-monitoring:entry-point",
      "label": "IPC to worker",
      "type": "async"
    }
  ]
}
```

---

## Document Structure

### Common Scaffolding

All explanation types share this structure:

```
┌─────────────────────────────────────────────────────────────┐
│                     EXPLANATION DOCUMENT                    │
├──────────────────┬──────────────────────────────────────────┤
│  metadata        │ type, version, title, author, date       │
├──────────────────┼──────────────────────────────────────────┤
│  scope           │ files/areas/canvases relevant            │
├──────────────────┼──────────────────────────────────────────┤
│  canvas-refs     │ registry of canvases with aliases        │
├──────────────────┼──────────────────────────────────────────┤
│  element-refs    │ specific nodes/edges/scenarios           │
├──────────────────┼──────────────────────────────────────────┤
│  annotations     │ overlays: highlight, label, status       │
├──────────────────┼──────────────────────────────────────────┤
│  proposed        │ elements that don't exist yet            │
├──────────────────┼──────────────────────────────────────────┤
│  narrative       │ markdown content + element bindings      │
├──────────────────┼──────────────────────────────────────────┤
│  flow/journey    │ ordered traversal through elements       │
├──────────────────┼──────────────────────────────────────────┤
│  source-links    │ bidirectional code ↔ visual mappings     │
└──────────────────┴──────────────────────────────────────────┘
```

---

## Examples by Use Case

### Code Review

```json
{
  "type": "code-review",
  "version": "1.0.0",
  "title": "PR #142: Add theme reset endpoint",

  "scope": {
    "files": [
      "src/main/principal-mcp/PrincipalMCPBridge.ts",
      "src/main/theme/themeHandler.ts"
    ]
  },

  "canvases": {
    "mcp-bridge": ".principal-views/principal-mcp-bridge/principal-mcp-bridge.otel.canvas"
  },

  "views": [
    {
      "id": "affected-area",
      "canvas": "mcp-bridge",
      "focus": {
        "existing": ["theme-update-route", "theme-prefs-update", "express-server"],
        "modified": ["theme-update-route"],
        "added": ["theme-reset-route"]
      },
      "narrative": "This PR adds a new `POST /theme/reset` endpoint adjacent to the existing theme update flow."
    }
  ],

  "walkthrough": [
    {
      "ref": "mcp-bridge:express-server",
      "content": "New route registered here alongside existing theme routes",
      "source": "src/main/principal-mcp/PrincipalMCPBridge.ts:245-250"
    },
    {
      "ref": "mcp-bridge:theme-prefs-update",
      "content": "Reuses existing `UserPreferencesHandler` but calls `resetThemeOverrides()` instead",
      "source": "src/main/stores/userPreferencesHandler.ts:89"
    }
  ],

  "scenarios": {
    "happy-path": {
      "workflow": ".principal-views/principal-mcp-bridge/theme-update.workflow.json",
      "scenario": "theme-update-success",
      "note": "Reset follows same flow but clears overrides instead of setting them"
    }
  }
}
```

### Design Spec

```json
{
  "type": "design-spec",
  "version": "1.0.0",
  "title": "RFC: Real-time Theme Preview",

  "summary": "Allow MCP clients to preview theme changes before committing them",

  "canvases": {
    "mcp-bridge": ".principal-views/principal-mcp-bridge/principal-mcp-bridge.otel.canvas"
  },

  "views": [
    {
      "id": "current-state",
      "canvas": "mcp-bridge",
      "focus": {
        "existing": ["theme-update-route", "theme-prefs-update", "theme-renderer-broadcast"]
      },
      "narrative": "**Current:** Theme updates are immediately persisted and broadcast."
    },
    {
      "id": "proposed-state",
      "canvas": "mcp-bridge",
      "focus": {
        "existing": ["theme-update-route", "theme-renderer-broadcast"],
        "proposed": [
          {
            "id": "theme-preview-route",
            "after": "theme-update-route",
            "label": "POST /theme/preview"
          },
          {
            "id": "preview-session-manager",
            "label": "Preview Session Manager"
          }
        ]
      },
      "narrative": "**Proposed:** Add preview endpoint that creates temporary session, broadcasts preview without persisting."
    }
  ],

  "flows": [
    {
      "name": "Preview Flow",
      "steps": [
        { "ref": "mcp-bridge:mcp-client", "action": "POST /theme/preview with changes" },
        { "ref": "proposed:theme-preview-route", "action": "Validates and creates preview session" },
        { "ref": "proposed:preview-session-manager", "action": "Stores temporary overrides (TTL: 30s)" },
        { "ref": "mcp-bridge:theme-renderer-broadcast", "action": "Broadcasts with preview flag" }
      ]
    }
  ]
}
```

### Exploration

```json
{
  "type": "exploration",
  "version": "1.0.0",
  "question": "How does the app handle theme changes from MCP clients?",

  "canvases": {
    "architecture": ".principal-views/architecture/architecture.canvas",
    "mcp-bridge": ".principal-views/principal-mcp-bridge/principal-mcp-bridge.otel.canvas"
  },

  "answer": {
    "summary": "Theme changes flow through an HTTP bridge to preferences storage, then broadcast to all renderer windows.",

    "journey": [
      {
        "level": "system",
        "canvas": "architecture",
        "focus": ["main-process", "renderer-processes"],
        "narrative": "At the system level, theme changes originate in main process and propagate to renderers."
      },
      {
        "level": "detail",
        "canvas": "mcp-bridge",
        "focus": ["theme-update-route", "theme-prefs-update", "theme-renderer-broadcast"],
        "narrative": "Zooming in: the MCP bridge exposes HTTP endpoints that update preferences and trigger IPC broadcasts."
      }
    ],

    "related": {
      "scenarios": [
        ".principal-views/principal-mcp-bridge/theme-update.workflow.json#theme-update-success"
      ],
      "sources": [
        "src/main/principal-mcp/PrincipalMCPBridge.ts",
        "src/main/theme/themeHandler.ts",
        "src/renderer/providers/CustomThemeProvider.tsx"
      ]
    }
  }
}
```

---

## Additional Capabilities

### Filtering / Queries

Select subsets of canvas elements:

```json
{
  "filter": {
    "nodeTypes": ["service", "route-handler"],
    "hasSource": "src/main/principal-mcp/**",
    "matchesScenario": "*.error.*"
  }
}
```

### Diffing

For code review and change tracking:

```json
{
  "diff": {
    "base": "main",
    "head": "feature/theme-reset",
    "changes": [
      { "type": "added", "ref": "mcp-bridge:theme-reset-route" },
      { "type": "modified", "ref": "mcp-bridge:theme-prefs-update", "lines": [45, 67] }
    ]
  }
}
```

### Trace Correlation

For incident analysis:

```json
{
  "trace": {
    "traceId": "abc123",
    "spanMapping": {
      "span-456": "mcp-bridge:express-server",
      "span-789": "mcp-bridge:theme-update-route"
    },
    "errorSpan": "span-789"
  }
}
```

### Composition

Explanations that include other explanations:

```json
{
  "includes": [
    { "ref": "explorations/auth-basics.json", "as": "prerequisite" },
    { "ref": "explorations/ipc-overview.json", "as": "context" }
  ]
}
```

---

## Focus / Annotation Types

| Type | Purpose | Visual Treatment |
|------|---------|------------------|
| `existing` | Relevant existing elements | Standard highlight |
| `modified` | Changed in this context | Yellow/amber |
| `added` | New elements (proposed or actual) | Green |
| `removed` | Deleted elements | Red/strikethrough |
| `error` | Failure point | Red pulse |
| `current` | Current step in flow | Bright highlight |

---

## Open Questions

### Rendering

- Multi-canvas view: side-by-side, tabbed, or transition-based?
- How to handle proposed elements that don't exist in canvas?
- Animation for journey/flow walkthroughs?

### Authoring

- Should agents generate these or just populate templates?
- How to validate refs against actual canvas contents?
- Versioning: what happens when canvases change?

### Integration

- How do these relate to existing workflow scenarios?
- Can scenarios reference explanation documents?
- Should this format replace or supplement existing markdown docs?

### Discovery

- How does an agent know which canvases exist?
- Index of entities across canvases?
- Search/query interface for finding relevant canvases?

---

## Future Considerations

- **Test Plan Visualization** - Map test coverage onto canvas flows
- **Performance Profiling** - Overlay timing data onto diagrams
- **Feature Flags** - Show which paths are gated
- **API Surface** - Filtered view of public entry points
- **Change History** - Canvas diffs over time (git integration)

---

## Related Files

- `.principal-views/principal-mcp-bridge/principal-mcp-bridge.otel.canvas` - Example canvas
- `.principal-views/principal-mcp-bridge/dependency-resolution.workflow.json` - Example workflow
- `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` - Canvas rendering infrastructure
