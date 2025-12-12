# Repository Manager Links Feature - Design Document

## Overview

This document outlines the design and implementation plan for adding a **Links** feature to the Repository Manager titlebar. The feature allows users to store and access URLs associated with each repository, similar to the existing Secrets feature but without requiring secure storage.

## Architecture Overview

The Links feature follows the same architectural pattern as the Secrets feature but uses simple JSON storage instead of secure encrypted storage.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Renderer Process                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  RepoManagerTitlebar.tsx                                   │ │
│  │  - Links button (next to Settings button)                  │ │
│  │  - Opens LinksModal on click                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  LinksModal.tsx                                            │ │
│  │  - Display list of links for repository                    │ │
│  │  - Add/Edit/Delete links                                   │ │
│  │  - Open links in browser                                   │ │
│  │  - Copy link to clipboard                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  LinksService.ts                                           │ │
│  │  - Encapsulates window.mainProcess.links calls            │ │
│  │  - Type-safe interface for renderer                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────│──────────────────────────────────────┘
                           │
                           │ IPC (contextBridge)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Window Preload (preload.ts)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  linksApi (linksApi.ts)                                    │ │
│  │  - Exposes IPC handlers to renderer                        │ │
│  │  - Maps LinksEvents to ipcRenderer.invoke calls           │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────│──────────────────────────────────────┘
                           │
                           │ IPC Communication
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Main Process                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  IPC Handlers (main.ts)                                    │ │
│  │  - ipcMain.handle(LinksEvents.*)                          │ │
│  │  - Routes to LinksDomain methods                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  LinksDomain.ts                                            │ │
│  │  - Business logic for links management                     │ │
│  │  - CRUD operations on links                                │ │
│  │  - Uses simple JSON storage (not secure storage)          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Link Interface

```typescript
export interface RepositoryLink {
  id: string;           // Unique identifier (UUID)
  label: string;        // Display name for the link
  url: string;          // The actual URL
  description?: string; // Optional description
  category?: string;    // Optional category (e.g., "docs", "ci", "deployment")
  createdAt: number;    // Timestamp
  updatedAt: number;    // Timestamp
}

export interface RepositoryLinks {
  [repoId: string]: {
    links: RepositoryLink[];
    metadata: LinkMetadata;
  };
}

export interface LinkMetadata {
  repoId: string;
  repoPath: string;
  createdAt: number;
  updatedAt: number;
  linkCount: number;
}

export interface LinkOperationResult {
  success: boolean;
  error?: string;
  metadata?: LinkMetadata;
}

export interface LinkStoreRequest {
  repoId: string;
  repoPath: string;
  links: RepositoryLink[];
}
```

## IPC Communication Layer

### Events Enum

```typescript
// src/shared/main-process-api-interfaces/LinksAPI.ts

export enum LinksEvents {
  // Core operations
  STORE = 'links:store',
  DELETE = 'links:delete',
  EXISTS = 'links:exists',
  LIST = 'links:list',
  GET = 'links:get',

  // Single link operations
  ADD_LINK = 'links:add-link',
  UPDATE_LINK = 'links:update-link',
  REMOVE_LINK = 'links:remove-link',

  // Utility operations
  OPEN_LINK = 'links:open-link',
  COPY_LINK = 'links:copy-link',
}
```

### API Interface

