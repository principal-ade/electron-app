# Git Hooks Panel - Design Document

## Overview

A panel system for viewing, managing, and creating git hooks within repositories. This provides visibility into git automation and enables users to understand what hooks are configured and when they execute.

**Status**: 📝 Design Phase
**Priority**: Medium
**Complexity**: Medium (3-5 hours initial implementation)

---

## Problem Statement

Currently, users have no visibility into:
- Which git hooks are installed in their repositories
- Whether hooks are enabled (executable) or disabled
- What hooks do or when they execute
- How to create or edit hooks without leaving the app

Additionally, we cannot detect git push events because git has no client-side `post-push` hook. A git hooks panel would help users:
1. Understand what automation exists in their repos
2. Create custom hooks (like a post-push notification to our app)
3. Debug hook failures
4. Share hooks across team members

---

## Architecture

### Following Existing IPC Conventions

**Convention Note**: This implementation follows the established IPC communication pattern used throughout the codebase. Reference implementations:
- `GitAPI` (src/shared/main-process-api-interfaces/GitAPI.ts)
- `GitService` (src/renderer/main-process-api/GitService.ts)
- `GitRemoteService` (src/repository-monitoring-server/GitRemoteService.ts)

### Layer Architecture

```
┌─────────────────────────────────────────────────┐
│  Renderer: GitHooksPanel.tsx                    │
│  - React component                              │
│  - Displays hooks list                          │
│  - Handles user interactions                    │
└─────────────────┬───────────────────────────────┘
                  │ calls
┌─────────────────▼───────────────────────────────┐
│  Renderer Service: GitHooksService.ts           │
│  - Static methods                               │
│  - Wraps window.mainProcess.gitHooks            │
└─────────────────┬───────────────────────────────┘
                  │ IPC
┌─────────────────▼───────────────────────────────┐
│  IPC Interface: GitHooksAPI.ts                  │
│  - Event enum (GitHooksAPIEvents)               │
│  - Interface definition (GitHooksAPI)           │
│  - Type definitions                             │
└─────────────────┬───────────────────────────────┘
                  │ implements
┌─────────────────▼───────────────────────────────┐
│  Preload: gitHooksApi.ts                        │
│  - ipcRenderer.invoke() wrappers                │
│  - Event listeners                              │
└─────────────────┬───────────────────────────────┘
                  │ IPC
┌─────────────────▼───────────────────────────────┐
│  Main Process: GitHooksHandler.ts               │
│  - ipcMain.handle() implementations             │
│  - File system operations                       │
│  - Git operations via GitCore                   │
└─────────────────────────────────────────────────┘
```

---

## Data Types

### Core Types

```typescript
// src/shared/types/git-hooks.types.ts

/**
 * Standard git hooks with execution timing
 */
export type GitHookName =
  // Commit workflow
  | 'pre-commit'
  | 'prepare-commit-msg'
  | 'commit-msg'
  | 'post-commit'
  // Remote operations
  | 'pre-push'
  | 'pre-receive'     // Server-side
  | 'update'          // Server-side
  | 'post-receive'    // Server-side
  | 'post-update'     // Server-side
  // Other operations
  | 'pre-rebase'
  | 'post-rewrite'
  | 'post-checkout'
  | 'post-merge'
  | 'pre-auto-gc'
  | 'post-index-change'
  | 'fsmonitor-watchman';

/**
 * Hook execution context
 */
export type GitHookPhase = 'pre' | 'post' | 'prepare';

/**
 * Hook category for UI organization
 */
export type GitHookCategory =
  | 'commit'
  | 'push'
  | 'rebase'
  | 'merge'
  | 'checkout'
  | 'other';

/**
 * Information about a single git hook
 */
export interface GitHookInfo {
  name: GitHookName;
  description: string;
  category: GitHookCategory;
  phase: GitHookPhase;
  exists: boolean;
  enabled: boolean;
  size?: number;
  lastModified?: string;
  content?: string; // Only populated when explicitly requested
  isServerSide: boolean;
  canAbort: boolean; // Whether hook can prevent git operation
}

/**
 * Hook template for creating new hooks
 */
export interface GitHookTemplate {
  name: GitHookName;
  description: string;
  content: string;
  language: 'bash' | 'javascript' | 'python';
}

/**
 * Result of hook operation
 */
export interface GitHookOperationResult {
  success: boolean;
  error?: string;
  hookName?: GitHookName;
}

/**
 * Complete hooks status for a repository
 */
export interface GitHooksStatus {
  repoPath: string;
  hooksDir: string;
  hooks: GitHookInfo[];
  customHooks: string[]; // Non-standard hooks
  hasHooksDir: boolean;
  lastScanned: number;
}
```

