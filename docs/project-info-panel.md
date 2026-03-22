# ProjectInfoPanel

The ProjectInfoPanel displays information about repositories in the Projects view. It operates in two modes depending on whether a repository is selected.

## Modes

### 1. Activity Feed Mode (No Repository Selected)

When no repository is selected, the panel shows a cross-repository activity feed with recent commits from local repositories.

**Layout:**
- **Left side:** Scrollable list of recent commits (up to 20)
- **Right side:** Grid of File City images for repos with activity

**Features:**
- Commits show: repo name, relative time, commit message, author, short hash
- Hover on a commit dims unrelated images (and vice versa)
- Click on an image filters commits to that repo only
- Selected image shows primary border with glow effect
- Click again to clear filter

**Data Flow:**
1. `useActivityFeed` hook receives all local repositories from context
2. Gets mtime for each repo via `FileSystemService.getDirectoryInfo`
3. Sorts by most recently modified, takes top 10
4. Fetches last 5 commits from each repo (past 30 days)
5. Merges and sorts all commits by date descending
6. Returns up to 20 commits total

### 2. Repository Details Mode (Repository Selected)

When a repository is selected, the panel shows detailed information about that specific repo.

**Components:**

#### Commit Heat Map
GitHub-style heat map showing commit activity over the past year.

**Playback Buttons:**
- **Latest:** Plays commits from the most recent day with activity
- **Last 7 Active:** Plays commits from the last 7 days that had activity (not necessarily consecutive)
- **Full Year:** Plays through all days with commits in the past year

**Interactions:**
- Click on a day to view the historical snapshot
- Click again to deselect

#### Historical Snapshot
Shown when viewing a specific commit (via heat map click or playback).

- Shows File City image at that commit with changed files highlighted
- Displays: formatted date, +/- line counts, commit message (typewriter effect), author, short hash
- Progress bar during playback shows current position

#### Git Status (Local Repos Only)
- Current branch name
- Sync status (ahead/behind remote)
- List of changed files (staged, modified, untracked)
- Latest commit info when working tree is clean

#### Latest Commit (Remote Repos Only)
- Commit message, author with avatar, date, short hash

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/panels/ProjectInfoPanel.tsx` | Main panel component |
| `src/renderer/hooks/useActivityFeed.ts` | Fetches cross-repo commits for activity feed |
| `src/renderer/hooks/useCommitHeatMap.ts` | Fetches commit data for heat map (local repos) |
| `src/renderer/hooks/useRemoteCommitHeatMap.ts` | Fetches commit data for heat map (GitHub repos) |
| `src/renderer/components/CommitHeatMap.tsx` | Heat map visualization component |
| `src/renderer/main-process-api/GitService.ts` | Git operations (commits, file trees, etc.) |
| `src/renderer/main-process-api/GithubService.ts` | GitHub API operations |
| `src/renderer/main-process-api/FileCityImageService.ts` | Generates File City visualizations |

## State Management

### Activity Feed State
```typescript
// Repo images for the grid
const [activityRepoImages, setActivityRepoImages] = useState<Map<string, string>>(new Map());
// Hovered repo (for cross-dimming)
const [hoveredRepoPath, setHoveredRepoPath] = useState<string | null>(null);
// Selected/filtered repo
const [selectedRepoPath, setSelectedRepoPath] = useState<string | null>(null);
```

### Repository Details State
```typescript
// Heat map playback
const [isPlaying, setIsPlaying] = useState(false);
const [playMode, setPlayMode] = useState<PlayMode>('year');
const [playbackProgress, setPlaybackProgress] = useState({ current: 0, total: 0 });

// Historical snapshot
const [selectedDate, setSelectedDate] = useState<string | null>(null);
const [historicalImageUrl, setHistoricalImageUrl] = useState<string | null>(null);
const [currentCommitInfo, setCurrentCommitInfo] = useState<CommitInfo | null>(null);
```

## Context Requirements

The panel expects the following from its context:

```typescript
interface ProjectInfoPanelContext extends PanelContextValue {
  gitStatusWithFiles?: DataSlice<GitStatusWithFiles | null>;
  staleRepos?: StaleRepoInfo[];
  alexandriaRepositories?: DataSlice<{
    repositories: AlexandriaEntry[];
    loading: boolean;
  }>;
}
```

## Future Improvements

### Activity Feed
- [ ] Double-click on image to select that repository (switch to details mode)
- [ ] Click on a commit to show the diff image for that specific commit
- [ ] Aggregate heat map showing activity across all repos
- [ ] Filter by author or date range
- [ ] Search commits

### Repository Details
- [ ] Compare two commits side-by-side
- [ ] Branch visualization
- [ ] Commit graph view
- [ ] File change statistics over time

### Performance
- [ ] Virtualize long commit lists
- [ ] Cache File City images more aggressively
- [ ] Lazy load images in the grid

## Related Documentation

- [Panel Architecture](./panel-architecture.md)
- [Repository Panel System](./repository-panel-system.md)
- [Panel Implementation Guide](./panel-implementation-guide.md)
