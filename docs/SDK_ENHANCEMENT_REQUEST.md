# SDK Enhancement Request for UI Migration

## Current Status

The observability-sdk v0.4.4 successfully writes events to Turso database but lacks the query methods needed to replace the existing local storage for UI functionality.

## UI Requirements Analysis

Based on analysis of the current UI implementation, the following functionality needs to be supported by the SDK:

### 1. Session Management

**Current UI Methods:**
- `getActiveSessions()` - Get all active sessions grouped by project/repository
- `getArchivedSessions()` - Get all archived sessions grouped by project/repository
- `getSessionsForDirectory(directory)` - Get sessions for specific directory (should be project-based)
- `getSession(sessionId, directory)` - Get complete session data with statistics
- `deleteSession(sessionId, directory)` - Delete session completely
- `deleteFromActive(sessionId)` - Move session to archive
- `clearSessionsForDirectory(directory)` - Delete all sessions in directory (should be project-based)

**Current SDK Methods:**
- ✅ `getSession(sessionId)` - Basic session retrieval
- ✅ `getRecentSessions(limit)` - Recent sessions with limit
- ✅ `upsertSession(sessionId, data)` - Create/update session
- ❌ Missing: Project/repository-based grouping
- ❌ Missing: Active vs archived session separation
- ❌ Missing: Bulk operations by project/repository

### 2. Event Retrieval

**Current UI Methods:**
- `getSessionEvents(sessionId)` - Get all normalized events for a session
- `getRawSessionEvents(sessionId)` - Get raw unprocessed events
- `getSessionStats(sessionId)` - Get session statistics (file counts, tool counts, etc.)

**Current SDK Methods:**
- ✅ `getSessionEvents(sessionId)` - **Available in PostgreSQL SDK but NOT in Turso SDK**
- ✅ `getSessionToolStats(sessionId)` - Tool usage statistics
- ❌ Missing: Raw event retrieval
- ❌ Missing: Comprehensive session statistics

### 3. Session Processing & Analytics

**Current UI Methods:**
- Extract file operations (read/write/edit) from events
- Extract todo lists from TodoWrite events
- Extract written files for git operations
- Calculate session metrics (duration, file access counts)
- Repository analysis and path normalization

**Current SDK Methods:**
- ❌ Missing: File operation extraction
- ❌ Missing: Todo extraction
- ❌ Missing: Session analytics
- ❌ Missing: Repository-based queries

### 4. Real-time Updates

**Current UI Methods:**
- Live session updates via IPC events
- Real-time event streaming to UI components
- Session creation/update notifications

**Current SDK Methods:**
- ❌ Missing: Event streaming capabilities
- ❌ Missing: Change notifications

## Required SDK Enhancements

### Priority 1: Essential Query Methods (Turso SDK)

```typescript
// Missing from TursoObservabilitySDK but available in PostgreSQL SDK
async getSessionEvents(sessionId: string): Promise<SessionEvent[]>

// New methods needed for UI migration - PROJECT/REPOSITORY-BASED
async getSessionsByProject(repositoryRoot: string): Promise<Session[]>
async getActiveSessionsGroupedByProject(): Promise<ProjectSessions[]>
async getArchivedSessionsGroupedByProject(): Promise<ProjectSessions[]>
async getSessionStatistics(sessionId: string): Promise<SessionStatistics>
async deleteSession(sessionId: string): Promise<void>
async deleteSessionsByProject(repositoryRoot: string): Promise<number>

// Interface for project-based grouping
interface ProjectSessions {
  repository: string;          // Repository root path or name
  repositoryName?: string;     // Friendly repository name
  repositoryOwner?: string;    // Git owner/organization
  summaries: SessionSummary[];
}
```

### Priority 2: Event Processing Methods

```typescript
// File operation analysis
async getSessionFileOperations(sessionId: string): Promise<FileOperation[]>
async getSessionWrittenFiles(sessionId: string): Promise<string[]>

// Todo extraction
async getSessionTodos(sessionId: string): Promise<TodoItem[]>

// Repository queries
async getSessionsByRepository(repositoryRoot: string): Promise<Session[]>
async getRepositoryStatistics(repositoryRoot?: string): Promise<RepositoryStats[]>
```

### Priority 3: Advanced Features