---

## IPC API Design

### API Interface

```typescript
// src/shared/main-process-api-interfaces/GitHooksAPI.ts

import type {
  GitHookInfo,
  GitHookName,
  GitHooksStatus,
  GitHookTemplate,
  GitHookOperationResult,
} from '../types/git-hooks.types';

export enum GitHooksAPIEvents {
  // Query operations
  GET_HOOKS_STATUS = 'gitHooks:getHooksStatus',
  GET_HOOK_INFO = 'gitHooks:getHookInfo',
  GET_HOOK_CONTENT = 'gitHooks:getHookContent',

  // Mutation operations
  CREATE_HOOK = 'gitHooks:createHook',
  UPDATE_HOOK = 'gitHooks:updateHook',
  DELETE_HOOK = 'gitHooks:deleteHook',
  ENABLE_HOOK = 'gitHooks:enableHook',
  DISABLE_HOOK = 'gitHooks:disableHook',

  // Templates
  GET_TEMPLATES = 'gitHooks:getTemplates',

  // Events
  HOOKS_CHANGED = 'gitHooks:hooksChanged',
}

export interface GitHooksAPI {
  /**
   * Get complete hooks status for a repository
   */
  getHooksStatus: (repoPath: string) => Promise<GitHooksStatus>;

  /**
   * Get information about a specific hook
   */
  getHookInfo: (
    repoPath: string,
    hookName: GitHookName,
  ) => Promise<GitHookInfo | null>;

  /**
   * Get the content of a hook file
   */
  getHookContent: (
    repoPath: string,
    hookName: GitHookName,
  ) => Promise<string | null>;

  /**
   * Create a new hook from template or content
   */
  createHook: (
    repoPath: string,
    hookName: GitHookName,
    content: string,
  ) => Promise<GitHookOperationResult>;

  /**
   * Update existing hook content
   */
  updateHook: (
    repoPath: string,
    hookName: GitHookName,
    content: string,
  ) => Promise<GitHookOperationResult>;

  /**
   * Delete a hook
   */
  deleteHook: (
    repoPath: string,
    hookName: GitHookName,
  ) => Promise<GitHookOperationResult>;

  /**
   * Enable hook (make executable)
   */
  enableHook: (
    repoPath: string,
    hookName: GitHookName,
  ) => Promise<GitHookOperationResult>;

  /**
   * Disable hook (remove executable bit)
   */
  disableHook: (
    repoPath: string,
    hookName: GitHookName,
  ) => Promise<GitHookOperationResult>;

  /**
   * Get available hook templates
   */
  getTemplates: () => Promise<GitHookTemplate[]>;

  /**
   * Listen for hook changes in any repository
   */
  onHooksChanged: (
    callback: (status: GitHooksStatus) => void,
  ) => () => void;
}
```

### Renderer Service

