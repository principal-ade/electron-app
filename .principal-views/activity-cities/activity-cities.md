# Activity Cities

Real-time Bloomberg terminal-style activity feed showing interactive 2D File City visualizations for all repositories where users are currently active.

## Problem

When collaborating across multiple repositories, developers lack visibility into:
- Which repositories have active collaborators
- Where team members are currently working
- The structure and scale of active codebases at a glance

## Solution

Activity Cities provides a grid of interactive 2D File City visualizations, one for each repository with active users. Each city card shows:
- A treemap visualization of the repository's file structure
- The repository owner and name
- Active users with their online/away status

## Key Operations

### Navigation
- **Enter**: Click "Live Activity" button in Feed header
- **Exit**: Click back arrow in Activity Cities header
- Navigation uses `panel:switch` events via PrincipalEventContext

### Data Fetching
- **Presence**: HTTP API call to traffic controller `/api/presence/users`
  - Returns users with `extended.openRepositories` containing repo sessions
  - Auto-connects to presence if not already connected
- **File Trees**: On-demand from GitHub API via `GithubService.getTree()`
- **Caching**: 5-minute TTL cache keyed by `owner/repo:branch`

### Rendering
- Uses `ArchitectureMapHighlightLayers` from file-city-react
- Canvas-based 2D treemap with pan/zoom support
- CSS Grid layout for responsive card arrangement

## Design Choices

### 2D vs 3D Visualization
Chose 2D `ArchitectureMapHighlightLayers` over 3D FileCity because:
- Lighter weight for rendering many instances simultaneously
- Better performance with multiple cities in view
- Cleaner aesthetic for the Bloomberg terminal style
- Still supports hover interactions and zoom

### GitHub API for File Trees
Fetch file trees from GitHub API rather than local git because:
- Users may not have all repositories cloned locally
- Provides consistent experience across all repositories
- Enables viewing any repository where collaborators are active

### Presence-Driven Architecture
Repository list is derived from presence data:
- Only shows repositories with active users
- Updates in real-time as users join/leave
- No manual configuration required

## Workflow Patterns

### Typical Flow
1. User clicks "Live Activity" in Feed view
2. Panel mounts, hook ensures presence is connected
3. Fetches presence from traffic controller HTTP API (`/api/presence/users`)
4. Groups users by `extended.openRepositories`
5. For each unique repo, fetch file tree from GitHub API (with caching)
6. Build CityData from file tree using CodeCityBuilderWithGrid
7. Render grid of CityCards with ArchitectureMapHighlightLayers
8. Presence updates (via WebSocket events) trigger re-fetch

### Empty State
- Displays "No active repositories" message
- Includes explanation about when cities appear

### Error Handling
- Per-card error states (GitHub API failures)
- Global error state if presence fetch fails
- Loading states during initial fetch

## Future Enhancements (Deferred)

- **Following Filter**: Only show repos from users you follow
- **Click Actions**: Open repo, jump to file, view activity
- **Highlight Layers**: Show which files users are editing
- **Virtualization**: Performance optimization for many repos
