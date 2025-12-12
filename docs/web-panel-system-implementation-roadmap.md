# Web Panel System Implementation Roadmap

**Date:** October 25, 2025
**Goal:** Enable third-party panel extensions to work identically in both Electron desktop and web environments
**Related Docs:** [Panel Extension Store Specification](./PANEL_EXTENSION_STORE_SPECIFICATION.md)

---

## Executive Summary

This document outlines the implementation steps to extract and standardize the panel infrastructure currently used in the Electron desktop application, making it available for use in web environments. The primary goal is to create a shared harness that allows panels to communicate and operate identically across both platforms.

---

## Current State Analysis

### Existing Desktop Panel Infrastructure

Your Electron application has a sophisticated panel system with:

1. **Panel Catalog** (`src/shared/panels/repositoryPanelCatalog.ts`)
   - 26 predefined panels organized by surface (explorer, manager, viewer, excalidraw, agent)
   - Panel definitions include metadata (id, label, description, surfaces, slices)
   - Type-safe panel IDs and visibility management

2. **Panel Context System** (`src/renderer/panels/RepositoryPanelProvider.tsx`)
   - Centralized data provider using React Context
   - Data slices: git, markdown, fileTree, packages, quality
   - Actions for interpanel communication (openFile, openGitDiff)
   - Loading states per slice

3. **Panel Registry** (`src/renderer/panels/registry.tsx`)
   - Maps panel IDs to React render functions
   - Panel filtering by surface type
   - Render props pattern for dependency injection

4. **Data Cache Layer** (`src/renderer/services/RepositoryDataCache.ts`)
   - Event-driven cache with automatic updates
   - Git status, file tree, packages, quality metrics
   - Subscription-based updates per component

### What's Missing for Web

The current system is tightly coupled to:
- Electron IPC for main process communication
- Node.js file system APIs
- Desktop-specific service layers (GitService, AlexandriaService, etc.)

---

## Implementation Phases

### Phase 1: Extract Core Panel Types and Interfaces

**Goal:** Create a platform-agnostic type system that both web and desktop can share.

#### Tasks

1. **Create Shared Type Package**
   - Create new package: `@your-app/panel-types` or place in `src/shared/panels/types/`
   - Extract all panel-related types that don't depend on Electron

2. **Extract Core Interfaces**

   ```typescript
   // src/shared/panels/types/panelContext.types.ts

   /**
    * Core data slices that panels can depend on
    */
   export type PanelDataSlice =
     | 'git'
     | 'markdown'
     | 'fileTree'
     | 'packages'
     | 'quality';

   /**
    * Actions that panels can invoke for interpanel communication
    */
   export interface PanelActions {
     openFile?: (filePath: string) => void;
     openGitDiff?: (filePath: string, status?: GitChangeSelectionStatus) => void;
     navigateToPanel?: (panelId: string) => void;
     notifyPanels?: (event: PanelEvent) => void;
   }

   /**
    * Data context provided to all panels
    */
   export interface PanelContextValue {
     // Repository metadata
     repositoryPath: string | null;
     repository: RepositoryMetadata | null;

     // Data slices
     gitStatus: GitStatus;
     gitStatusLoading: boolean;
     markdownFiles: MarkdownFile[];
     fileTree: FileTree | null;
     packages: PackageLayer[] | null;
     quality: QualityMetrics | null;

     // State management
     loading: boolean;
     refresh: () => Promise<void>;

     // Actions
     actions: PanelActions;

     // Utility methods
     hasSlice: (slice: PanelDataSlice) => boolean;
     isSliceLoading: (slice: PanelDataSlice) => boolean;
   }
   ```

3. **Extract Panel Event Types**

   ```typescript
   // src/shared/panels/types/panelEvents.types.ts

   export type PanelEventType =
     | 'file:opened'
     | 'file:saved'
     | 'file:deleted'
     | 'git:status-changed'
     | 'git:commit'
     | 'git:branch-changed'
     | 'panel:focus'
     | 'panel:blur'
     | 'data:refresh';

   export interface PanelEvent<T = unknown> {
     type: PanelEventType;
     source: string; // Panel ID that emitted the event
     timestamp: number;
     payload: T;
   }

   export interface PanelEventEmitter {
     emit<T>(event: PanelEvent<T>): void;
     on<T>(type: PanelEventType, handler: (event: PanelEvent<T>) => void): () => void;
     off<T>(type: PanelEventType, handler: (event: PanelEvent<T>) => void): void;
   }
   ```