```typescript
// src/renderer/main-process-api/GitHooksService.ts

import type {
  GitHookInfo,
  GitHookName,
  GitHooksStatus,
  GitHookTemplate,
  GitHookOperationResult,
} from '../../shared/types/git-hooks.types';

export class GitHooksService {
  static async getHooksStatus(repoPath: string): Promise<GitHooksStatus> {
    return window.mainProcess.gitHooks.getHooksStatus(repoPath);
  }

  static async getHookInfo(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<GitHookInfo | null> {
    return window.mainProcess.gitHooks.getHookInfo(repoPath, hookName);
  }

  static async getHookContent(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<string | null> {
    return window.mainProcess.gitHooks.getHookContent(repoPath, hookName);
  }

  static async createHook(
    repoPath: string,
    hookName: GitHookName,
    content: string,
  ): Promise<GitHookOperationResult> {
    return window.mainProcess.gitHooks.createHook(repoPath, hookName, content);
  }

  static async updateHook(
    repoPath: string,
    hookName: GitHookName,
    content: string,
  ): Promise<GitHookOperationResult> {
    return window.mainProcess.gitHooks.updateHook(repoPath, hookName, content);
  }

  static async deleteHook(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<GitHookOperationResult> {
    return window.mainProcess.gitHooks.deleteHook(repoPath, hookName);
  }

  static async enableHook(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<GitHookOperationResult> {
    return window.mainProcess.gitHooks.enableHook(repoPath, hookName);
  }

  static async disableHook(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<GitHookOperationResult> {
    return window.mainProcess.gitHooks.disableHook(repoPath, hookName);
  }

  static async getTemplates(): Promise<GitHookTemplate[]> {
    return window.mainProcess.gitHooks.getTemplates();
  }

  static onHooksChanged(
    callback: (status: GitHooksStatus) => void,
  ): () => void {
    return window.mainProcess.gitHooks.onHooksChanged(callback);
  }
}
```

---

## Main Process Implementation

### Handler Structure

