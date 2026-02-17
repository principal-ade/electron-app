# CollectionMapPanel Interactions

## What This Feature Does

The CollectionMapPanel provides an interactive visual interface for organizing and managing collections of repositories. It allows users to:

- **Organize repositories into custom regions** - Group related repositories together visually
- **Position repositories on a 2D map** - Arrange repositories spatially to reflect their relationships
- **Switch between auto and manual layout modes** - Choose between automatic or manual control over positioning
- **Drag and drop repositories** - Move repositories between regions or reposition them within regions
- **Create, edit, and delete custom regions** - Define organizational boundaries for repository groups

## Problem It Solves

When working with multiple repositories, it's challenging to understand and visualize their relationships. Traditional list-based views don't capture the spatial or hierarchical relationships between codebases. The CollectionMapPanel solves this by:

1. **Providing visual context** - Repositories can be positioned to reflect their relationships (e.g., frontend near backend)
2. **Supporting flexible organization** - Users can create custom regions that match their mental models (e.g., "Services", "Libraries", "Tools")
3. **Enabling quick navigation** - Visual layout makes it easier to find and access related repositories

## Available Operations

### Region Management
- **Create Region** - Define a new organizational boundary with name, color, and initial position
- **Update Region** - Modify region properties (name, color, position, size)
- **Delete Region** - Remove a region (repositories are unassigned but remain in the collection)

### Repository Positioning
- **Assign to Region** - Associate a repository with a specific region
- **Position Repository** - Set the x, y coordinates and size of a repository within the map
- **Drag and Drop** - Interactively move repositories between regions or adjust positions

### Layout Modes
- **Auto Mode** - System automatically positions repositories using a force-directed layout
- **Manual Mode** - User has full control over all positions and regions
- **Switch Mode** - Toggle between auto and manual, preserving manual customizations

### Batch Operations
- **Initialize Default Regions** - Set up starter regions when a collection is first created
- **Batch Layout Initialization** - Apply regions, assignments, and positions in a single operation (optimized for performance)

## Design Choices

### Optimistic Updates
All interactions apply changes to the local UI state immediately before syncing to GitHub. This provides:
- **Instant feedback** - UI responds immediately to user actions
- **Smooth UX** - No loading spinners for common operations
- **Rollback on error** - If GitHub sync fails, changes are reverted automatically

### GitHub as Source of Truth
Collections and their metadata (regions, positions, assignments) are stored in GitHub:
- **Version control** - Full history of collection changes
- **Sync across devices** - Changes propagate to all instances
- **Collaboration** - Multiple users can work with shared collections

### Event-Driven Architecture
The panel communicates via events rather than direct coupling:
- **Loose coupling** - Panels can be added/removed without breaking the system
- **Extensibility** - New panels can subscribe to collection events
- **Coordination** - Multiple panels stay synchronized via events (e.g., selection changes)

### Performance Optimizations
- **Batch updates** - Multiple changes (regions + assignments + positions) applied in one state update
- **Background sync** - GitHub synchronization happens asynchronously without blocking UI
- **Memoized slices** - Data slices recompute only when dependencies change

## Common Workflows

### Creating a New Collection Map
1. User creates a collection in UserCollectionsPanel
2. Collection is selected, triggering `collection:selected` event
3. CollectionMapPanel receives empty collection
4. System calls `onInitializeDefaultRegions` with starter regions
5. Repositories can be dragged into regions

### Organizing Repositories
1. User drags repository from unassigned area
2. Repository is dropped on a region
3. CollectionMapPanel calls `onRepositoryAssigned(collectionId, repositoryId, regionId)`
4. Provider updates membership metadata optimistically
5. Background sync to GitHub via CollectionsService

### Adjusting Layout
1. User drags repository to new position
2. CollectionMapPanel calls `onRepositoryPositionUpdated(collectionId, repositoryId, layout)`
3. Provider updates membership metadata with new x, y coordinates
4. UI updates immediately, GitHub sync happens in background

### Switching to Manual Mode
1. User clicks "Switch to Manual" button
2. CollectionMapPanel calls `onSwitchLayoutMode(collectionId, 'manual')`
3. Auto-layout stops, user gains full control
4. All positions are preserved from auto mode

## Error Scenarios and Recovery

### GitHub Sync Failure
- **Optimistic update succeeded, sync failed** - Changes revert via `fetchCollections()` rollback
- **User sees error notification** - Toast or modal explains the issue
- **Retry mechanism** - User can manually trigger sync again

### Invalid Region Configuration
- **Region creation fails validation** - Error is caught, no state change applied
- **User receives feedback** - Error message explains what's wrong

### Concurrent Modifications
- **Two users modify same collection** - Last write wins (GitHub's default behavior)
- **Future: Conflict detection** - Could add version checking or merge strategies

### Network Offline
- **Optimistic updates still work** - Local UI remains responsive
- **Sync queued** - Changes sync when network returns
- **User feedback** - Indicator shows "syncing" vs "synced" state
