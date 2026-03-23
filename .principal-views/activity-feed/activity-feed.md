# Activity Feed Feature

The Activity Feed is the default view in the Principal application, showing a cross-repository commit activity feed with File City visualization images.

## Overview

When the user opens Principal or clicks the "Feed" navigation item, they see:
- **Left Panel**: A list of recent commits across all local repositories, sorted by date
- **Right Panel**: A grid of File City images representing repositories with recent activity

## Key Components

### FeedView (`src/renderer/principal-window/views/FeedView/FeedView.tsx`)
The main view component that wraps everything in a `FeedPanelProvider`. It provides:
- Repository data from Alexandria
- Actions for getting File City images and opening repositories
- Event bus for panel communication

### ActivityFeedPanel (`src/renderer/panels/ActivityFeedPanel.tsx`)
The panel component that renders:
- Commit list with repo name, message, author, hash, and relative time
- Repository image grid with File City visualizations
- Hover/selection state for filtering commits by repository

### useActivityFeed Hook (`src/renderer/hooks/useActivityFeed.ts`)
Fetches recent commits from multiple repositories:
1. Gets all local repositories from Alexandria
2. Sorts by modification time (most recent first)
3. Takes top N repos (default: 10)
4. Fetches recent commits from each repo (last 30 days)
5. Aggregates and sorts commits by date
6. Returns limited total commits (default: 20)

## Data Flow

1. **View Activation**: User clicks "Feed" in sidebar → IntegratedShell renders FeedView
2. **Repository Loading**: FeedPanelProvider fetches repositories from AlexandriaService
3. **Activity Loading**: useActivityFeed hook processes repositories:
   - FileSystemService.getDirectoryInfo() for mtime sorting
   - GitService.getCommitsInDateRange() for commit data
4. **Image Loading**: ActivityFeedPanel fetches File City images for unique repos
5. **Rendering**: Panel displays commits and repo image grid

## User Interactions

| Interaction | Result |
|------------|--------|
| Hover commit | Dims other commits, highlights matching repo image |
| Click commit | Navigates to repository in Projects view |
| Click repo image | Filters commits to show only that repo |
| Double-click repo image | Opens repository in dev workspace |

## Files

- `src/renderer/principal-window/views/FeedView/FeedView.tsx` - View with provider
- `src/renderer/panels/ActivityFeedPanel.tsx` - Panel component
- `src/renderer/hooks/useActivityFeed.ts` - Commit aggregation hook
- `src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx` - Feed nav item
- `src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx` - View routing
- `src/shared/types/userPreferences.types.ts` - NavigationView type