```typescript
// src/main/git-hooks/GitHooksHandler.ts

import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GitHooksAPIEvents } from '../../shared/main-process-api-interfaces/GitHooksAPI';
import type {
  GitHookInfo,
  GitHookName,
  GitHooksStatus,
  GitHookTemplate,
  GitHookOperationResult,
} from '../../shared/types/git-hooks.types';
import { STANDARD_HOOKS } from './standardHooks';
import { HOOK_TEMPLATES } from './templates';

class GitHooksHandler {
  private rendererWindows: Set<BrowserWindow> = new Set();

  constructor() {
    this.setupIPCHandlers();
  }

  private setupIPCHandlers() {
    ipcMain.handle(
      GitHooksAPIEvents.GET_HOOKS_STATUS,
      async (_event, repoPath: string) => this.getHooksStatus(repoPath),
    );

    ipcMain.handle(
      GitHooksAPIEvents.GET_HOOK_INFO,
      async (_event, repoPath: string, hookName: GitHookName) =>
        this.getHookInfo(repoPath, hookName),
    );

    ipcMain.handle(
      GitHooksAPIEvents.GET_HOOK_CONTENT,
      async (_event, repoPath: string, hookName: GitHookName) =>
        this.getHookContent(repoPath, hookName),
    );

    ipcMain.handle(
      GitHooksAPIEvents.CREATE_HOOK,
      async (_event, repoPath: string, hookName: GitHookName, content: string) =>
        this.createHook(repoPath, hookName, content),
    );

    ipcMain.handle(
      GitHooksAPIEvents.UPDATE_HOOK,
      async (_event, repoPath: string, hookName: GitHookName, content: string) =>
        this.updateHook(repoPath, hookName, content),
    );

    ipcMain.handle(
      GitHooksAPIEvents.DELETE_HOOK,
      async (_event, repoPath: string, hookName: GitHookName) =>
        this.deleteHook(repoPath, hookName),
    );

    ipcMain.handle(
      GitHooksAPIEvents.ENABLE_HOOK,
      async (_event, repoPath: string, hookName: GitHookName) =>
        this.enableHook(repoPath, hookName),
    );

    ipcMain.handle(
      GitHooksAPIEvents.DISABLE_HOOK,
      async (_event, repoPath: string, hookName: GitHookName) =>
        this.disableHook(repoPath, hookName),
    );

    ipcMain.handle(
      GitHooksAPIEvents.GET_TEMPLATES,
      async () => this.getTemplates(),
    );
  }

  private async getHooksStatus(repoPath: string): Promise<GitHooksStatus> {
    const hooksDir = path.join(repoPath, '.git', 'hooks');

    try {
      await fs.access(hooksDir);
    } catch {
      return {
        repoPath,
        hooksDir,
        hooks: [],
        customHooks: [],
        hasHooksDir: false,
        lastScanned: Date.now(),
      };
    }

    // Read all files in hooks directory
    const files = await fs.readdir(hooksDir);

    // Process standard hooks
    const hooks: GitHookInfo[] = await Promise.all(
      STANDARD_HOOKS.map(async (hookDef) => {
        const hookPath = path.join(hooksDir, hookDef.name);
        const exists = files.includes(hookDef.name);

        let enabled = false;
        let size: number | undefined;
        let lastModified: string | undefined;

        if (exists) {
          try {
            const stats = await fs.stat(hookPath);
            enabled = (stats.mode & 0o111) !== 0; // Check executable bit
            size = stats.size;
            lastModified = stats.mtime.toISOString();
          } catch {
            // File exists but can't stat it
          }
        }

        return {
          ...hookDef,
          exists,
          enabled,
          size,
          lastModified,
        };
      }),
    );

    // Find custom hooks (non-standard)
    const standardHookNames = new Set(STANDARD_HOOKS.map(h => h.name));
    const customHooks = files.filter(
      (file) => !file.endsWith('.sample') && !standardHookNames.has(file),
    );

    return {
      repoPath,
      hooksDir,
      hooks,
      customHooks,
      hasHooksDir: true,
      lastScanned: Date.now(),
    };
  }

  private async getHookInfo(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<GitHookInfo | null> {
    const status = await this.getHooksStatus(repoPath);
    return status.hooks.find(h => h.name === hookName) || null;
  }

  private async getHookContent(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<string | null> {
    const hookPath = path.join(repoPath, '.git', 'hooks', hookName);

    try {
      return await fs.readFile(hookPath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async createHook(
    repoPath: string,
    hookName: GitHookName,
    content: string,
  ): Promise<GitHookOperationResult> {
    const hookPath = path.join(repoPath, '.git', 'hooks', hookName);

    try {
      // Check if hook already exists
      try {
        await fs.access(hookPath);
        return {
          success: false,
          error: 'Hook already exists. Use update instead.',
          hookName,
        };
      } catch {
        // Hook doesn't exist, good to create
      }

      // Write hook file
      await fs.writeFile(hookPath, content, { mode: 0o755 }); // Executable by default

      // Broadcast change
      this.broadcastHooksChanged(repoPath);

      return { success: true, hookName };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hookName,
      };
    }
  }

  private async updateHook(
    repoPath: string,
    hookName: GitHookName,
    content: string,
  ): Promise<GitHookOperationResult> {
    const hookPath = path.join(repoPath, '.git', 'hooks', hookName);

    try {
      // Preserve existing permissions
      const stats = await fs.stat(hookPath);
      await fs.writeFile(hookPath, content, { mode: stats.mode });

      this.broadcastHooksChanged(repoPath);

      return { success: true, hookName };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hookName,
      };
    }
  }

  private async deleteHook(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<GitHookOperationResult> {
    const hookPath = path.join(repoPath, '.git', 'hooks', hookName);

    try {
      await fs.unlink(hookPath);
      this.broadcastHooksChanged(repoPath);
      return { success: true, hookName };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hookName,
      };
    }
  }

  private async enableHook(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<GitHookOperationResult> {
    const hookPath = path.join(repoPath, '.git', 'hooks', hookName);

    try {
      const stats = await fs.stat(hookPath);
      await fs.chmod(hookPath, stats.mode | 0o111); // Add executable bit
      this.broadcastHooksChanged(repoPath);
      return { success: true, hookName };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hookName,
      };
    }
  }

  private async disableHook(
    repoPath: string,
    hookName: GitHookName,
  ): Promise<GitHookOperationResult> {
    const hookPath = path.join(repoPath, '.git', 'hooks', hookName);

    try {
      const stats = await fs.stat(hookPath);
      await fs.chmod(hookPath, stats.mode & ~0o111); // Remove executable bit
      this.broadcastHooksChanged(repoPath);
      return { success: true, hookName };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hookName,
      };
    }
  }

  private async getTemplates(): Promise<GitHookTemplate[]> {
    return HOOK_TEMPLATES;
  }

  setMainWindow(window: BrowserWindow) {
    this.rendererWindows.add(window);
  }

  private async broadcastHooksChanged(repoPath: string) {
    const status = await this.getHooksStatus(repoPath);

    for (const window of this.rendererWindows) {
      if (!window.isDestroyed()) {
        window.webContents.send(GitHooksAPIEvents.HOOKS_CHANGED, status);
      }
    }
  }
}

export const gitHooksHandler = new GitHooksHandler();
```