```typescript
// Session archiving
async archiveSession(sessionId: string, archivePath: string): Promise<void>
async restoreSession(sessionId: string, archivePath: string): Promise<void>

// Bulk operations - PROJECT-BASED
async batchDeleteSessions(sessionIds: string[]): Promise<number>
async batchArchiveSessions(sessionIds: string[]): Promise<number>
async archiveProjectSessions(repositoryRoot: string): Promise<number>

// Search and filtering - PROJECT-AWARE
async searchSessions(query: SearchQuery): Promise<Session[]>
async getSessionsWithFilter(filter: SessionFilter): Promise<Session[]>
async getProjectStatistics(repositoryRoot: string): Promise<ProjectStats>

// Project management
interface ProjectStats {
  repositoryRoot: string;
  repositoryName: string;
  repositoryOwner?: string;
  sessionCount: number;
  totalEvents: number;
  fileOperations: number;
  lastActivity: Date;
  topTools: Array<{ tool: string; count: number; }>;
}
```

## Data Model Alignment

### Current Local Storage Format
```typescript
interface ProcessedSessionData {
  sessionId: string;
  provider: string;
  workingDirectory: string;
  startTime: number;
  lastUpdateTime: number;
  events: NormalizedAgentSessionEvent[];
  totalEvents: number;
  repositoriesAccessed: string[];
  counters: {
    fileAccesses: number;
    fileWrites: number;
    toolCalls: number;
    webAccesses: number;
  };
  fileAccesses: Record<string, number>;
  fileWrites: Record<string, number>;
  filesRead: string[];
  filesWritten: string[];
  metadata: {
    lastTodos?: TodoItem[];
    customName?: string;
  };
}
```

### Required Turso Schema Extensions
```sql
-- Add project/repository fields to sessions table for project grouping
ALTER TABLE sessions ADD COLUMN repository_root TEXT;
ALTER TABLE sessions ADD COLUMN repository_name TEXT;
ALTER TABLE sessions ADD COLUMN repository_owner TEXT;
ALTER TABLE sessions ADD COLUMN repository_branch TEXT;
ALTER TABLE sessions ADD COLUMN provider TEXT;
ALTER TABLE sessions ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN custom_name TEXT;

-- Add indexes for project-based queries (repository is the primary grouping)
CREATE INDEX idx_sessions_repository_root ON sessions(repository_root);
CREATE INDEX idx_sessions_repository_name ON sessions(repository_name);
CREATE INDEX idx_sessions_archived ON sessions(is_archived);
CREATE INDEX idx_sessions_provider ON sessions(provider);
CREATE INDEX idx_sessions_repo_archived ON sessions(repository_root, is_archived);
```

## Implementation Recommendations

### Phase 1: Port PostgreSQL Methods to Turso
1. Port `getSessionEvents()` from PostgreSQL SDK to Turso SDK
2. Add project/repository-based session grouping methods
3. Add comprehensive session statistics with repository context

### Phase 2: UI-Specific Methods
1. Implement file operation extraction with project awareness
2. Add todo extraction from events
3. Add project-based search and filtering
4. Add repository statistics and analytics

### Phase 3: Performance Optimization
1. Add proper indexing for project-based UI queries
2. Implement query result caching by repository
3. Add pagination for large result sets
4. Optimize cross-repository queries

## Migration Strategy

With these SDK enhancements, the migration would follow this pattern:

1. **Dual Read**: UI reads from both local storage (primary) and Turso (validation) grouped by project
2. **Turso Primary**: UI switches to Turso as primary with project-based grouping and local storage fallback
3. **Turso Only**: Remove local storage dependencies entirely, using repository-based organization

## Estimated Development Time

- **Priority 1 Methods**: 2-3 days (essential for migration)
- **Priority 2 Methods**: 3-4 days (required for full feature parity)
- **Priority 3 Methods**: 5-7 days (advanced features)

**Total Estimated Time**: 10-14 days for complete SDK enhancement

## Conclusion

The current Turso SDK provides excellent event writing capabilities but lacks the comprehensive read methods needed for UI migration. The PostgreSQL SDK has some of the required methods that could be ported, but significant additional development is needed for project/repository-based operations, session management, and event processing methods that the UI currently relies on.

**Recommendation**: Request SDK team to prioritize Priority 1 methods first, focusing on **project/repository-based grouping** rather than directory-based operations. This aligns with git repository boundaries and provides more meaningful organization for users. This approach allows us to begin UI migration in phases while they continue developing Priority 2 and 3 enhancements.

## Key Architectural Decision

**Project-Based Organization**: Sessions should be grouped by repository/project rather than working directory because:
- A project (git repository) is the natural boundary for related work
- Sessions may span multiple subdirectories within the same project
- Repository information is already captured in events
- Users think in terms of projects, not arbitrary directory paths
- Git operations and file tracking work better with repository-relative paths