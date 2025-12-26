# Collections Integration Guide

## Overview

This document describes the Collections system used in web-ade and how to integrate it into the Electron application. Collections allow users to organize GitHub repositories into curated groups that sync to GitHub for persistence.

## Architecture

### Data Model

Collections use a **two-file format** defined by `@principal-ai/alexandria-collections`:

**`collections.json`** - Collection metadata:
```typescript
interface Collection {
  id: string;           // e.g., "col-1702400000000-abc123"
  name: string;
  description?: string;
  icon?: string;        // Lucide icon name, e.g., "FolderOpen"
  theme?: string;
  createdAt: number;    // Unix timestamp
  updatedAt: number;
}

interface CollectionsData {
  version: string;      // "1.0"
  collections: Collection[];
}
```

**`collection-memberships.json`** - Repository associations:
```typescript
interface CollectionMembership {
  repositoryId: string;   // e.g., "owner/repo"
  collectionId: string;
  addedAt: number;
  metadata?: {
    sourceRepository?: {  // For forks
      owner: string;
      name: string;
    };
  };
}

interface CollectionMembershipsData {
  version: string;
  memberships: CollectionMembership[];
}
```

### Storage

**GitHub as Source of Truth**: User collections are stored in a GitHub repository called `web-ade-collections` in the user's account. There is no localStorage caching - all reads and writes go directly to GitHub.

**Curated Collections**: Read-only collections maintained in `principal-ai/web-ade-collections`.

## API Endpoints

### Curated Collections (Public, Read-Only)

**`GET /api/collections`**
Returns all curated collections with their memberships.

Response:
```json
{
  "collections": [...],
  "memberships": [...]
}
```

**`GET /api/collections/[id]`**
Returns a single curated collection.

Response:
```json
{
  "collection": {...},
  "memberships": [...]
}
```

### User Collections (Authenticated)

**`GET /api/github/collections`**
Check if user has a collections repo and fetch their collections.

Response:
```json
{
  "exists": true,
  "collections": [...],
  "memberships": [...],
  "repoUrl": "https://github.com/username/web-ade-collections"
}
```