---

## UI Components

### Panel Component

```typescript
// src/renderer/panels/components/GitHooksPanel.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Circle, AlertTriangle, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { GitHooksService } from '../../main-process-api/GitHooksService';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';
import type { GitHooksStatus, GitHookInfo, GitHookName } from '../../../shared/types/git-hooks.types';

export const GitHooksPanel: React.FC = () => {
  const { theme } = useTheme();
  const { repositoryPath } = useRepositoryPanelContext();
  const [hooksStatus, setHooksStatus] = useState<GitHooksStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHook, setSelectedHook] = useState<GitHookInfo | null>(null);

  // Load hooks status
  useEffect(() => {
    if (!repositoryPath) return;

    const loadHooks = async () => {
      try {
        const status = await GitHooksService.getHooksStatus(repositoryPath);
        setHooksStatus(status);
      } catch (error) {
        console.error('[GitHooksPanel] Failed to load hooks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHooks();

    // Subscribe to changes
    const unsubscribe = GitHooksService.onHooksChanged((status) => {
      if (status.repoPath === repositoryPath) {
        setHooksStatus(status);
      }
    });

    return unsubscribe;
  }, [repositoryPath]);

  const handleViewHook = useCallback(async (hookName: GitHookName) => {
    if (!repositoryPath) return;
    // TODO: Open in modal or side panel
  }, [repositoryPath]);

  const handleToggleHook = useCallback(async (hook: GitHookInfo) => {
    if (!repositoryPath) return;

    if (hook.enabled) {
      await GitHooksService.disableHook(repositoryPath, hook.name);
    } else {
      await GitHooksService.enableHook(repositoryPath, hook.name);
    }
  }, [repositoryPath]);

  if (loading) {
    return <div style={{ padding: '16px' }}>Loading hooks...</div>;
  }

  if (!hooksStatus?.hasHooksDir) {
    return (
      <div style={{ padding: '16px', color: theme.colors.textSecondary }}>
        No .git/hooks directory found
      </div>
    );
  }

  // Group hooks by category
  const groupedHooks = hooksStatus.hooks.reduce((acc, hook) => {
    if (!acc[hook.category]) acc[hook.category] = [];
    acc[hook.category].push(hook);
    return acc;
  }, {} as Record<string, GitHookInfo[]>);

  return (
    <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h3 style={{ margin: 0, fontSize: theme.fontSizes[3] }}>Git Hooks</h3>
        <button
          style={{
            padding: '6px 12px',
            background: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Plus size={16} />
          Create Hook
        </button>
      </div>

      {Object.entries(groupedHooks).map(([category, hooks]) => (
        <div key={category} style={{ marginBottom: '24px' }}>
          <h4 style={{
            fontSize: theme.fontSizes[1],
            textTransform: 'uppercase',
            color: theme.colors.textSecondary,
            marginBottom: '8px',
          }}>
            {category}
          </h4>

          {hooks.map((hook) => (
            <HookItem
              key={hook.name}
              hook={hook}
              onView={handleViewHook}
              onToggle={handleToggleHook}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface HookItemProps {
  hook: GitHookInfo;
  onView: (hookName: GitHookName) => void;
  onToggle: (hook: GitHookInfo) => void;
}

const HookItem: React.FC<HookItemProps> = ({ hook, onView, onToggle }) => {
  const { theme } = useTheme();

  const getStatusIcon = () => {
    if (!hook.exists) {
      return <Circle size={16} color={theme.colors.textTertiary} />;
    }
    if (!hook.enabled) {
      return <AlertTriangle size={16} color={theme.colors.warning} />;
    }
    return <Check size={16} color={theme.colors.success} />;
  };

  return (
    <div
      style={{
        padding: '12px',
        background: theme.colors.backgroundSecondary,
        borderRadius: '6px',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        {getStatusIcon()}
        <div>
          <div style={{ fontWeight: theme.fontWeights.medium }}>
            {hook.name}
          </div>
          <div style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}>
            {hook.description}
          </div>
        </div>
      </div>

      {hook.exists && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onView(hook.name)}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              color: theme.colors.text,
            }}
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => onToggle(hook)}
            style={{
              padding: '4px 8px',
              background: hook.enabled ? theme.colors.success : theme.colors.textTertiary,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: theme.colors.background,
            }}
          >
            {hook.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## Panel Registration

### 1. Add to Catalog

```typescript
// src/shared/panels/repositoryPanelCatalog.ts

