# Activity Feed Feature

The Activity Feed is the default view in the Principal application, showing commit activity with two modes:
- **My Activity**: Local commits from repositories on disk
- **Watched Activity**: Remote commits from watched GitHub users/repos via web-ade

## Overview

When the user opens Principal or clicks the "Feed" navigation item, they see a segmented control to toggle between two feed modes:

### My Activity Mode (Local)
- **Left Panel**: Repository list with filtering
- **Middle Panel**: Commit activity cards with File City images
- **Right Panel**: Terminal

### Watched Activity Mode (Remote)
- **Left Panel**: Watched users/repos manager with GitHub search
- **Middle Panel**: Commit activity cards from watched sources
- **Right Panel**: Terminal

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

### WatchedItemsPanel (`src/renderer/panels/WatchedItemsPanel.tsx`)
Manages watched GitHub users and repositories:
- Tab switcher between Users and Repositories
- Input field to add new watches (username or owner/repo format)
- Lists of currently watched items with unwatch buttons
- Triggers feed refresh after watch/unwatch operations

### useWatchedActivityFeed Hook (`src/renderer/hooks/useWatchedActivityFeed.ts`)
Fetches commits from watched sources via web-ade API:
1. Checks authentication status
2. Fetches commit queue from web-ade (grouped by repo + hour)
3. Transforms web-ade format to ActivityFeedPanel format
4. Returns repo groups with commits sorted by time

### WebAdeService (`src/main/services/WebAdeService.ts` + `src/renderer/main-process-api/WebAdeService.ts`)
Proxies web-ade API requests through main process via TIPC:
- `getCommitQueue(limit)` - Fetch watched commit activity cards
- `getWatches()` - Get current watched users and repos
- `watchUser(login)` - Add GitHub user to watch list
- `unwatchUser(login)` - Remove GitHub user from watch list
- `watchRepo(owner, repo)` - Add GitHub repository to watch list
- `unwatchRepo(owner, repo)` - Remove GitHub repository from watch list
- `getActivityHeatmap(options)` - Get activity heatmap data

## Data Flow

### My Activity Mode
1. **View Activation**: User clicks "Feed" in sidebar → IntegratedShell renders FeedView
2. **Repository Loading**: FeedPanelProvider fetches repositories from AlexandriaService
3. **Activity Loading**: useActivityFeed hook processes repositories:
   - FileSystemService.getDirectoryInfo() for mtime sorting
   - GitService.getCommitsInDateRange() for commit data
4. **Image Loading**: ActivityFeedCardPanel builds File City for each repo
5. **Rendering**: Panel displays commit cards with inline File City images

### Watched Activity Mode
1. **Mode Toggle**: User clicks "Watched" in segmented control
2. **Panel Switch**: Left panel switches from ProjectsListPanel to WatchedItemsPanel
3. **Watch Management**:
   - User enters username or owner/repo → WatchedItemsPanel → WebAdeService (renderer)
   - TIPC call to webAdeRouter → WebAdeService (main) → Web-ADE API
   - Response with updated watch list → Panel re-renders
4. **Activity Loading**: useWatchedActivityFeed hook:
   - Calls WebAdeService.getCommitQueue(limit)
   - Transforms CommitActivityCard[] to WatchedRepoGroup[]
5. **Rendering**: ActivityFeedCardPanel displays watched commits (no local git operations)

## User Interactions

### Feed Mode Toggle
| Interaction | Result |
|------------|--------|
| Click "My Activity" | Switches to local commits, shows ProjectsListPanel on left |
| Click "Watched" | Switches to remote commits, shows WatchedItemsPanel on left |

### My Activity Mode
| Interaction | Result |
|------------|--------|
| Hover commit card | Animates to show latest commit message |
| Click commit in card | Opens commit details overlay |
| Click repo in list | Filters feed to show only that repository |
| Click repo card | Opens repository in dev workspace |

### Watched Activity Mode
| Interaction | Result |
|------------|--------|
| Enter username + Add | Watches GitHub user, refreshes feed |
| Enter owner/repo + Add | Watches GitHub repository, refreshes feed |
| Click Unwatch | Removes from watch list, refreshes feed |
| Hover/click cards | Same as My Activity mode |

## Files

### View & Framework
- `src/renderer/principal-window/views/FeedView/FeedView.tsx` - View with feed mode toggle
- `src/renderer/feed-view/FeedPanelFramework.tsx` - Panel layout framework
- `src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx` - Feed nav item
- `src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx` - View routing

### Components
- `src/renderer/components/SegmentedControl.tsx` - Mode toggle UI component
- `src/renderer/panels/ActivityFeedCardPanel.tsx` - Activity cards panel (both modes)
- `src/renderer/panels/ProjectsListPanel.tsx` - Repository list (my-activity mode)
- `src/renderer/panels/WatchedItemsPanel.tsx` - Watch management (watched-activity mode)
- `src/renderer/panels/RepoActivityCard.tsx` - Individual repo activity card

### Live Activity / File City Cards
The `CityCard` component displays 2D File City visualizations for repositories with active presence.

`CityCard` is rendered in `src/renderer/panels/ActivityCitiesPanel.tsx` - the dedicated activity cities panel used throughout the application.

### Hooks
- `src/renderer/hooks/useActivityFeed.ts` - Local commit aggregation
- `src/renderer/hooks/useWatchedActivityFeed.ts` - Watched commit aggregation

### Services & API
- `src/renderer/main-process-api/WebAdeService.ts` - Renderer web-ade service wrapper
- `src/main/services/WebAdeService.ts` - Main process web-ade HTTP client
- `src/main/web-ade/tipc/webAdeRouter.ts` - TIPC router for web-ade operations
- `src/renderer/tipc/webAdeClient.ts` - TIPC client for renderer
- `src/shared/tipc/webAdeRouterTypes.ts` - Shared types for web-ade TIPC

### Types
- `src/shared/types/userPreferences.types.ts` - NavigationView type