```typescript
// src/shared/main-process-api-interfaces/LinksAPI.ts

export interface LinksAPI {
  /**
   * Store/update all links for a repository
   */
  store: (request: LinkStoreRequest) => Promise<LinkOperationResult>;

  /**
   * Delete all links for a repository
   */
  delete: (repoId: string) => Promise<LinkOperationResult>;

  /**
   * Check if links exist for a repository
   */
  exists: (repoId: string) => Promise<boolean>;

  /**
   * List metadata for all stored links
   */
  list: () => Promise<LinkMetadata[]>;

  /**
   * Get all links for a repository
   */
  get: (repoId: string) => Promise<RepositoryLink[]>;

  /**
   * Add a single link to a repository
   */
  addLink: (repoId: string, link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>) => Promise<LinkOperationResult>;

  /**
   * Update a single link
   */
  updateLink: (repoId: string, linkId: string, updates: Partial<RepositoryLink>) => Promise<LinkOperationResult>;

  /**
   * Remove a single link
   */
  removeLink: (repoId: string, linkId: string) => Promise<LinkOperationResult>;

  /**
   * Open a link in the default browser
   */
  openLink: (url: string) => Promise<{ success: boolean; error?: string }>;

  /**
   * Copy a link to clipboard
   */
  copyLink: (url: string) => Promise<{ success: boolean; error?: string }>;
}
```

### Preload API Implementation

```typescript
// src/window/main-process-api-implementations/linksApi.ts

import { ipcRenderer } from 'electron';
import {
  LinksAPI,
  LinksEvents,
  LinkStoreRequest,
  LinkOperationResult,
  LinkMetadata,
  RepositoryLink,
} from '../../shared/main-process-api-interfaces/LinksAPI';

export const linksAPI: LinksAPI = {
  store: (request: LinkStoreRequest): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.STORE, request);
  },

  delete: (repoId: string): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.DELETE, repoId);
  },

  exists: (repoId: string): Promise<boolean> => {
    return ipcRenderer.invoke(LinksEvents.EXISTS, repoId);
  },

  list: (): Promise<LinkMetadata[]> => {
    return ipcRenderer.invoke(LinksEvents.LIST);
  },

  get: (repoId: string): Promise<RepositoryLink[]> => {
    return ipcRenderer.invoke(LinksEvents.GET, repoId);
  },

  addLink: (repoId: string, link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.ADD_LINK, repoId, link);
  },

  updateLink: (repoId: string, linkId: string, updates: Partial<RepositoryLink>): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.UPDATE_LINK, repoId, linkId, updates);
  },

  removeLink: (repoId: string, linkId: string): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.REMOVE_LINK, repoId, linkId);
  },

  openLink: (url: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(LinksEvents.OPEN_LINK, url);
  },

  copyLink: (url: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(LinksEvents.COPY_LINK, url);
  },
};
```

### Service Layer

```typescript
// src/renderer/main-process-api/LinksService.ts

import type {
  RepositoryLink,
  LinkMetadata,
  LinkStoreRequest,
  LinkOperationResult,
} from '../../shared/main-process-api-interfaces/LinksAPI';

/**
 * Service layer for Links management functionality
 * ALL window.mainProcess.links calls MUST be encapsulated here
 */
export class LinksService {
  /**
   * Store all links for a repository
   */
  static async store(request: LinkStoreRequest): Promise<LinkOperationResult> {
    return window.mainProcess.links.store(request);
  }

  /**
   * Delete all links for a repository
   */
  static async delete(repoId: string): Promise<LinkOperationResult> {
    return window.mainProcess.links.delete(repoId);
  }

  /**
   * List all link metadata
   */
  static async list(): Promise<LinkMetadata[]> {
    return window.mainProcess.links.list();
  }

  /**
   * Check if links exist for a repository
   */
  static async exists(repoId: string): Promise<boolean> {
    return window.mainProcess.links.exists(repoId);
  }

  /**
   * Get all links for a repository
   */
  static async get(repoId: string): Promise<RepositoryLink[]> {
    return window.mainProcess.links.get(repoId);
  }

  /**
   * Add a single link
   */
  static async addLink(
    repoId: string,
    link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<LinkOperationResult> {
    return window.mainProcess.links.addLink(repoId, link);
  }

  /**
   * Update a single link
   */
  static async updateLink(
    repoId: string,
    linkId: string,
    updates: Partial<RepositoryLink>
  ): Promise<LinkOperationResult> {
    return window.mainProcess.links.updateLink(repoId, linkId, updates);
  }

  /**
   * Remove a single link
   */
  static async removeLink(repoId: string, linkId: string): Promise<LinkOperationResult> {
    return window.mainProcess.links.removeLink(repoId, linkId);
  }

  /**
   * Open a link in the default browser
   */
  static async openLink(url: string): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.links.openLink(url);
  }

  /**
   * Copy a link to clipboard
   */
  static async copyLink(url: string): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.links.copyLink(url);
  }
}
```