4. **Extract Panel Lifecycle Types**

   ```typescript
   // src/shared/panels/types/panelLifecycle.types.ts

   export interface PanelMetadata {
     id: string;
     name: string;
     icon?: string;
     version?: string;
     author?: string;
   }

   export interface PanelComponentProps {
     context: PanelContextValue;
     actions: PanelActions;
     events: PanelEventEmitter;
   }

   export interface PanelDefinition {
     metadata: PanelMetadata;
     component: React.ComponentType<PanelComponentProps>;

     // Lifecycle hooks
     onMount?: (context: PanelContextValue) => void | Promise<void>;
     onUnmount?: (context: PanelContextValue) => void | Promise<void>;
     onDataChange?: (slice: PanelDataSlice, data: unknown) => void;
   }
   ```

**Deliverables:**
- [ ] `src/shared/panels/types/panelContext.types.ts`
- [ ] `src/shared/panels/types/panelEvents.types.ts`
- [ ] `src/shared/panels/types/panelLifecycle.types.ts`
- [ ] `src/shared/panels/types/index.ts` (barrel export)

---

### Phase 2: Create Platform-Agnostic Panel Harness

**Goal:** Build a React harness that can run in both environments with platform-specific adapters.

#### Tasks

1. **Create Base Panel Harness**

   ```typescript
   // src/shared/panels/harness/PanelHarness.tsx

   import React, { createContext, useContext, useMemo } from 'react';
   import type { PanelContextValue, PanelActions } from '../types';

   interface PanelHarnessProps {
     context: PanelContextValue;
     children: React.ReactNode;
   }

   const PanelContext = createContext<PanelContextValue | null>(null);

   export const PanelHarness: React.FC<PanelHarnessProps> = ({
     context,
     children
   }) => {
     return (
       <PanelContext.Provider value={context}>
         {children}
       </PanelContext.Provider>
     );
   };

   export const usePanelContext = () => {
     const context = useContext(PanelContext);
     if (!context) {
       throw new Error('usePanelContext must be used within PanelHarness');
     }
     return context;
   };
   ```

2. **Create Event Bus Implementation**

   ```typescript
   // src/shared/panels/harness/PanelEventBus.ts

   import { EventEmitter as NodeEventEmitter } from 'events';
   import type { PanelEvent, PanelEventType, PanelEventEmitter } from '../types';

   export class PanelEventBus implements PanelEventEmitter {
     private emitter = new NodeEventEmitter();

     emit<T>(event: PanelEvent<T>): void {
       this.emitter.emit(event.type, event);
       this.emitter.emit('*', event); // Global listener
     }

     on<T>(
       type: PanelEventType,
       handler: (event: PanelEvent<T>) => void
     ): () => void {
       this.emitter.on(type, handler);
       return () => this.off(type, handler);
     }

     off<T>(
       type: PanelEventType,
       handler: (event: PanelEvent<T>) => void
     ): void {
       this.emitter.off(type, handler);
     }

     clear(): void {
       this.emitter.removeAllListeners();
     }
   }
   ```

3. **Create Platform Adapter Interface**

   ```typescript
   // src/shared/panels/harness/PlatformAdapter.ts

   export interface PlatformAdapter {
     // File operations
     readFile(path: string): Promise<string>;
     writeFile(path: string, content: string): Promise<void>;

     // Git operations
     getGitStatus(repoPath: string): Promise<GitStatus>;
     getGitBranch(repoPath: string): Promise<string>;

     // Repository operations
     getFileTree(repoPath: string): Promise<FileTree>;
     getPackages(repoPath: string): Promise<PackageLayer[]>;
     getQualityMetrics(repoPath: string): Promise<QualityMetrics>;

     // Event subscriptions
     onGitStatusChange(
       repoPath: string,
       handler: (status: GitStatus) => void
     ): () => void;
     onFileChange(
       repoPath: string,
       handler: (filePath: string) => void
     ): () => void;
   }
   ```

**Deliverables:**
- [ ] `src/shared/panels/harness/PanelHarness.tsx`
- [ ] `src/shared/panels/harness/PanelEventBus.ts`
- [ ] `src/shared/panels/harness/PlatformAdapter.ts`
- [ ] `src/shared/panels/harness/index.ts` (barrel export)

---

### Phase 3: Create Platform-Specific Adapters

**Goal:** Implement adapters for both Electron and Web platforms.

#### Tasks

