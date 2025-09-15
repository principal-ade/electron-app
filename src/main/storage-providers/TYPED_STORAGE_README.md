# Typed Storage System

## Overview

This document describes the new type-safe storage system that provides compile-time type safety for namespace operations.

## Problem Solved

Previously, the storage system used generic `any` types for all namespace operations, which led to:
- No compile-time type checking
- Runtime errors from type mismatches
- Difficulty understanding what data belongs in each namespace
- No IntelliSense/autocomplete support

## Solution

The new typed storage system provides:

### 1. **Namespace-Specific Type Definitions** (`typed-namespaces.ts`)
- Each namespace has a strongly-typed data structure
- Clear definition of what data belongs in each namespace
- Type-safe namespace registry

### 2. **Type-Safe Storage Interface** (`typed-storage-interface.ts`)
- Extended interfaces with namespace-specific typing
- Validation helpers for runtime type checking
- Namespace-specific operations with proper typing

### 3. **Typed MultiStore Wrapper** (`typed-multistore-wrapper.ts`)
- Wraps the existing MultiStoreManager with type safety
- Provides compile-time type checking for all operations
- Backward compatible with existing code

## Key Features

### Type Safety
```typescript
// ✅ Correct - types match
await setTyped('prefs', { autoCommitOnStop: true }, StorageNamespaces.USER_PREFERENCES);

// ❌ TypeScript Error - wrong type for namespace
await setTyped('prefs', ['array'], StorageNamespaces.USER_PREFERENCES);
```

### IntelliSense Support
```typescript
const prefs = await getTyped('settings', StorageNamespaces.USER_PREFERENCES);
// prefs is typed as UserPreferences | undefined
// Full IntelliSense for prefs.autoCommitOnStop, etc.
```

### Namespace Categories
- **CORE**: Essential application data (preferences, repositories, AI config)
- **AGENT_SESSION_EVENTS**: Agent session and event data
- **CACHE**: Temporary/cache data that can be cleared
- **LEGACY**: Old namespaces to be migrated

## Usage Examples

### Simple Type-Safe Operations
```typescript
import { getTyped, setTyped, StorageNamespaces } from './storage-providers';

// Set with type safety
const repos: Repository[] = [{ name: 'my-repo', path: '/path', type: 'git' }];
await setTyped('repos', repos, StorageNamespaces.REPOSITORIES);

// Get with proper typing
const savedRepos = await getTyped('repos', StorageNamespaces.REPOSITORIES);
// savedRepos is Repository[] | undefined
```

### Namespace-Specific Operations
```typescript
import { getNamespace, StorageNamespaces } from './storage-providers';

// Get typed operations for a namespace
const repoOps = await getNamespace(StorageNamespaces.REPOSITORIES);

// All operations are type-safe
await repoOps.set('my-repos', repositories);
const all = await repoOps.getAll(); // Returns Record<string, Repository[]>
```

### Advanced Features
```typescript
const typedStore = await getTypedStorageManager();

// Batch operations
const items = new Map<string, Repository[]>();
items.set('work', workRepos);
items.set('personal', personalRepos);
await typedStore.batchSet(StorageNamespaces.REPOSITORIES, items);

// Migration with transformation
await typedStore.migrate(
  StorageNamespaces.CACHE,
  StorageNamespaces.TEMP,
  (data) => ({ ...data, migrated: true })
);
```

## Namespace Data Types

| Namespace | Data Type | Description |
|-----------|-----------|-------------|
| USER_PREFERENCES | `UserPreferences` | User settings and preferences |
| REPOSITORIES | `Repository[]` | Repository configurations |
| SESSIONS | `Record<string, AgentSessionRecord>` | Agent session records (deprecated) |
| AI_CONFIGURATION | `AIConfiguration` | AI provider settings |
| LLM_MODELS | `LLMConfiguration` | LLM model configurations |
| CACHE | `Record<string, any>` | General cache storage |
| TEMP | `Record<string, any>` | Temporary storage |
| AGENT_SESSIONS | `ProcessedSessionData` | Agent session data with flat event list |
| REPOSITORY_NOTES | `RepositoryNote` | Notes associated with repositories |

## Migration Guide

### From Legacy Store
```typescript
// Old way
legacyStore.set('repositories', repos);

// New typed way
await getTyped('items', StorageNamespaces.RECENT_ITEMS);
await setTyped('repos', repos, StorageNamespaces.REPOSITORIES);
```

### From Untyped MultiStoreManager
```typescript
// Old way
await manager.get('key', 'repositories');
await manager.set('key', value, 'repositories');

// New typed way
await getTyped('key', StorageNamespaces.REPOSITORIES);
await setTyped('key', value, StorageNamespaces.REPOSITORIES);
```

## Benefits

1. **Compile-time Safety**: Catch type errors during development
2. **Better IntelliSense**: Full autocomplete for all data structures
3. **Self-documenting**: Clear understanding of what data belongs where
4. **Runtime Validation**: Optional validation for data integrity
5. **Backward Compatible**: Works alongside existing untyped code
6. **Maintainable**: Easier to refactor and extend

## Files Structure

```
storage-providers/
├── types.ts                      # Original type definitions
├── typed-namespaces.ts          # Namespace data type mappings
├── typed-storage-interface.ts   # Type-safe interfaces
├── typed-multistore-wrapper.ts  # Implementation wrapper
├── typed-usage-example.ts       # Usage examples
└── index.ts                      # Updated exports
```

## Best Practices

1. Always use the typed functions when possible
2. Define clear data structures for each namespace
3. Use namespace categories to organize related data
4. Validate data at runtime for external sources
5. Keep namespace data types simple and serializable

## Future Improvements

- Add schema validation using libraries like Zod
- Implement automatic migration for schema changes
- Add namespace-specific middleware/hooks
- Support for encrypted namespaces
- Better error messages with type hints