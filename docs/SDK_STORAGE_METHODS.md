# Required SDK Methods for Event Storage Offload

## Overview

To eliminate local event storage responsibility, the `@a24z/observability-sdk` needs to provide comprehensive session and event storage methods. This document outlines the required SDK API methods to replace the current local storage system.

## Current Architecture

**Today:**
- Electron app processes and stores events locally (electron-store)
- Observability integration forwards events to SDK for analytics only
- UI queries local storage for session data

**Target:**
- SDK handles all event storage and retrieval
- Electron app only processes events and forwards to SDK
- UI queries SDK directly for session data

## Required SDK Methods

### 1. Session Management

#### `createSession(sessionData: CreateSessionRequest): Promise<SessionMetadata>`
Creates a new session in the SDK storage.

```typescript
interface CreateSessionRequest {
  sessionId: string;
  provider: SupportedAgent;
  workingDirectory: string;
  startTime: number;
  metadata?: Record<string, any>;
}

interface SessionMetadata {
  sessionId: string;
  provider: SupportedAgent;
  workingDirectory: string;
  startTime: number;
  lastUpdateTime: number;
  totalEvents: number;
  status: 'active' | 'completed' | 'archived';
  metadata?: Record<string, any>;
}
```

#### `updateSession(sessionId: string, updates: Partial<SessionMetadata>): Promise<void>`
Updates session metadata (e.g., last activity time, status).

#### `endSession(sessionId: string, endTime?: number): Promise<void>`
Marks a session as completed with optional end time.

#### `deleteSession(sessionId: string): Promise<boolean>`
Deletes a session and all its events.

### 2. Event Storage

#### `storeEvent(event: RepoNormalizedUniversalAgentSessionEvent): Promise<void>`
Stores a single processed event. The SDK should handle:
- Event deduplication
- Session association
- Indexing for queries
- Repository context storage

#### `storeEvents(sessionId: string, events: RepoNormalizedUniversalAgentSessionEvent[]): Promise<void>`
Batch store multiple events for a session.

### 3. Session Queries

#### `getSession(sessionId: string): Promise<SessionData | null>`
Retrieves complete session data including all events.

```typescript
interface SessionData {
  metadata: SessionMetadata;
  events: RepoNormalizedUniversalAgentSessionEvent[];
  counters?: {
    fileAccesses: number;
    fileWrites: number;
    toolCalls: number;
    webAccesses: number;
  };
  repositoriesAccessed?: Array<{
    remoteUrl: string;
    gitRoot: string;
  }>;
}
```

#### `getSessionMetadata(sessionId: string): Promise<SessionMetadata | null>`
Retrieves only session metadata (for performance).

#### `getSessionEvents(sessionId: string, options?: QueryOptions): Promise<RepoNormalizedUniversalAgentSessionEvent[]>`
Retrieves events for a session with optional filtering.

```typescript
interface QueryOptions {
  limit?: number;
  offset?: number;
  eventTypes?: string[];
  toolNames?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
}
```

### 4. Directory/Workspace Queries

#### `getActiveSessions(directory?: string): Promise<SessionSummary[]>`
Gets active sessions, optionally filtered by directory.

```typescript
interface SessionSummary {
  sessionId: string;
  directory: string;
  agentCLI: string;
  startTime: number;
  lastActivity: number;
  endTime?: number;
  active: boolean;
  needsReview?: boolean;
  eventCount: number;
  fileCount?: number;
  toolUseCount?: number;
  repositoriesAccessed?: string[];
  customName?: string;
}
```

#### `getArchivedSessions(directory?: string): Promise<SessionSummary[]>`
Gets archived sessions for a directory.

#### `getSessionsForDirectory(directory: string): Promise<{active: SessionSummary[], archived: SessionSummary[]}>`
Gets both active and archived sessions for a specific directory.

### 5. Advanced Queries

#### `querySessions(query: SessionQuery): Promise<SessionSummary[]>`
Advanced session querying with filters.

```typescript
interface SessionQuery {
  directory?: string;
  provider?: SupportedAgent;
  status?: 'active' | 'completed' | 'archived';
  timeRange?: {
    start: number;
    end: number;
  };
  hasRepository?: string; // Git remote URL
  minEvents?: number;
  maxEvents?: number;
  customName?: string;
  limit?: number;
  offset?: number;
}
```

#### `searchEvents(query: EventSearchQuery): Promise<SearchResult[]>`
Search across all events with advanced filters.

```typescript
interface EventSearchQuery {
  text?: string; // Search in tool input/output
  toolNames?: string[];
  eventTypes?: string[];
  providers?: SupportedAgent[];
  directories?: string[];
  repositories?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
  filePaths?: string[]; // Events that touched these files
  limit?: number;
  offset?: number;
}

interface SearchResult {
  sessionId: string;
  event: RepoNormalizedUniversalAgentSessionEvent;
  highlights?: string[]; // Search result highlights
}
```

### 6. Archive Management

#### `archiveSession(sessionId: string, options?: ArchiveOptions): Promise<void>`
Moves a session to archive storage.