## Storage Namespace

First, add the new namespace to the typed store system:

### 1. Add to StaticNamespaces enum

```typescript
// src/shared/types/namespaces.types.ts

export enum StaticNamespaces {
  USER_PREFERENCES = 'user-preferences',
  REPOSITORIES = 'repositories',
  AI_CONFIGURATION = 'ai-configuration',
  LLM_MODELS = 'llm-models',
  CACHE = 'cache',
  TEMP = 'temp',
  GLOBAL_SESSION_REGISTRY = 'global-session-registry',
  SESSION_SUMMARIES = 'session-summaries',

  // Docker Management
  DOCKER_CONTAINERS = 'docker-containers',
  DOCKER_SESSIONS = 'docker-sessions',

  // Secrets Management
  SECRETS_METADATA = 'secrets-metadata',

  // Links Management
  REPOSITORY_LINKS = 'repository-links',
}
```

### 2. Add to NamespaceDataTypes

```typescript
// src/main/storage-providers/typed-namespaces.ts

// Add interface for stored links
export interface StoredLinks {
  links: RepositoryLink[];
  metadata: LinkMetadata;
}

// Add to NamespaceDataTypes interface
export interface NamespaceDataTypes {
  [StaticNamespaces.USER_PREFERENCES]: UserPreferences;
  [StaticNamespaces.REPOSITORIES]: Repository;
  [StaticNamespaces.AI_CONFIGURATION]: AIConfiguration;
  [StaticNamespaces.LLM_MODELS]: LLMConfiguration;
  [StaticNamespaces.CACHE]: Record<string, any>;
  [StaticNamespaces.TEMP]: Record<string, any>;
  [StaticNamespaces.GLOBAL_SESSION_REGISTRY]: GlobalSessionRegistry;
  [StaticNamespaces.SESSION_SUMMARIES]: SessionSummary;

  // Docker Management namespaces
  [StaticNamespaces.DOCKER_CONTAINERS]: ToolContainerState;
  [StaticNamespaces.DOCKER_SESSIONS]: DockerAnalysisSession;

  // Secrets Management namespace
  [StaticNamespaces.SECRETS_METADATA]: SecretMetadata;

  // Links Management namespace
  [StaticNamespaces.REPOSITORY_LINKS]: StoredLinks;
}
```

### 3. Register in TypedNamespaceRegistry

```typescript
// src/main/storage-providers/typed-namespaces.ts

private initializeDefaultNamespaces() {
  // ... existing registrations ...

  // Links Management
  this.register(StaticNamespaces.REPOSITORY_LINKS, {
    name: StaticNamespaces.REPOSITORY_LINKS,
    description: 'Repository links and bookmarks',
    storageProvider: 'electron-store',
    category: NamespaceCategory.CORE,
  });
}
```

## Main Process Implementation

### Storage Domain

