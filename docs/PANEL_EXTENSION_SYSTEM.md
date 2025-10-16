# Panel Extension System Design

## Executive Summary

This document outlines the design for transforming the current hardcoded panel system into an extensible architecture that supports third-party panel extensions. The goal is to enable developers to create custom panels that integrate seamlessly with the repository workspace while maintaining backward compatibility with existing built-in panels.

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Design Goals](#design-goals)
3. [Proposed Architecture](#proposed-architecture)
4. [Extension API](#extension-api)
5. [Migration Strategy](#migration-strategy)
6. [Implementation Phases](#implementation-phases)
7. [Security Considerations](#security-considerations)
8. [Developer Experience](#developer-experience)

---

## Current Architecture Analysis

### Panel Registration System

The current system has **four key components**:

#### 1. **Panel Catalog** (`src/shared/panels/repositoryPanelCatalog.ts`)
```typescript
export const repositoryPanelCatalog = [
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Project notes and TODOs...',
    slices: ['markdown'] as const,
    surfaces: ['explorer'] as const,
  },
  // ... more panels
]
```
- Defines **metadata** for each panel
- Specifies **surfaces** (where panels appear: 'explorer', 'manager', 'agent', 'viewer', 'excalidraw')
- Defines **slices** (data requirements: 'git', 'markdown', 'fileTree', 'packages', 'quality')

#### 2. **Panel Previews** (`src/renderer/panels/panelPreviews.tsx`)
```typescript
export const panelPreviewRegistry: Record<string, PanelPreviewMetadata> = {
  tasks: {
    icon: <ListTodo size={16} />,
    preview: <TasksPanelPreview />,
    label: 'Tasks',
    description: 'Track repository TODOs...',
  },
}
```
- Provides **icons** (Lucide React components)
- Supplies **preview components** for panel configurator UI
- Optional **labels** and **descriptions**

#### 3. **Panel Registry** (`src/renderer/panels/registry.tsx`)
```typescript
const panelRenderers: Partial<Record<RepositoryPanelId, RepositoryPanelRenderer>> = {
  gitChanges: ({ actions }) => <GitChangesPanel onFileClick={actions.openFile} />,
  // ... more renderers
}
```
- Maps panel IDs to **render functions**
- Receives **context** (repository data) and **actions** (callbacks)
- Provides panel implementation

#### 4. **Workspace Integration** (`src/renderer/repo-manager/RepositoryWorkspace.tsx`)
```typescript
const panelContentMap = React.useMemo(() => ({
  tasks: (
    <RepositoryPanelProvider
      repositoryPath={repositoryPath}
      actions={{ openFile: handleSearchFileSelect }}
    >
      <TasksPanel onTaskClick={handleTaskClick} />
    </RepositoryPanelProvider>
  ),
  // ... more panels
}), [dependencies])
```
- Creates **concrete instances** with specific props
- Wraps panels in **RepositoryPanelProvider** for data access
- Manages **panel lifecycle** and **state**

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Panel Catalog (Metadata)                                    │
│  - ID, label, description                                    │
│  - Surfaces, slices, default location                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Panel Previews (Visual Metadata)                            │
│  - Icons, preview components                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Panel Registry (Implementation)                             │
│  - Render functions receiving context + actions              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Workspace Integration (Instantiation)                       │
│  - Wraps in RepositoryPanelProvider                          │
│  - Passes specific props and callbacks                       │
└─────────────────────────────────────────────────────────────┘
```

### Current Strengths

✅ **Type Safety**: Strong TypeScript typing throughout
✅ **Context Provider**: Centralized data access via `RepositoryPanelProvider`
✅ **Separation of Concerns**: Metadata, visuals, and implementation separated
✅ **Flexible Layout**: Supports tabs, single panels, and complex layouts
✅ **Data Slices**: Clear data dependencies via slice system

### Current Limitations

❌ **Hardcoded Registration**: All panels must be imported and registered in core files
❌ **No Dynamic Loading**: Cannot load panels at runtime
❌ **Tight Coupling**: Workspace component directly instantiates panels
❌ **No Versioning**: No extension API versioning
❌ **Limited Isolation**: Extensions can access full app context

---

## Design Goals

### Primary Goals

1. **Dynamic Registration**: Enable runtime registration of panels from external sources
2. **Backward Compatibility**: Maintain full compatibility with existing built-in panels
3. **Type Safety**: Preserve strong typing for extension developers
4. **Sandboxing**: Isolate extensions from core application state
5. **Developer Experience**: Provide clear, simple API for extension authors

### Non-Goals (Future Considerations)

- Cross-application extensions (panels that work across multiple apps)
- Native code execution in extensions
- Network-based extension distribution (marketplace)

---

## Proposed Architecture

### High-Level Overview

```
┌───────────────────────────────────────────────────────────────────┐
│  Extension Discovery Layer                                         │
│  - Scans extension directories                                     │
│  - Validates extension manifests                                   │
│  - Loads extension bundles                                         │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────────┐
│  Panel Extension Registry                                          │
│  - Built-in panels (static)                                        │
│  - External panels (dynamic)                                       │
│  - Provides unified API                                            │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────────┐
│  Extension Runtime Environment                                     │
│  - Sandboxed context API                                           │
│  - Action handlers                                                 │
│  - Lifecycle management                                            │
└──────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────────┐
│  Workspace Integration                                             │
│  - Renders panels from registry                                    │
│  - Manages panel state                                             │
│  - Handles errors gracefully                                       │
└───────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/
├── shared/
│   ├── panels/
│   │   ├── repositoryPanelCatalog.ts          # Built-in panel definitions
│   │   ├── extensionManifest.ts               # NEW: Extension manifest types
│   │   └── panelExtensionAPI.ts               # NEW: Public API types
│   └── extensions/
│       ├── ExtensionLoader.ts                 # NEW: Main process extension loader
│       └── ExtensionValidator.ts              # NEW: Manifest validation
├── renderer/
│   ├── panels/
│   │   ├── registry.tsx                       # Updated: Dynamic registry
│   │   ├── panelPreviews.tsx                  # Updated: Support dynamic previews
│   │   ├── ExtensionPanelWrapper.tsx          # NEW: Sandboxed panel wrapper
│   │   └── ExtensionPanelRuntime.tsx          # NEW: Extension runtime context
│   └── services/
│       └── PanelExtensionService.ts           # NEW: Renderer-side extension management
└── extensions/                                # NEW: Extensions directory
    └── [extension-name]/
        ├── manifest.json
        ├── index.js (or tsx)
        └── icon.svg (optional)
```

---

## Extension API

### Extension Manifest Schema

Every panel extension requires a `manifest.json`:

```json
{
  "name": "my-custom-panel",
  "version": "1.0.0",
  "displayName": "My Custom Panel",
  "description": "A custom panel for viewing data",
  "author": "Developer Name",
  "license": "MIT",

  "panel": {
    "id": "myCustomPanel",
    "label": "Custom Panel",
    "surfaces": ["explorer", "manager"],
    "slices": ["fileTree", "git"],
    "icon": "./icon.svg"
  },

  "apiVersion": "1.0",
  "permissions": [
    "filesystem:read",
    "git:status"
  ],

  "entry": "./index.js"
}
```

### Extension Entry Point

Extensions export a standard interface:

```typescript
// extensions/my-panel/index.tsx
import type { PanelExtension, PanelExtensionContext } from '@/shared/panels/panelExtensionAPI';

export const activate: PanelExtension = (context: PanelExtensionContext) => {
  return {
    // Panel component
    Panel: ({ repositoryPath, onFileClick }) => {
      return (
        <div>
          <h2>My Custom Panel</h2>
          {/* Panel content */}
        </div>
      );
    },

    // Preview component for configurator
    Preview: () => (
      <div>Panel preview</div>
    ),

    // Optional: Icon as React component
    Icon: () => <MyCustomIcon />,

    // Optional: Lifecycle hooks
    onActivate: () => {
      console.log('Panel activated');
    },

    onDeactivate: () => {
      console.log('Panel deactivated');
    },
  };
};
```

### Sandboxed Context API

Extensions receive a sandboxed context object:

```typescript
export interface PanelExtensionContext {
  // Panel metadata
  readonly panelId: string;
  readonly version: string;

  // Repository data (read-only)
  readonly repository: {
    path: string | null;
    fileTree: FileTree | null;
    gitStatus: GitStatus | null;
    packages: PackageLayer[] | null;
  };

  // Actions (limited, permission-based)
  actions: {
    openFile: (path: string) => void;
    openGitDiff: (path: string) => void;
    showNotification: (message: string, type: 'info' | 'warning' | 'error') => void;
  };

  // Storage API (scoped to extension)
  storage: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };

  // Theming
  theme: {
    colors: Record<string, string>;
    fontSizes: number[];
  };
}
```

### Panel Props Interface

Standardized props for all panels:

```typescript
export interface PanelExtensionProps {
  // Core props
  repositoryPath: string | null;
  isActive: boolean;
  isVisible: boolean;

  // Callbacks
  onFileClick?: (path: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;

  // Optional context (for advanced panels)
  context?: PanelExtensionContext;
}
```

---

## Migration Strategy

### Phase 1: Prepare Foundation (Non-Breaking)

**Goal**: Add extension infrastructure without changing existing code

**Tasks**:
1. Create extension manifest types
2. Create extension API types
3. Create `ExtensionLoader` service (no-op initially)
4. Add extension directory scanning
5. Create `ExtensionPanelWrapper` component
6. Add extension registry alongside existing registry

**Migration for built-in panels**: None required

---

### Phase 2: Migrate Built-In Panels (Internal Refactor)

**Goal**: Convert built-in panels to use extension API internally

**Tasks**:
1. Create manifest.json for each built-in panel (internal only)
2. Wrap built-in panels in `ExtensionPanelWrapper`
3. Update registry to use unified extension API
4. Test all existing panels work identically

**Migration for built-in panels**:
```typescript
// Before
const GitChangesPanel: React.FC<Props> = ({ onFileClick }) => { ... }

// After (still internal, but uses extension API)
const GitChangesPanel: React.FC<PanelExtensionProps> = ({ context, onFileClick }) => {
  // Can access context.repository, context.actions, etc.
  // But maintains backward compatibility via props
}
```

---

### Phase 3: Enable External Extensions

**Goal**: Allow loading of external panel extensions

**Tasks**:
1. Implement extension validation
2. Add permission system
3. Create extension development CLI/template
4. Add extension management UI
5. Document extension API

**Migration for external developers**:
- Follow extension API documentation
- Use provided template/starter kit

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

```typescript
// src/shared/extensions/extensionManifest.ts
export interface ExtensionManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  panel: {
    id: string;
    label: string;
    surfaces: RepositoryPanelSurface[];
    slices?: RepositoryPanelSlice[];
    icon?: string;
  };
  apiVersion: string;
  permissions: string[];
  entry: string;
}

// src/shared/extensions/ExtensionLoader.ts
export class ExtensionLoader {
  private extensions = new Map<string, LoadedExtension>();

  async loadExtensions(extensionDirs: string[]): Promise<void> {
    for (const dir of extensionDirs) {
      const manifest = await this.loadManifest(dir);
      if (this.validateManifest(manifest)) {
        const extension = await this.loadExtension(dir, manifest);
        this.extensions.set(manifest.panel.id, extension);
      }
    }
  }

  getExtension(id: string): LoadedExtension | undefined {
    return this.extensions.get(id);
  }

  getAllExtensions(): LoadedExtension[] {
    return Array.from(this.extensions.values());
  }
}
```

### Phase 2: Runtime Wrapper (Week 2-3)

```typescript
// src/renderer/panels/ExtensionPanelWrapper.tsx
export const ExtensionPanelWrapper: React.FC<{
  extensionId: string;
  props: PanelExtensionProps;
}> = ({ extensionId, props }) => {
  const [error, setError] = useState<Error | null>(null);
  const extension = usePanelExtension(extensionId);

  const context = useMemo(() =>
    createSandboxedContext(extensionId, props),
    [extensionId, props]
  );

  if (error) {
    return <PanelErrorBoundary error={error} extensionId={extensionId} />;
  }

  if (!extension) {
    return <PanelLoadingState />;
  }

  const PanelComponent = extension.Panel;

  return (
    <ErrorBoundary onError={setError}>
      <PanelComponent {...props} context={context} />
    </ErrorBoundary>
  );
};
```

### Phase 3: Dynamic Registry (Week 3-4)

```typescript
// src/renderer/panels/registry.tsx (updated)
export class PanelExtensionRegistry {
  private static builtInPanels = repositoryPanelCatalog;
  private static externalPanels = new Map<string, ExtensionPanel>();

  static registerExtension(panel: ExtensionPanel): void {
    this.externalPanels.set(panel.id, panel);
  }

  static getAllPanels(): RepositoryPanelDefinition[] {
    return [
      ...this.builtInPanels.map(this.wrapBuiltInPanel),
      ...Array.from(this.externalPanels.values()).map(this.wrapExtensionPanel),
    ];
  }

  private static wrapExtensionPanel(panel: ExtensionPanel): RepositoryPanelDefinition {
    return {
      id: panel.id,
      label: panel.label,
      description: panel.description,
      surfaces: panel.surfaces,
      slices: panel.slices,
      render: (props) => (
        <ExtensionPanelWrapper
          extensionId={panel.id}
          props={props}
        />
      ),
    };
  }
}
```

### Phase 4: Extension Management UI (Week 4-5)

Create extension management interface:
- List installed extensions
- Enable/disable extensions
- View extension details
- Install from directory
- Uninstall extensions

---

## Security Considerations

### Permission System

Extensions must declare permissions in manifest:

```json
{
  "permissions": [
    "filesystem:read",      // Read files from repository
    "filesystem:write",     // Write files to repository
    "git:status",           // Read git status
    "git:commit",           // Create git commits
    "network:fetch",        // Make HTTP requests
    "storage:local"         // Use local storage
  ]
}
```

### Sandboxing Strategy

1. **Context Isolation**: Extensions only access data through context API
2. **No Direct Imports**: Cannot import from core app
3. **Permission Checks**: All actions validated against declared permissions
4. **Error Boundaries**: Errors contained to individual panels
5. **Resource Limits**: Memory and execution time limits

### Validation

Before loading, validate:
- ✅ Manifest schema is valid
- ✅ API version is supported
- ✅ Permissions are recognized
- ✅ Entry point exists
- ✅ Code is properly bundled
- ✅ No malicious patterns detected

---

## Developer Experience

### Extension Development Flow

```bash
# 1. Create extension from template
npx create-panel-extension my-panel

# 2. Develop with hot reload
cd my-panel
npm run dev

# 3. Build for distribution
npm run build

# 4. Test in app
npm run link  # Symlinks to app's extension directory

# 5. Package for sharing
npm run package  # Creates .panel-extension file
```

### Extension Template Structure

```
my-panel/
├── manifest.json
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx          # Entry point
│   ├── Panel.tsx          # Main panel component
│   ├── Preview.tsx        # Preview component
│   └── Icon.tsx           # Icon component
├── types/
│   └── panel-api.d.ts     # Auto-generated API types
└── README.md
```

### VS Code Integration

Provide extension development tools:
- Extension manifest schema for autocompletion
- TypeScript types for panel API
- Snippet library for common patterns
- Debug configuration for extension development

---

## Example: Converting TasksPanel

### Current Implementation

```typescript
// src/renderer/panels/components/TasksPanel.tsx
export const TasksPanel: React.FC<TasksPanelProps> = ({
  repositoryPath,
  onTaskClick,
}) => {
  // Implementation
};
```

### As Extension

```typescript
// extensions/tasks-panel/src/index.tsx
import type { PanelExtension } from '@/shared/panels/panelExtensionAPI';

export const activate: PanelExtension = (context) => {
  return {
    Panel: ({ isActive, isVisible }) => {
      const { repository, actions } = context;

      return (
        <div>
          <h2>Tasks for {repository.path}</h2>
          {/* Same component logic */}
        </div>
      );
    },

    Preview: () => <TasksPanelPreview />,

    Icon: () => <ListTodo size={16} />,
  };
};
```

```json
// extensions/tasks-panel/manifest.json
{
  "name": "tasks-panel",
  "version": "1.0.0",
  "displayName": "Tasks Panel",
  "description": "Track repository TODOs and tasks",
  "panel": {
    "id": "tasks",
    "label": "Tasks",
    "surfaces": ["explorer", "manager"],
    "slices": ["markdown"]
  },
  "apiVersion": "1.0",
  "permissions": ["filesystem:read", "storage:local"],
  "entry": "./dist/index.js"
}
```

---

## Backward Compatibility Strategy

### Built-In Panels

All existing panels continue to work without modification:
- Keep current registration system
- Run alongside extension system
- Gradually migrate to extension API internally
- No breaking changes to existing code

### Deprecation Path

1. **Phase 1-2**: Both systems coexist
2. **Phase 3**: Built-in panels use extension API internally
3. **Phase 4**: (Future) Consider making all panels extensions

---

## Success Metrics

### Technical Metrics
- ✅ Zero breaking changes to existing panels
- ✅ Extension load time < 100ms
- ✅ Panel render performance same as built-in
- ✅ Memory overhead < 5MB per extension

### Developer Metrics
- ✅ Extension API documented
- ✅ Template/starter kit available
- ✅ < 30 minutes to create first extension
- ✅ TypeScript types for full API

---

## Open Questions

1. **Extension Distribution**: How will users discover and install extensions?
2. **Versioning**: How to handle API version compatibility?
3. **Dependencies**: Can extensions depend on each other?
4. **Hot Reload**: Should extensions support hot reload during development?
5. **Native Code**: Do we need to support native node modules in extensions?

---

## Next Steps

1. **Review & Approve**: Get stakeholder buy-in on architecture
2. **Prototype**: Build minimal proof-of-concept
3. **Implement Phase 1**: Create foundation without breaking changes
4. **Test Migration**: Convert one built-in panel as proof
5. **Document API**: Write comprehensive extension development guide
6. **Iterate**: Gather feedback and refine approach

---

## Appendix A: Extension Manifest JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "version", "panel", "apiVersion", "entry"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique extension identifier"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version"
    },
    "displayName": {
      "type": "string",
      "description": "Human-readable name"
    },
    "description": {
      "type": "string",
      "description": "Short description of the panel"
    },
    "author": {
      "type": "string",
      "description": "Extension author"
    },
    "license": {
      "type": "string",
      "description": "License identifier (SPDX)"
    },
    "panel": {
      "type": "object",
      "required": ["id", "label"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9]+$",
          "description": "Unique panel ID"
        },
        "label": {
          "type": "string",
          "description": "Display label"
        },
        "surfaces": {
          "type": "array",
          "items": {
            "enum": ["explorer", "manager", "viewer", "agent", "excalidraw"]
          },
          "description": "Surfaces where panel appears"
        },
        "slices": {
          "type": "array",
          "items": {
            "enum": ["git", "markdown", "fileTree", "packages", "quality"]
          },
          "description": "Required data slices"
        },
        "icon": {
          "type": "string",
          "description": "Path to icon file"
        }
      }
    },
    "apiVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+$",
      "description": "Required API version"
    },
    "permissions": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+:[a-z]+$"
      },
      "description": "Required permissions"
    },
    "entry": {
      "type": "string",
      "description": "Entry point file path"
    }
  }
}
```

---

## Appendix B: Full TypeScript API Definitions

```typescript
// src/shared/panels/panelExtensionAPI.ts

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { GitStatus } from '../types/repository.types';

export interface PanelExtensionContext {
  readonly panelId: string;
  readonly version: string;

  readonly repository: {
    readonly path: string | null;
    readonly fileTree: FileTree | null;
    readonly gitStatus: GitStatus | null;
    readonly packages: PackageLayer[] | null;
    readonly markdownFiles: Array<{ path: string; title?: string }>;
  };

  actions: {
    openFile: (path: string) => void;
    openGitDiff: (path: string, status?: GitChangeSelectionStatus) => void;
    showNotification: (message: string, type: 'info' | 'warning' | 'error') => void;
    requestRefresh: () => Promise<void>;
  };

  storage: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };

  theme: {
    colors: Record<string, string>;
    fontSizes: number[];
  };

  permissions: {
    has: (permission: string) => boolean;
    request: (permission: string) => Promise<boolean>;
  };
}

export interface PanelExtensionProps {
  repositoryPath: string | null;
  isActive: boolean;
  isVisible: boolean;
  onFileClick?: (path: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
  context?: PanelExtensionContext;
}

export interface PanelExtensionResult {
  Panel: React.ComponentType<PanelExtensionProps>;
  Preview: React.ComponentType;
  Icon?: React.ComponentType;

  onActivate?: () => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
  onRepositoryChange?: (path: string | null) => void | Promise<void>;
}

export type PanelExtension = (
  context: PanelExtensionContext
) => PanelExtensionResult | Promise<PanelExtensionResult>;

export interface ExtensionManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;
  license: string;

  panel: {
    id: string;
    label: string;
    surfaces: RepositoryPanelSurface[];
    slices?: RepositoryPanelSlice[];
    icon?: string;
  };

  apiVersion: string;
  permissions: string[];
  entry: string;

  repository?: {
    type: 'git';
    url: string;
  };

  bugs?: {
    url: string;
  };

  homepage?: string;
}

export interface LoadedExtension {
  manifest: ExtensionManifest;
  activate: PanelExtension;
  path: string;
  enabled: boolean;
}
```

---

*Document Version: 1.0*
*Last Updated: 2025-01-XX*
*Status: Draft - Awaiting Review*