1. **Electron Platform Adapter**

   ```typescript
   // src/renderer/panels/adapters/ElectronPlatformAdapter.ts

   import type { PlatformAdapter } from '../../../shared/panels/harness';
   import { GitService } from '../../main-process-api/GitService';
   import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';

   export class ElectronPlatformAdapter implements PlatformAdapter {
     async readFile(path: string): Promise<string> {
       return await window.electron.fs.readFile(path);
     }

     async getGitStatus(repoPath: string): Promise<GitStatus> {
       return await GitService.getStatus(repoPath);
     }

     onGitStatusChange(
       repoPath: string,
       handler: (status: GitStatus) => void
     ): () => void {
       return RepositoryMonitoringService.onGitStatusChanged(
         repoPath,
         handler
       );
     }

     // ... implement all other methods
   }
   ```

2. **Web Platform Adapter**

   ```typescript
   // src/web/panels/adapters/WebPlatformAdapter.ts

   import type { PlatformAdapter } from '../../../shared/panels/harness';

   export class WebPlatformAdapter implements PlatformAdapter {
     constructor(private apiBaseUrl: string) {}

     async readFile(path: string): Promise<string> {
       const response = await fetch(
         `${this.apiBaseUrl}/files/read`,
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ path }),
         }
       );
       return await response.text();
     }

     async getGitStatus(repoPath: string): Promise<GitStatus> {
       const response = await fetch(
         `${this.apiBaseUrl}/git/status`,
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ repoPath }),
         }
       );
       return await response.json();
     }

     onGitStatusChange(
       repoPath: string,
       handler: (status: GitStatus) => void
     ): () => void {
       // Use WebSocket or SSE for real-time updates
       const ws = new WebSocket(
         `${this.apiBaseUrl.replace('http', 'ws')}/git/watch?repo=${repoPath}`
       );
       ws.onmessage = (event) => {
         handler(JSON.parse(event.data));
       };
       return () => ws.close();
     }

     // ... implement all other methods
   }
   ```

**Deliverables:**
- [ ] `src/renderer/panels/adapters/ElectronPlatformAdapter.ts`
- [ ] `src/web/panels/adapters/WebPlatformAdapter.ts`
- [ ] Update existing `RepositoryPanelProvider` to use adapter pattern

---

### Phase 4: Refactor Existing Desktop Panels

**Goal:** Update existing panels to use the new platform-agnostic harness.

#### Tasks

1. **Update Panel Imports**
   - Replace direct Electron API calls with platform adapter
   - Use `usePanelContext()` hook instead of direct context access

2. **Standardize Panel Props**

   ```typescript
   // Before
   interface GitChangesPanelProps {
     onFileClick?: (filePath: string) => void;
   }

   // After
   interface GitChangesPanelProps extends PanelComponentProps {
     // Panel-specific props only
   }
   ```

3. **Update Panel Registration**

   ```typescript
   // src/renderer/panels/registry.tsx

   import type { PanelDefinition } from '../../shared/panels/types';

   export const desktopPanelDefinitions: PanelDefinition[] = [
     {
       metadata: {
         id: 'gitChanges',
         name: 'Git Changes',
         icon: '📝',
       },
       component: GitChangesPanel,
       onMount: async (context) => {
         // Load initial git status
         await context.refresh();
       },
     },
     // ... other panels
   ];
   ```

**Deliverables:**
- [ ] Refactor all 26 existing panels to use new types
- [ ] Update panel registry to use `PanelDefinition` type
- [ ] Create migration guide for custom panels

---

### Phase 5: Create Web Panel Demo/Test Harness

**Goal:** Build a standalone web application that demonstrates panels working in a browser.

#### Tasks

1. **Create Web App Structure**

   ```
   src/web/
   ├── index.html
   ├── main.tsx                    # Entry point
   ├── App.tsx                     # Root component
   ├── panels/
   │   ├── adapters/
   │   │   └── WebPlatformAdapter.ts
   │   └── WebPanelContainer.tsx
   └── api/
       └── mockData.ts             # Mock data for development
   ```

2. **Create Web Panel Container**

   ```typescript
   // src/web/panels/WebPanelContainer.tsx

   import React, { useState, useEffect } from 'react';
   import { PanelHarness } from '../../shared/panels/harness';
   import { WebPlatformAdapter } from './adapters/WebPlatformAdapter';
   import type { PanelContextValue } from '../../shared/panels/types';

   export const WebPanelContainer: React.FC = () => {
     const [adapter] = useState(() =>
       new WebPlatformAdapter(import.meta.env.VITE_API_URL)
     );

     const [context, setContext] = useState<PanelContextValue>({
       repositoryPath: '/demo/repo',
       repository: null,
       gitStatus: { staged: [], unstaged: [], untracked: [], deleted: [] },
       // ... other context values
     });

     return (
       <PanelHarness context={context}>
         {/* Render panels here */}
       </PanelHarness>
     );
   };
   ```