```typescript
interface ArchiveOptions {
  compression?: boolean;
  retention?: 'short' | 'medium' | 'long' | 'permanent';
  includeRawEvents?: boolean;
}
```

#### `unarchiveSession(sessionId: string): Promise<void>`
Moves a session back from archive to active storage.

#### `cleanupArchives(olderThan: number, options?: CleanupOptions): Promise<CleanupResult>`
Removes old archived sessions.

```typescript
interface CleanupOptions {
  dryRun?: boolean;
  maxSessions?: number;
  excludeRecent?: boolean;
}

interface CleanupResult {
  sessionsRemoved: number;
  spaceFreed: number; // bytes
  errors: string[];
}
```

### 7. Metadata Management

#### `updateSessionMetadata(sessionId: string, metadata: Record<string, any>): Promise<void>`
Updates session metadata (e.g., custom names, tags).

#### `getSessionStats(sessionId: string): Promise<SessionStats>`
Gets computed statistics for a session.

```typescript
interface SessionStats {
  duration: number;
  toolUsage: Record<string, number>;
  fileOperations: {
    reads: number;
    writes: number;
    uniqueFiles: number;
  };
  repositoryInteractions: number;
  errorRate: number;
}
```

### 8. Real-time Subscriptions

#### `subscribeToSession(sessionId: string, callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void): () => void`
Subscribe to new events for a specific session.

#### `subscribeToDirectory(directory: string, callback: (event: SessionEvent) => void): () => void`
Subscribe to session lifecycle events in a directory.

```typescript
type SessionEvent =
  | { type: 'created'; sessionId: string; directory: string }
  | { type: 'updated'; sessionId: string; directory: string }
  | { type: 'ended'; sessionId: string; directory: string }
  | { type: 'archived'; sessionId: string; directory: string }
  | { type: 'deleted'; sessionId: string; directory: string };
```

### 9. Bulk Operations

#### `bulkDeleteSessions(sessionIds: string[]): Promise<BulkOperationResult>`
Delete multiple sessions.

#### `bulkArchiveSessions(sessionIds: string[], options?: ArchiveOptions): Promise<BulkOperationResult>`
Archive multiple sessions.

#### `exportSessions(sessionIds: string[], format: 'json' | 'csv' | 'markdown'): Promise<ExportResult>`
Export session data.

```typescript
interface BulkOperationResult {
  successful: number;
  failed: number;
  errors: Array<{sessionId: string; error: string}>;
}

interface ExportResult {
  data: string | Buffer;
  format: string;
  sessionCount: number;
  eventCount: number;
}
```

### 10. Health & Monitoring

#### `getStorageStats(): Promise<StorageStats>`
Gets storage usage and performance statistics.

```typescript
interface StorageStats {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  totalEvents: number;
  storageUsed: number; // bytes
  averageSessionSize: number;
  oldestSession: number;
  newestSession: number;
}
```

#### `healthCheck(): Promise<HealthStatus>`
Checks storage system health.

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: 'ok' | 'error';
    storage: 'ok' | 'error';
    indexing: 'ok' | 'error';
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
}
```

## Implementation Priority

### Phase 1: Core Storage (Week 1-2)
1. `createSession`, `storeEvent`, `getSession`, `getSessionMetadata`
2. `getActiveSessions`, `getArchivedSessions`, `getSessionsForDirectory`
3. `updateSession`, `endSession`, `deleteSession`

### Phase 2: Advanced Queries (Week 3)
1. `querySessions`, `searchEvents`
2. `getSessionEvents` with filtering
3. `updateSessionMetadata`, `getSessionStats`

### Phase 3: Archive & Bulk Operations (Week 4)
1. `archiveSession`, `unarchiveSession`, `cleanupArchives`
2. Bulk operations (`bulkDeleteSessions`, `bulkArchiveSessions`, `exportSessions`)
3. Real-time subscriptions

### Phase 4: Monitoring & Optimization (Week 5)
1. Health checks and monitoring
2. Performance optimization
3. Advanced analytics support

## Migration Impact

**Electron App Changes:**
- Remove local storage logic
- Replace storage API calls with SDK calls
- Update UI to query SDK directly
- Simplify session management code

**SDK Requirements:**
- ACID-compliant storage
- High-performance queries
- Scalable architecture
- Comprehensive error handling

**Benefits:**
- Centralized session storage
- Better analytics capabilities
- Simplified electron app maintenance
- Improved data consistency

## Error Handling

All SDK methods should return detailed error information:

```typescript
interface SDKError {
  code: 'NOT_FOUND' | 'PERMISSION_DENIED' | 'STORAGE_FULL' | 'NETWORK_ERROR' | 'VALIDATION_ERROR';
  message: string;
  details?: any;
  retryable?: boolean;
}
```

## Authentication & Authorization

The SDK should handle:
- API key authentication
- Session ownership validation
- Rate limiting
- Data isolation between users/organizations

---

*This specification provides the complete API surface needed to offload event storage responsibility from the electron app to the observability SDK.*