```typescript
// src/main/services/storage-domains/LinksDomain.ts

import { TypedStorageProvider } from '../storage-providers/typed-namespaces';
import { StaticNamespaces } from '../../shared/types/namespaces.types';
import { v4 as uuidv4 } from 'uuid';

export interface RepositoryLink {
  id: string;
  label: string;
  url: string;
  description?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LinkMetadata {
  repoId: string;
  repoPath: string;
  createdAt: number;
  updatedAt: number;
  linkCount: number;
}

export interface StoredLinks {
  links: RepositoryLink[];
  metadata: LinkMetadata;
}

export class LinksDomain {
  private auditLog: Array<{ level: string; message: string; timestamp: number; data?: any }> = [];

  constructor(private storage: TypedStorageProvider) {}

  private logAudit(level: string, message: string, data?: any): void {
    const entry = {
      level,
      message,
      timestamp: Date.now(),
      data,
    };
    this.auditLog.push(entry);
    console.log(`[LinksDomain Audit] ${level.toUpperCase()}: ${message}`, data || '');

    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(-50);
    }
  }

  private validateLink(link: Partial<RepositoryLink>): boolean {
    if (!link.label || typeof link.label !== 'string' || link.label.trim().length === 0) {
      return false;
    }
    if (!link.url || typeof link.url !== 'string' || link.url.trim().length === 0) {
      return false;
    }
    // Basic URL validation
    try {
      new URL(link.url);
      return true;
    } catch {
      return false;
    }
  }

  async storeLinks(
    repoId: string,
    repoPath: string,
    links: RepositoryLink[]
  ): Promise<{ success: boolean; error?: string; metadata?: LinkMetadata }> {
    try {
      // Validate all links
      for (const link of links) {
        if (!this.validateLink(link)) {
          return { success: false, error: `Invalid link: ${link.label || 'unknown'}` };
        }
      }

      const now = Date.now();

      // Get existing data to preserve createdAt
      const existingData = await this.storage.get(StaticNamespaces.REPOSITORY_LINKS, repoId);
      const existingCreatedAt = existingData?.metadata?.createdAt || now;

      const metadata: LinkMetadata = {
        repoId,
        repoPath,
        createdAt: existingCreatedAt,
        updatedAt: now,
        linkCount: links.length,
      };

      const storedData: StoredLinks = {
        links,
        metadata,
      };

      await this.storage.set(StaticNamespaces.REPOSITORY_LINKS, repoId, storedData);

      this.logAudit('info', `Stored ${links.length} links for repository`, { repoId });

      return { success: true, metadata };
    } catch (error: any) {
      this.logAudit('error', 'Failed to store links', {
        repoId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async getLinks(repoId: string): Promise<RepositoryLink[]> {
    try {
      const data = await this.storage.get(StaticNamespaces.REPOSITORY_LINKS, repoId);

      if (!data) {
        return [];
      }

      this.logAudit('info', 'Retrieved links for repository', { repoId });
      return data.links || [];
    } catch (error: any) {
      this.logAudit('error', 'Failed to retrieve links', {
        repoId,
        error: error.message,
      });
      return [];
    }
  }

  async getLinksWithMetadata(repoId: string): Promise<StoredLinks | null> {
    try {
      const data = await this.storage.get(StaticNamespaces.REPOSITORY_LINKS, repoId);
      return data || null;
    } catch (error: any) {
      this.logAudit('error', 'Failed to retrieve links with metadata', {
        repoId,
        error: error.message,
      });
      return null;
    }
  }

  async deleteLinks(repoId: string): Promise<void> {
    try {
      await this.storage.delete(StaticNamespaces.REPOSITORY_LINKS, repoId);
      this.logAudit('info', 'Deleted links for repository', { repoId });
    } catch (error: any) {
      this.logAudit('error', 'Failed to delete links', {
        repoId,
        error: error.message,
      });
      throw error;
    }
  }

  async hasLinks(repoId: string): Promise<boolean> {
    return await this.storage.has(StaticNamespaces.REPOSITORY_LINKS, repoId);
  }

  async getAllMetadata(): Promise<LinkMetadata[]> {
    try {
      const allData = await this.storage.getNamespaceData(StaticNamespaces.REPOSITORY_LINKS);

      const metadata: LinkMetadata[] = [];
      for (const repoId in allData) {
        if (allData[repoId]?.metadata) {
          metadata.push(allData[repoId].metadata);
        }
      }

      return metadata;
    } catch (error: any) {
      this.logAudit('error', 'Failed to get all metadata', { error: error.message });
      return [];
    }
  }

  async addLink(
    repoId: string,
    link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; error?: string; metadata?: LinkMetadata }> {
    try {
      if (!this.validateLink(link)) {
        return { success: false, error: 'Invalid link data' };
      }

      const now = Date.now();
      const newLink: RepositoryLink = {
        ...link,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
      };

      const existingLinks = await this.getLinks(repoId);
      const updatedLinks = [...existingLinks, newLink];

      const data = await this.getLinksWithMetadata(repoId);
      const repoPath = data?.metadata?.repoPath || '';

      return await this.storeLinks(repoId, repoPath, updatedLinks);
    } catch (error: any) {
      this.logAudit('error', 'Failed to add link', { repoId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async updateLink(
    repoId: string,
    linkId: string,
    updates: Partial<RepositoryLink>
  ): Promise<{ success: boolean; error?: string; metadata?: LinkMetadata }> {
    try {
      const existingLinks = await this.getLinks(repoId);
      const linkIndex = existingLinks.findIndex(l => l.id === linkId);

      if (linkIndex === -1) {
        return { success: false, error: 'Link not found' };
      }

      const updatedLink = {
        ...existingLinks[linkIndex],
        ...updates,
        id: linkId, // Ensure ID doesn't change
        updatedAt: Date.now(),
      };

      if (!this.validateLink(updatedLink)) {
        return { success: false, error: 'Invalid link data' };
      }

      const updatedLinks = [...existingLinks];
      updatedLinks[linkIndex] = updatedLink;

      const data = await this.getLinksWithMetadata(repoId);
      const repoPath = data?.metadata?.repoPath || '';

      return await this.storeLinks(repoId, repoPath, updatedLinks);
    } catch (error: any) {
      this.logAudit('error', 'Failed to update link', { repoId, linkId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async removeLink(repoId: string, linkId: string): Promise<{ success: boolean; error?: string; metadata?: LinkMetadata }> {
    try {
      const existingLinks = await this.getLinks(repoId);
      const updatedLinks = existingLinks.filter(l => l.id !== linkId);

      if (updatedLinks.length === existingLinks.length) {
        return { success: false, error: 'Link not found' };
      }

      const data = await this.getLinksWithMetadata(repoId);
      const repoPath = data?.metadata?.repoPath || '';

      return await this.storeLinks(repoId, repoPath, updatedLinks);
    } catch (error: any) {
      this.logAudit('error', 'Failed to remove link', { repoId, linkId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  getAuditLog(): Array<{ level: string; message: string; timestamp: number; data?: any }> {
    return [...this.auditLog];
  }
}
```

