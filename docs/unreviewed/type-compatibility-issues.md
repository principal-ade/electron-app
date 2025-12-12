# Type Compatibility Issues

This document outlines known TypeScript type mismatches in the codebase and recommended fixes.

## Overview

The codebase currently has **210 type errors** that fall into three main categories:
1. Terminal type mismatches (`TerminalInfo` vs `TerminalSessionInfo`)
2. Theme property mismatches (`colorMode`, `modes`, `hover`)
3. Worker thread types (`MessagePort`, `parentPort`)

---

## 1. Terminal Type Mismatches

### Problem

The application has two incompatible terminal session types:

**Local `TerminalInfo`** (defined in `src/shared/main-process-api-interfaces/TerminalService.ts`):
```typescript
interface TerminalInfo {
  id: string;
  directory: string;        // ← Different from cwd
  context?: string;
  agentSessionId?: string;
  createdAt: number;
  lastActivity: number;
  status: 'active' | 'disconnected';  // ← Extra field
  ownedByWindowId?: number;
  ownershipClaimedAt?: number;
}
```

**External `TerminalSessionInfo`** (from `@industry-theme/terminal-panel`):
```typescript
interface TerminalSessionInfo {
  id: string;
  pid: number;              // ← Missing in TerminalInfo
  cwd: string;              // ← Different from directory
  shell: string;            // ← Missing in TerminalInfo
  createdAt: number;
  lastActivity: number;
  repositoryPath?: string;
  context?: string;
}
```

### Affected Files

| File | Error |
|------|-------|
| `src/renderer/alexandria-workspace/AlexandriaWorkspaceLayout.tsx:275` | `ExtendedPanelActions` not assignable to `TerminalPanelActions` |
| `src/renderer/contexts/PanelContext.tsx:467` | `listTerminalSessions()` return type mismatch |
| `src/renderer/contexts/RepositoryPanelContext.tsx:192` | Actions type mismatch |
| `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx:91,99` | `RepositoryPanelActions` not assignable to `TerminalActions` |

### Root Cause

The `@industry-theme/terminal-panel` package expects `TerminalSessionInfo` with `pid`, `cwd`, and `shell` fields, but the local `TerminalInfo` type uses `directory` and `status` instead.

### Recommended Fix

**Option A: Extend local type to include external fields**
```typescript
// In src/shared/main-process-api-interfaces/TerminalService.ts
export interface TerminalInfo {
  id: string;
  directory: string;
  cwd: string;           // Add alias for directory
  pid: number;           // Add process ID
  shell: string;         // Add shell path
  context?: string;
  agentSessionId?: string;
  createdAt: number;
  lastActivity: number;
  status: 'active' | 'disconnected';
  ownedByWindowId?: number;
  ownershipClaimedAt?: number;
}
```

**Option B: Create adapter function**
```typescript
function toTerminalSessionInfo(info: TerminalInfo): TerminalSessionInfo {
  return {
    id: info.id,
    pid: info.ownedByWindowId ?? 0,  // or fetch actual PID
    cwd: info.directory,
    shell: process.env.SHELL ?? '/bin/bash',
    createdAt: info.createdAt,
    lastActivity: info.lastActivity,
    context: info.context,
  };
}
```

---

## 2. Theme Property Mismatches

### Problem

Components are using theme properties that don't exist in the current `ThemeContextValue` type from `@principal-ade/industry-theme`.

### Missing Properties

| Property | Used For | Example Usage |
|----------|----------|---------------|
| `colorMode` | Detecting dark/light mode | `const { theme, colorMode } = useTheme()` |
| `theme.colors.modes` | Mode-specific color overrides | `theme.colors.modes?.dark?.backgroundSecondary` |
| `theme.colors.hover` | Hover state colors | `theme.colors.hover` |
| `theme.colors.danger` | Danger/destructive colors | `theme.colors.danger` |

### Affected Files

| File | Line | Missing Property |
|------|------|------------------|
| `src/renderer/components/GitChanges/GitChangesDropdown.tsx` | 27 | `colorMode` |
| `src/renderer/components/Titlebar/BaseTitlebar.tsx` | 45, 60, 66 | `colorMode`, `modes` |
| `src/renderer/components/Titlebar/ThemeCustomizationButton.tsx` | 11, 48, 84 | `colorMode`, `modes`, `hover` |
| `src/renderer/components/Titlebar/ThemeDropdown.tsx` | 12, 61, 67, 106, 145, 162 | `colorMode`, `modes`, `hover` |
| `src/renderer/components/Titlebar/TitlebarButton.tsx` | 26 | `colorMode` |
| `src/renderer/components/Titlebar/TitlebarGitChanges.tsx` | 22 | `colorMode` |
| `src/renderer/components/Titlebar/WorkspaceThemeDropdown.tsx` | 19, 55, 67, 73, 111, 151, 168 | `colorMode`, `modes`, `hover` |
| `src/renderer/pages/CustomTitlebar/CustomTitlebar.tsx` | 30, 49, 56, 186 | `colorMode`, `modes` |
| `src/renderer/components/agent-overview/SegmentSummary.tsx` | 302 | `danger` |