**`POST /api/github/collections`**
Create the collections repo (if it doesn't exist) and save collections.

Request:
```json
{
  "collections": [...],
  "memberships": [...]
}
```

Response:
```json
{
  "success": true,
  "repoUrl": "https://github.com/username/web-ade-collections"
}
```

**`PUT /api/github/collections`**
Update collections in existing repo.

Request:
```json
{
  "collections": [...],
  "memberships": [...]
}
```

### Shared/Org Collections

**`GET /api/github/collections/[username]`**
Fetch any user/org's public collections.

**`PUT /api/github/collections/[username]`**
Update a user/org's collections (requires write access).

**`GET /api/github/collections/[username]/permissions`**
Check if authenticated user can edit a user/org's collections.

## React Integration

### Context Provider

```tsx
import { UserCollectionsProvider, useUserCollections } from '@/contexts/UserCollectionsContext';

// Wrap your app
<UserCollectionsProvider>
  <App />
</UserCollectionsProvider>
```

### Hook Usage

```tsx
function MyComponent() {
  const {
    // State
    collections,           // Collection[]
    memberships,           // CollectionMembership[]
    loading,               // boolean
    saving,                // boolean
    error,                 // Error | null

    // GitHub state
    gitHubRepoExists,      // boolean
    gitHubRepoUrl,         // string | null

    // CRUD operations
    createCollection,      // (name, description?, icon?) => Promise<Collection>
    updateCollection,      // (id, updates) => Promise<void>
    deleteCollection,      // (id) => Promise<void>
    addRepository,         // (collectionId, repositoryId) => Promise<void>
    removeRepository,      // (collectionId, repositoryId) => Promise<void>

    // Utility
    getCollectionRepositories,  // (collectionId) => string[]
    getCollectionRepositoryInfos, // (collectionId) => RepositoryInfo[]
    getCollection,         // (id) => Collection | undefined
    isUserCollection,      // (id) => boolean
    refresh,               // () => Promise<void>
    enableGitHub,          // () => Promise<void>
  } = useUserCollections();

  // Example: Create a collection
  const handleCreate = async () => {
    const collection = await createCollection('My Collection', 'Description', 'FolderOpen');
    console.log('Created:', collection.id);
  };

  // Example: Add a repository
  const handleAddRepo = async () => {
    await addRepository(collectionId, 'owner/repo');
  };
}
```

### Getting Repositories for a Collection

```tsx
// Get just IDs
const repoIds = getCollectionRepositories(collectionId);
// ['owner/repo1', 'owner/repo2']

// Get with fork info
const repos = getCollectionRepositoryInfos(collectionId);
// [
//   { repositoryId: 'my-fork/repo', sourceRepository: { owner: 'original', name: 'repo' } },
//   { repositoryId: 'owner/repo2' }
// ]
```

## Electron Implementation Notes

### Direct GitHub API Access

Since the Electron app has direct access to GitHub tokens, you can bypass the web API and call GitHub directly:

```typescript
const REPO_NAME = 'web-ade-collections';
const COLLECTIONS_FILE = 'collections.json';
const MEMBERSHIPS_FILE = 'collection-memberships.json';

// Fetch collections
async function fetchCollections(token: string, username: string) {
  const [collectionsRes, membershipsRes] = await Promise.all([
    fetch(`https://raw.githubusercontent.com/${username}/${REPO_NAME}/main/${COLLECTIONS_FILE}`),
    fetch(`https://raw.githubusercontent.com/${username}/${REPO_NAME}/main/${MEMBERSHIPS_FILE}`),
  ]);

  const collections = collectionsRes.ok ? await collectionsRes.json() : { collections: [] };
  const memberships = membershipsRes.ok ? await membershipsRes.json() : { memberships: [] };

  return {
    collections: collections.collections || [],
    memberships: memberships.memberships || [],
  };
}

// Save collections (requires SHA for updates)
async function saveCollections(token: string, username: string, data: CollectionsData, sha?: string) {
  const response = await fetch(
    `https://api.github.com/repos/${username}/${REPO_NAME}/contents/${COLLECTIONS_FILE}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Update collections - ${new Date().toISOString()}`,
        content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
        ...(sha && { sha }),
      }),
    }
  );
  return response.json();
}
```

### Creating the Repo

```typescript
async function createCollectionsRepo(token: string) {
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'web-ade-collections',
      description: 'My web-ade collections - synced repository collections',
      public: true,
      auto_init: true,
    }),
  });
  return response.json();
}
```

### Store Integration

Consider creating a dedicated store slice:

```typescript
// src/renderer/stores/collectionsStore.ts
interface CollectionsState {
  collections: Collection[];
  memberships: CollectionMembership[];
  loading: boolean;
  saving: boolean;
  repoExists: boolean;
  repoUrl: string | null;
}

// Actions
- loadCollections()
- createCollection(name, description?, icon?)
- updateCollection(id, updates)
- deleteCollection(id)
- addRepository(collectionId, repositoryId)
- removeRepository(collectionId, repositoryId)
```

## UI Components Reference

The web-ade UI uses these components (from `@industry-theme/alexandria-panels`):

- **WorkspaceCollectionPanel** - Main collection repository list with selection
- **CollectionModal** - Create/edit collection dialog
- **AddRepositoryModal** - Add repositories to a collection

## Fork Detection

When adding a repository, check if it's a fork:

```typescript
const repoInfo = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

if (repoInfo.fork && repoInfo.parent) {
  metadata = {
    sourceRepository: {
      owner: repoInfo.parent.owner.login,
      name: repoInfo.parent.name,
    },
  };
}
```

## Package Dependencies

```json
{
  "@principal-ai/alexandria-collections": "^x.x.x"
}
```

This package provides TypeScript types:
- `Collection`
- `CollectionMembership`
- `CollectionsData`
- `CollectionMembershipsData`