### IPC Handler Registration

In `src/main/main.ts`, register the IPC handlers:

```typescript
import { LinksDomain } from './services/storage-domains/LinksDomain';
import { LinksEvents } from '../shared/main-process-api-interfaces/LinksAPI';

// Initialize LinksDomain with typed storage provider
const linksDomain = new LinksDomain(typedStore);

// Register IPC handlers
ipcMain.handle(LinksEvents.STORE, async (_, request) => {
  return await linksDomain.storeLinks(request.repoId, request.repoPath, request.links);
});

ipcMain.handle(LinksEvents.DELETE, async (_, repoId: string) => {
  await linksDomain.deleteLinks(repoId);
  return { success: true };
});

ipcMain.handle(LinksEvents.EXISTS, async (_, repoId: string) => {
  return await linksDomain.hasLinks(repoId);
});

ipcMain.handle(LinksEvents.LIST, async () => {
  return await linksDomain.getAllMetadata();
});

ipcMain.handle(LinksEvents.GET, async (_, repoId: string) => {
  return await linksDomain.getLinks(repoId);
});

ipcMain.handle(LinksEvents.ADD_LINK, async (_, repoId: string, link) => {
  return await linksDomain.addLink(repoId, link);
});

ipcMain.handle(LinksEvents.UPDATE_LINK, async (_, repoId: string, linkId: string, updates) => {
  return await linksDomain.updateLink(repoId, linkId, updates);
});

ipcMain.handle(LinksEvents.REMOVE_LINK, async (_, repoId: string, linkId: string) => {
  return await linksDomain.removeLink(repoId, linkId);
});

ipcMain.handle(LinksEvents.OPEN_LINK, async (_, url: string) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(LinksEvents.COPY_LINK, async (_, url: string) => {
  try {
    const { clipboard } = require('electron');
    clipboard.writeText(url);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

## UI Components

### Titlebar Integration

Update `RepoManagerTitlebar.tsx` to add the Links button next to the Settings button:

```typescript
// Add a Links button alongside the Settings button
{onLinksClick && (
  <button
    onClick={onLinksClick}
    style={{
      position: 'absolute',
      right: isMac ? '56px' : '190px', // Position to left of Settings button
      top: '50%',
      transform: 'translateY(-50%)',
      width: '32px',
      height: '32px',
      borderRadius: '6px',
      border: 'none',
      backgroundColor: 'transparent',
      color: colorMode === 'dark' ? '#9ca3af' : '#6b7280',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      WebkitAppRegion: 'no-drag' as any,
      zIndex: 10,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor =
        colorMode === 'dark'
          ? 'rgba(255, 255, 255, 0.1)'
          : 'rgba(0, 0, 0, 0.05)';
      e.currentTarget.style.color =
        colorMode === 'dark' ? '#d1d5db' : '#374151';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
      e.currentTarget.style.color =
        colorMode === 'dark' ? '#9ca3af' : '#6b7280';
    }}
    aria-label="Links"
    title="Repository Links"
  >
    <Link2 size={18} />
  </button>
)}
```

### LinksModal Component

Create `src/renderer/repo-manager/shared/LinksModal.tsx` - a modal for managing links, styled similarly to SecretsModal:

- Display list of links with labels, URLs, and optional descriptions
- Add new link with label, URL, description, and category
- Edit existing link inline
- Delete link with confirmation
- Open link in browser
- Copy link to clipboard
- Category filtering/grouping (optional enhancement)
- Search/filter links (optional enhancement)

## Implementation Steps

1. **Add Storage Namespace**
   - Add `REPOSITORY_LINKS = 'repository-links'` to `StaticNamespaces` enum in `src/shared/types/namespaces.types.ts`
   - Add `StoredLinks` interface to `src/main/storage-providers/typed-namespaces.ts`
   - Add `[StaticNamespaces.REPOSITORY_LINKS]: StoredLinks` to `NamespaceDataTypes` interface
   - Register the namespace in `TypedNamespaceRegistry.initializeDefaultNamespaces()`

2. **Create Type Definitions** (`src/shared/main-process-api-interfaces/LinksAPI.ts`)
   - Define all interfaces and enums for the Links API
   - Export LinksEvents, LinksAPI, RepositoryLink, LinkMetadata, etc.

3. **Create Storage Domain** (`src/main/services/storage-domains/LinksDomain.ts`)
   - Implement LinksDomain class with CRUD operations
   - Use TypedStorageProvider for type-safe storage
   - Use StaticNamespaces.REPOSITORY_LINKS namespace
   - Add validation and audit logging

4. **Register IPC Handlers** (`src/main/main.ts`)
   - Initialize LinksDomain with typedStore instance
   - Register all IPC handlers for LinksEvents

5. **Create Preload API** (`src/window/main-process-api-implementations/linksApi.ts`)
   - Implement linksAPI object
   - Map all methods to ipcRenderer.invoke calls

6. **Update Preload Script** (`src/window/preload.ts`)
   - Import linksApi
   - Add to mainProcessExposure object

7. **Create Service Layer** (`src/renderer/main-process-api/LinksService.ts`)
   - Create LinksService class with static methods
   - Encapsulate all window.mainProcess.links calls

8. **Create UI Components**
   - Create LinksModal.tsx (similar to SecretsModal.tsx)
   - Update RepoManagerTitlebar.tsx to add Links button
   - Update RepositoryWorkspace.tsx to handle LinksModal state

9. **Update Type Declarations**
   - Add links to MainProcessAPI interface in `src/shared/main-process-api-interfaces/index.ts`

## Key Differences from Secrets

| Aspect | Secrets | Links |
|--------|---------|-------|
| Storage | UnifiedSecureStorage (encrypted) | TypedStorageProvider with electron-store |
| Namespace | Secure storage (not in namespace system) | StaticNamespaces.REPOSITORY_LINKS |
| Security | Secure keychain storage | Plain text storage in electron-store |
| On-demand loading | Values loaded individually | All links loaded at once |
| Auto-hide | 30-second timeout | No timeout needed |
| Clipboard | Never exposes value in renderer | Can copy URL freely |
| Validation | Environment variable name format | URL validation |

## Testing Considerations

1. **Unit Tests**
   - LinksDomain CRUD operations
   - URL validation
   - Link ordering and filtering

2. **Integration Tests**
   - IPC communication flow
   - Store persistence
   - Multiple repositories

3. **E2E Tests**
   - Add/Edit/Delete links in UI
   - Open links in browser
   - Copy to clipboard
   - Modal interactions

## Future Enhancements

1. **Link Categories**
   - Predefined categories (docs, ci/cd, deployment, monitoring, etc.)
   - Custom categories
   - Category icons and colors

2. **Link Validation**
   - Check if URLs are accessible
   - Display status indicators
   - Auto-refresh status

3. **Link Sharing**
   - Export/Import links as JSON
   - Share link collections between repositories
   - Templates for common tool stacks

4. **Smart Links**
   - Auto-detect common URLs from repository (README, package.json, etc.)
   - Suggest links based on detected tools
   - Integration with GitHub Issues/PRs/Actions

5. **Link Analytics**
   - Track link usage
   - Sort by frequency
   - Recently accessed links

## Notes on IPC Communication

The IPC communication follows this pattern:

```
Renderer (LinksService.get)
  → window.mainProcess.links.get(repoId)
    → contextBridge (linksAPI.get)
      → ipcRenderer.invoke('links:get', repoId)
        → IPC Channel
          → ipcMain.handle('links:get', (_, repoId) => ...)
            → LinksDomain.getLinks(repoId)
              → StoreService.get(`links:${repoId}`)
```

All communication is asynchronous using Promise-based APIs. The contextBridge ensures security by exposing only specific methods and preventing direct access to Node.js APIs from the renderer process.

## Storage Format

Links are stored in electron-store under the `repository-links` namespace:

```json
{
  "repository-links:owner/repo": {
    "links": [
      {
        "id": "uuid-v4",
        "label": "Documentation",
        "url": "https://docs.example.com",
        "description": "API documentation",
        "category": "docs",
        "createdAt": 1234567890,
        "updatedAt": 1234567890
      }
    ],
    "metadata": {
      "repoId": "owner/repo",
      "repoPath": "/path/to/repo",
      "createdAt": 1234567890,
      "updatedAt": 1234567890,
      "linkCount": 1
    }
  }
}
```

The TypedStorageProvider handles the namespace prefix automatically, so the LinksDomain only needs to provide the `repoId` as the key.

## Security Considerations

Unlike Secrets, Links do not require encryption because:
- URLs are typically public or semi-public
- No sensitive authentication tokens or keys
- Meant to be shared and accessed frequently
- Simple JSON storage is sufficient

However, basic validation should be performed:
- URL format validation
- XSS prevention in labels/descriptions
- No execution of JavaScript URLs
- Safe external link opening via electron shell.openExternal()