### Root Cause

The `@principal-ade/industry-theme` package's `ThemeContextValue` type doesn't expose `colorMode` or nested color modes. Either:
1. The package needs to be updated to export these properties
2. The components are using an outdated API pattern

### Recommended Fix

**Option A: Request package update**

The `@principal-ade/industry-theme` package should export:
```typescript
interface ThemeContextValue {
  theme: Theme;
  colorMode: 'light' | 'dark';
  setColorMode: (mode: 'light' | 'dark') => void;
}

interface ThemeColors {
  // ... existing colors ...
  modes?: {
    light?: Partial<ThemeColors>;
    dark?: Partial<ThemeColors>;
  };
  hover?: string;
  danger?: string;
}
```

**Option B: Create local type augmentation**
```typescript
// In src/types/theme-augmentation.d.ts
import '@principal-ade/industry-theme';

declare module '@principal-ade/industry-theme' {
  interface ThemeContextValue {
    colorMode: 'light' | 'dark';
  }

  interface ThemeColors {
    modes?: {
      light?: Partial<ThemeColors>;
      dark?: Partial<ThemeColors>;
    };
    hover?: string;
    danger?: string;
  }
}
```

**Option C: Use fallback patterns**
```typescript
// Instead of:
const { theme, colorMode } = useTheme();

// Use:
const { theme } = useTheme();
const colorMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// Instead of:
theme.colors.modes?.dark?.backgroundSecondary

// Use:
theme.colors.backgroundSecondary // Let the theme provider handle mode switching
```

---

## 3. Worker Thread Types

### Problem

The PTY worker (`src/main/terminal/phase2-future/worker/ptyWorker.ts`) uses Worker Threads API types that aren't properly imported or configured.

### Missing Types/Imports

| Symbol | Issue | Location |
|--------|-------|----------|
| `parentPort` | Not imported from `worker_threads` | Lines 39, 40, 249, 250 |
| `MessagePort` | Used as type but refers to value | Lines 55, 250 |
| `WorkerSessionInfo` | Not imported (defined in `types.ts`) | Line 29 |
| `PtyDataMessage` | Not imported (defined in `types.ts`) | Line 124 |
| `RendererPortMessage` | Not imported (defined in `types.ts`) | Line 149 |

### Affected Files

| File | Lines | Issue |
|------|-------|-------|
| `src/main/terminal/phase2-future/worker/ptyWorker.ts` | 29, 39, 40, 55, 124, 145, 149, 249, 250 | Missing imports |
| `src/main/terminal/phase2-future/worker/types.ts` | 83 | `MessagePort` type usage |
| `src/shared/main-process-api-interfaces/TerminalService.ts` | 117 | `MessagePort` type usage |
| `src/window/main-process-api-implementations/terminalApi.ts` | 12, 210 | `MessagePort` type usage |

### Root Cause

1. **Missing imports**: The worker file doesn't import `parentPort` from Node.js `worker_threads` module
2. **Type vs Value confusion**: `MessagePort` is used as a type annotation, but TypeScript sees it as the runtime value

### Recommended Fix

**For `parentPort` and worker_threads:**
```typescript
// At the top of ptyWorker.ts
import { parentPort, MessagePort as WorkerMessagePort } from 'worker_threads';

// Note: Electron's utilityProcess uses process.parentPort, not worker_threads
// Check if this file is meant for utilityProcess or worker_threads
```

**For `MessagePort` type issues:**
```typescript
// Option A: Import the type
import type { MessagePort } from 'worker_threads';

// Option B: Use the DOM MessagePort type (for renderer process)
// This is automatically available in browser contexts

// Option C: Use typeof
function handlePort(port: typeof globalThis.MessagePort) {
  // ...
}
```

**Add missing type imports:**
```typescript
// In ptyWorker.ts, update the import:
import {
  WorkerControlMessage,
  WorkerEventMessage,
  WorkerSessionInfo,    // Add this
  PtyDataMessage,       // Add this
  RendererPortMessage,  // Add this
} from './types';
```

---

## Summary of Required Changes

### High Priority (Breaking Functionality)

1. **Terminal Types**: Align `TerminalInfo` with `TerminalSessionInfo` or create adapters
2. **Worker Imports**: Add missing imports in `ptyWorker.ts`

### Medium Priority (Type Safety)

3. **Theme Types**: Either update `@principal-ade/industry-theme` or add type augmentations
4. **MessagePort Types**: Use correct type imports based on context (Node.js vs DOM)

### Low Priority (Cleanup)

5. **Consistent naming**: Standardize on either `cwd` or `directory` across the codebase
6. **Type exports**: Ensure all types in `types.ts` are properly exported and imported

---

## Related Files

- `src/shared/main-process-api-interfaces/TerminalService.ts` - Local terminal types
- `src/main/terminal/phase2-future/worker/types.ts` - Worker message types
- `src/main/terminal/phase2-future/worker/ptyWorker.ts` - PTY worker implementation
- `node_modules/@industry-theme/terminal-panel/dist/types/index.ts` - External terminal types
- `node_modules/@principal-ade/industry-theme/` - Theme package
