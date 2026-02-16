# Collections System

## What is it?

The Collections system allows users to organize their GitHub repositories into custom-named collections (like folders or workspaces). Collections are stored in the user's personal GitHub account in a dedicated `web-ade-collections` repository, enabling synchronization across different machines and devices.

## Problem It Solves

Developers often work with many repositories across different projects, teams, or technology stacks. Managing and organizing these repositories becomes challenging as the number grows. The Collections system provides:

1. **Organization** - Group related repositories together (e.g., "Frontend Projects", "Client Work", "Open Source")
2. **Persistence** - Collections are stored in GitHub, not locally, so they're available everywhere
3. **Metadata** - Store additional information about repositories (pinned status, notes, custom regions)
4. **Cross-device sync** - Access your organizational structure from any machine with the app

## Core Operations

### Creating a Collection

1. User clicks "Create Collection" in the UserCollectionsPanel
2. Modal opens requesting name, description (optional), and icon (optional)
3. User submits the form
4. System generates unique collection ID: `col-{timestamp}-{random}`
5. Collection is created in memory and synced to GitHub
6. UI updates to show the new collection

### GitHub Synchronization

Collections are automatically synchronized to GitHub using two JSON files:

- **`collections.json`** - Array of Collection objects with metadata
- **`collection-memberships.json`** - Array of repository associations

**Sync triggers:**
- Creating a new collection
- Updating collection metadata
- Adding/removing repositories
- Manual refresh from GitHub

**Conflict resolution:**
- Uses GitHub's SHA-based optimistic locking
- Retries up to 3 times on conflict
- Refetches latest SHA and merges changes

### Adding Repositories to Collections

Repositories can be added to collections through:
1. **Drag-and-drop** from local repositories panel
2. **Manual addition** via collection panel interface
3. **Bulk import** from GitHub API

Repository identifiers use the format: `owner/repo` for GitHub repositories.

## Design Choices

### Why GitHub Storage?

**Decision:** Store collections in user's GitHub account instead of local storage or our backend.

**Rationale:**
- **No backend costs** - Leverages GitHub's infrastructure
- **User ownership** - Data belongs to the user, not us
- **Cross-device sync** - Automatic through GitHub API
- **Transparency** - Users can view/edit raw JSON files
- **Backup** - GitHub provides versioning and backup
- **Authentication** - Reuses existing GitHub OAuth flow

**Trade-offs:**
- Requires GitHub authentication
- API rate limits apply
- Slightly slower than local storage
- Public repository (could be private in future)

### Why Two Files (collections.json + memberships.json)?

**Decision:** Separate collections metadata from repository associations.

**Rationale:**
- **Normalization** - Avoid data duplication
- **Flexibility** - Repositories can belong to multiple collections
- **Smaller updates** - Adding a repo doesn't require rewriting all collection metadata
- **Query efficiency** - Can filter memberships by collection or repository

### Event-Driven Architecture

**Decision:** Use PanelEventBus for cross-panel communication.

**Rationale:**
- **Decoupling** - Panels don't need direct references to each other
- **Extensibility** - New panels can listen to collection events
- **Consistency** - Centralized event handling ensures UI stays in sync
- **Debugging** - Events are traceable and loggable

## Common Workflows

### First-time Setup

1. User creates their first collection
2. System checks if `web-ade-collections` repo exists
3. If not, creates public repository with `auto_init: true`
4. Waits 1 second for GitHub initialization
5. Syncs empty collections array to GitHub
6. Returns repo URL to user

### Multi-device Sync

1. User opens app on Device A, creates collections
2. Collections sync to GitHub automatically
3. User opens app on Device B
4. App fetches collections from GitHub on load
5. Both devices stay in sync through GitHub

### Offline Behavior

- Collections are cached in React context state
- Changes accumulate in memory
- Next sync attempt uploads all changes
- If sync fails, user is notified to retry

## Error Scenarios

### GitHub API Rate Limiting

**Scenario:** User exceeds GitHub API rate limit (5000 requests/hour for authenticated users).

**Handling:**
- Service returns error with rate limit details
- UI shows user-friendly error message
- Retry with exponential backoff
- Cache collections in memory to reduce API calls

### Network Failures

**Scenario:** User is offline or GitHub is unreachable.

**Handling:**
- Collections remain available from cached state
- Write operations fail gracefully
- User is notified sync failed
- Manual retry available

### Concurrent Edits (SHA Conflicts)

**Scenario:** User edits collections on two devices simultaneously.

**Handling:**
- GitHub returns 409 conflict
- Service refetches latest SHA
- Retries update with fresh SHA
- After 3 retries, reports error to user
- User can manually refresh and retry

### Repository Not Found

**Scenario:** User adds a repository that was deleted or made private.

**Handling:**
- Repository ID is stored (won't fail)
- UI shows repository as "unavailable"
- User can remove from collection
- No automatic cleanup (user decision)

## Future Enhancements

- **Private collections** - Store in private GitHub repo
- **Collection templates** - Pre-defined collection structures
- **Smart collections** - Auto-add repos based on rules
- **Sharing** - Share collections with team members
- **Import/export** - Backup to local file
- **Custom regions** - Visual organization within collections (already implemented for Overworld Map)
