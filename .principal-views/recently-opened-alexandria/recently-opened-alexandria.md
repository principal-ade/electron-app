# Recently Opened Alexandria Entries

This feature tracks when local projects are opened and sorts the project list to show most recently opened projects first.

## Problem Solved

When users have many registered local repositories, finding the project they were working on recently becomes difficult. This feature automatically tracks which projects were opened and when, allowing the Local Projects Panel to display projects sorted by recency.

## How It Works

### Data Model

Each `AlexandriaEntry` (local repository) has two timestamp fields:
- `registeredAt`: Set when the repository is first added (immutable)
- `lastOpenedAt`: Updated each time the project is opened (optional)

Both timestamps are stored as ISO 8601 strings.

### Opening a Project

When a user opens a project from the Local Projects Panel or Worlds View:

1. The context provider calls `AlexandriaService.updateLastOpened(name)`
2. This sends an IPC message to the main process
3. `AlexandriaRegistryService` updates the entry via `AlexandriaOutpostManager`
4. The new timestamp is persisted to disk
5. A `REPOSITORY_UPDATED` event is broadcast to all windows
6. The Local Projects Panel re-fetches and re-sorts the list

### Sorting Logic

Projects are sorted with this priority:
1. Projects with `lastOpenedAt` appear before those without
2. Within each group, sort by timestamp descending (newest first)
3. Projects without `lastOpenedAt` fall back to `registeredAt`

This ensures:
- Recently opened projects always appear at the top
- New projects that haven't been opened yet appear after opened ones
- Everything maintains a consistent, predictable order

## Design Decisions

### Non-Blocking Updates

The `updateLastOpened` call is intentionally fire-and-forget. It doesn't block opening the dev workspace because:
- The timestamp is metadata, not critical data
- Failed updates don't affect functionality
- Users expect instant project opening

### Event-Driven Synchronization

Changes propagate via IPC events rather than polling because:
- Multiple windows stay synchronized
- Updates are immediate when they happen
- No unnecessary network/disk traffic

### Fallback to registeredAt

Projects without `lastOpenedAt` use `registeredAt` for sorting because:
- Provides consistent ordering for all projects
- Newer registrations appear before older ones
- No undefined behavior for edge cases

## Entry Points

There are two contexts that can trigger the timestamp update:
- `ProjectsPanelContext.openLocalRepository()` - Main entry from Local Projects Panel
- `WorldsViewPanelContext` - Alternative entry from the Worlds View

Both call the same `AlexandriaService.updateLastOpened()` method.

## Error Handling

If the timestamp update fails:
- The error is logged but not shown to users
- The project still opens normally
- The sort order remains based on previous data
- Next successful open will update the timestamp