{
  id: 'gitHooks',
  label: 'Git Hooks',
  description: 'View and manage git hooks configured for this repository.',
  slices: ['git'] as const,
  surfaces: ['manager', 'agent', 'principal'] as const,
},
```

### 2. Register Renderer

```typescript
// src/renderer/panels/registry.tsx

import { GitHooksPanel } from './components/GitHooksPanel';

const panelRenderers = {
  // ... existing panels
  gitHooks: () => <GitHooksPanel />,
};
```

---

## Implementation Phases

### Phase 1: Read-Only Display (MVP)
**Time**: 2-3 hours
**Goal**: Show what hooks exist and their status

- ✅ IPC API interface
- ✅ Main process handler (read-only operations)
- ✅ Renderer service
- ✅ Basic panel component
- ✅ List hooks with status indicators
- ✅ View hook content in modal

**Deliverable**: Users can see what hooks are installed and enabled

### Phase 2: Basic Management
**Time**: 2-3 hours
**Goal**: Enable/disable and create hooks

- ✅ Enable/disable hooks (chmod operations)
- ✅ Delete hooks
- ✅ Hook templates system
- ✅ Create from template
- ✅ Real-time updates via events

**Deliverable**: Users can manage hooks without leaving the app

### Phase 3: Advanced Features
**Time**: 3-5 hours
**Goal**: Full editing and testing capabilities

- 📋 Edit hooks in Monaco editor
- 📋 Syntax validation
- 📋 Test hook execution in terminal
- 📋 Show execution history
- 📋 Share hooks across team (export/import)
- 📋 Hook execution logs

**Deliverable**: Complete hook development environment

---

## Hook Templates

Built-in templates will be provided for common use cases:

### Post-Push Notification
```bash
#!/bin/sh
# Notify the app that a push completed
# This solves the "no post-push hook" problem

# Send HTTP request to localhost app
curl -X POST http://localhost:PORT/api/git-push-completed \
  -H "Content-Type: application/json" \
  -d "{\"repo\": \"$(pwd)\", \"branch\": \"$(git branch --show-current)\"}"
```

### Pre-Commit Linter
```bash
#!/bin/sh
# Run linter before commit

npm run lint
```

### Commit Message Validator
```bash
#!/bin/sh
# Validate commit message format
# Conventional commits: type(scope): description

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

if ! echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+"; then
  echo "ERROR: Commit message must follow conventional commits format"
  echo "Example: feat(api): add new endpoint"
  exit 1
fi
```

---

## Future Enhancements

### Hook Execution Monitoring
- Track when hooks run
- Show success/failure status
- Display execution time
- Capture stdout/stderr

### Team Sharing
- Export hook as template
- Import team hooks
- Version control for hooks (store in repo)
- Recommended hooks for project type

### Integration with Other Panels
- **Terminal Panel**: Run hooks manually
- **Git Changes Panel**: Show which hooks would run
- **Commit History**: Show hook execution history per commit

---

## Open Questions

1. **Hook Storage**: Should we support storing hooks in the repository itself (e.g., `.githooks/`) and symlinking them?
2. **Security**: How do we warn users about dangerous hooks?
3. **Testing**: Should we provide a "dry run" mode for hooks?
4. **Sharing**: How should team hook templates be distributed?
5. **Notification Integration**: When we create the post-push hook, where should notifications appear in the UI?

---

## Success Metrics

- Users can view all hooks in a repository
- Users can enable/disable hooks without terminal
- Users can create common hooks from templates
- Time to create a new hook < 30 seconds
- Zero crashes when reading hook files

---

## References

- [Git Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- Existing IPC Pattern: `src/shared/main-process-api-interfaces/GitAPI.ts`
- Similar Panel: `src/renderer/panels/components/GitChangesPanel.tsx`
- Design Reference: `docs/design/GIT_REMOTE_IMPLEMENTATION_SUMMARY.md`
