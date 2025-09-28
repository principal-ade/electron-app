# User Profile Repository View Design

## Overview
Enhance the AuthView component to display repositories organized by organization, providing both local and remote repository management capabilities.

## Goals
1. Display local repositories from Alexandria registry organized by organization
2. Show remote repositories from GitHub for authenticated users
3. Enable cloning remote repositories and adding them to the registry
4. Provide a clean, organized interface using the panels library
5. Integrate seamlessly with existing RepositoryExplorer functionality

## Design Specifications

### Layout Structure
- **Main Container**: AuthView component extended with repository management
- **Two-panel layout** using `AnimatedResizableLayout` from `@a24z/panels`:
  - **Left Panel** (25% default width): Organization list
  - **Right Panel** (75% default width): Repository cards for selected organization

### Data Sources

#### Local Repositories (Always Available)
- Source: Alexandria registry via `AlexandriaService.getRepositories()`
- Organization extraction:
  - From `repo.github?.owner`
  - From `repo.remoteUrl` parsing
  - Default to "Local" for repositories without remote

#### Remote Repositories (When Authenticated)
- Source: GitHub API (needs implementation)
- Required endpoints:
  - `GET /user/orgs` - List user's organizations
  - `GET /user/repos` - List user's repositories
  - `GET /orgs/{org}/repos` - List organization repositories

### Component Architecture

```
AuthView (extended)
├── Authentication Status Card (existing)
├── Connected Services Card (existing)
└── Repository Management Section (new)
    ├── OrganizationSidebar
    │   ├── Organization Item (local)
    │   ├── Organization Item (remote)
    │   └── "All Repositories" option
    └── RepositoryGrid
        ├── RepositoryCard (local)
        │   ├── Name & Description
        │   ├── Branch & Status
        │   └── Open in Explorer button
        └── RepositoryCard (remote)
            ├── Name & Description
            ├── Stars & Language
            └── Clone & Add button
```

### Visual Design

#### Organization Sidebar
- List format with icons
- Visual distinction between local/remote
- Active organization highlighted
- Count badges for repositories

#### Repository Cards
- Grid layout (responsive columns)
- Card elements:
  - Repository name (bold)
  - Organization/owner (subdued)
  - Branch indicator (for local)
  - Dirty state indicator (for local)
  - Last activity timestamp
  - Action buttons

#### State Indicators
- **Local repositories**: Show git status (branch, dirty files)
- **Remote repositories**: Show stars, language, fork status
- **Already cloned**: Visual indicator and "Open" instead of "Clone"

### User Interactions

1. **Organization Selection**
   - Click organization to filter repositories
   - "All" option to show everything

2. **Local Repository Actions**
   - Click card to open in RepositoryExplorer
   - Show existing git status from enhanced repository data

3. **Remote Repository Actions**
   - Clone button triggers GitCloneModal
   - After cloning, automatically adds to Alexandria registry
   - Updates UI to reflect cloned status

### Implementation Requirements

#### New API Methods Needed
```typescript
// In GitHubAPI or new service
interface GitHubUserAPI {
  getUserOrganizations(): Promise<Organization[]>;
  getUserRepositories(): Promise<Repository[]>;
  getOrganizationRepositories(org: string): Promise<Repository[]>;
}
```

#### Data Processing
```typescript
// Group repositories by organization
function groupRepositoriesByOrg(repos: AlexandriaEntry[]): Map<string, AlexandriaEntry[]>

// Merge local and remote repositories
function mergeRepositoryLists(local: AlexandriaEntry[], remote: GitHubRepo[]): MergedRepo[]

// Check if remote repo is already cloned
function isRepositoryCloned(remote: GitHubRepo, local: AlexandriaEntry[]): boolean
```

### Integration Points

1. **AlexandriaService**: Read local repositories
2. **GitService**: Check repository status
3. **GitCloneModal**: Reuse existing cloning UI
4. **WindowService**: Open repository in explorer
5. **AuthService**: Check authentication status

### Performance Considerations

- Lazy load remote repositories after authentication
- Cache organization data with reasonable TTL
- Debounce organization selection changes
- Virtual scrolling for large repository lists

### Accessibility

- Keyboard navigation between organizations and repositories
- ARIA labels for screen readers
- Focus management when switching views
- Clear status announcements for async operations

## Implementation Phases

### Phase 1: Local Repository View
1. Create organization extraction logic
2. Build organization sidebar component
3. Create repository card grid
4. Wire up navigation to RepositoryExplorer

### Phase 2: Remote Repository Integration
1. Implement GitHub API methods
2. Add remote repository cards
3. Integrate clone functionality
4. Handle already-cloned detection

### Phase 3: Polish & Enhancement
1. Add search/filter capabilities
2. Implement sorting options
3. Add repository statistics
4. Performance optimization

## Success Metrics
- Users can see all their repositories organized by organization
- Seamless transition from remote to local after cloning
- Consistent UI/UX with existing application patterns
- Sub-second response time for organization switching