3. **Create Mock API Server** (for development)

   ```typescript
   // src/web/api/mockServer.ts

   import { createServer } from 'vite';

   export const mockApiPlugin = {
     name: 'mock-api',
     configureServer(server) {
       server.middlewares.use('/api/git/status', (req, res) => {
         res.setHeader('Content-Type', 'application/json');
         res.end(JSON.stringify({
           staged: ['src/App.tsx'],
           unstaged: ['package.json'],
           untracked: [],
           deleted: [],
         }));
       });
       // ... other mock endpoints
     },
   };
   ```

**Deliverables:**
- [ ] Web app with Vite/Webpack configuration
- [ ] Mock API server for development
- [ ] Example panel running in browser
- [ ] Documentation for running web demo

---

### Phase 6: Third-Party Panel SDK

**Goal:** Create developer tools and documentation for building third-party panels.

#### Tasks

1. **Create Panel SDK Package**

   ```typescript
   // packages/panel-sdk/src/index.ts

   export * from './types';
   export * from './harness';
   export { createPanel } from './createPanel';
   export { usePanelContext } from './hooks';
   ```

2. **Create Panel Template Generator**

   ```bash
   npm create @your-app/panel my-awesome-panel
   ```

   Generates:
   ```
   my-awesome-panel/
   ├── package.json
   ├── tsconfig.json
   ├── vite.config.ts
   ├── src/
   │   ├── index.tsx              # Panel entry point
   │   ├── MyPanel.tsx            # Panel component
   │   └── types.ts               # Panel-specific types
   └── README.md
   ```

3. **Create Developer Documentation**
   - Panel development guide
   - API reference
   - Examples and tutorials
   - Testing guidelines

**Deliverables:**
- [ ] `@your-app/panel-sdk` package
- [ ] Panel template generator CLI
- [ ] Developer documentation site
- [ ] Example third-party panels

---

## Testing Strategy

### Unit Tests
- [ ] Panel type validations
- [ ] Event bus functionality
- [ ] Platform adapter mocking
- [ ] Panel lifecycle hooks

### Integration Tests
- [ ] Panel communication flow
- [ ] Data slice loading and updates
- [ ] Platform adapter switching
- [ ] Cross-panel event propagation

### End-to-End Tests
- [ ] Desktop app with panels
- [ ] Web app with panels
- [ ] Third-party panel installation
- [ ] Panel hot-reloading

---

## Migration Path

### For Existing Desktop Panels

1. **Phase 1:** Add new types alongside existing code (non-breaking)
2. **Phase 2:** Gradually migrate panels one-by-one
3. **Phase 3:** Deprecate old pattern
4. **Phase 4:** Remove old code

### For Third-Party Developers

1. **Provide migration scripts** to update panel structure
2. **Version SDK packages** with clear breaking change notices
3. **Maintain backward compatibility** for 2 major versions
4. **Offer migration assistance** through documentation and examples

---

## Success Metrics

- [ ] All 26 existing panels work in web environment
- [ ] Panel loading performance < 100ms in both environments
- [ ] Third-party panel can be developed in < 1 hour
- [ ] Zero platform-specific code in panel components
- [ ] 100% type safety across platform boundaries

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Extract Types | 1 week | None |
| Phase 2: Create Harness | 2 weeks | Phase 1 |
| Phase 3: Platform Adapters | 2 weeks | Phase 2 |
| Phase 4: Refactor Panels | 3 weeks | Phase 3 |
| Phase 5: Web Demo | 2 weeks | Phase 4 |
| Phase 6: SDK & Docs | 2 weeks | Phase 5 |
| **Total** | **12 weeks** | |

---

## Open Questions

1. **Data Persistence:** How should web panels persist state? (localStorage, IndexedDB, server-side?)
2. **Authentication:** How do web panels authenticate with backend services?
3. **Real-time Updates:** WebSocket, SSE, or polling for git status changes in web?
4. **Bundle Size:** Should web panels lazy-load dependencies to reduce initial load?
5. **Panel Sandboxing:** Should web panels run in iframes for security?

---

## Next Steps

1. Review this roadmap with the team
2. Prioritize phases based on business needs
3. Create detailed task breakdown for Phase 1
4. Set up project tracking (GitHub Projects, Jira, etc.)
5. Begin implementation of Phase 1

---

## Related Documentation

- [Panel Extension Store Specification](./PANEL_EXTENSION_STORE_SPECIFICATION.md)
- [Git Event Integration for Landing Page](./GIT_EVENT_INTEGRATION_LANDING_PAGE.md)
- [Repository Explorer Migration](./REPOSITORY_EXPLORER_MIGRATION.md)

---

**Last Updated:** October 25, 2025
