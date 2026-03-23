# Activity Feed Design

## Core Design Principles

### 1. Aggregation First
The feed is **repo-centric**, not commit-centric. Users see repositories sorted by latest activity, not a flat list of commits. Each repo card summarizes recent activity and can be expanded for details.

### 2. Passive Information Absorption
The last 24 hours of activity should be **animated passively** - users feel like they're absorbing information just by looking at the feed. The File City visualization and typewriter text create an ambient awareness of what's happening across their repositories.

### 3. Progress and Completion
Users should feel **"caught up"** after viewing the feed. The design should:
- Convey a sense of bounded scope (last 24 hours, not infinite scroll)
- Show clear progress indicators
- Help users organize attention in a directed fashion
- Provide closure ("you've seen everything important")

### 4. Drill-Down Depth
Surface level is passive/ambient. Drilling down reveals:
- Individual commits with diffs
- File City evolution playback
- Upstream delta ("you're 15 commits behind")

---

## Mental Models for Activity

| Mental Model | User Need | Design Response |
|--------------|-----------|-----------------|
| **Personal** | "What have I been doing?" | My commits, my repos |
| **Collections** | "What's happening in repos I care about?" | Filtered by collection (secondary) |
| **Catch-up** | "What did I miss upstream?" | Behind-main indicators, playback |
| **Social/Trending** | "What's popular right now?" | Website version, aggregated popular repos |

---

## Feed Structure

### Primary View: Aggregated Repo Cards

```
┌─────────────────────────────────────────────────────────────┐
│  Last 24 Hours                              [All caught up] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ┌──────────┐  electron-app                    2h ago   ││
│  │ │ File     │  5 commits · +342 / -89 lines             ││
│  │ │ City     │                                           ││
│  │ │ Preview  │  feat: add activity feed panel            ││
│  │ │          │  fix: type errors in FeedView             ││
│  │ └──────────┘  +3 more                       [▶ Play]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ┌──────────┐  react (fork)                    5h ago   ││
│  │ │ File     │  🔴 23 commits behind upstream            ││
│  │ │ City     │                                           ││
│  │ │ Preview  │  Your last sync: 3 days ago               ││
│  │ │          │                                           ││
│  │ └──────────┘  [▶ See what changed] [Sync]              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ┌──────────┐  docs-site                       1d ago   ││
│  │ │ File     │  No new activity                          ││
│  │ │ City     │  Last commit: "Update README" · 3 days    ││
│  │ │ Preview  │                                           ││
│  │ └──────────┘                                 [Open]    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Repo Card States

| State | Visual Treatment | User Action |
|-------|------------------|-------------|
| **Active (commits today)** | Animated File City, commit list | Play, drill down |
| **Behind upstream** | Warning indicator, commit count | See changes, sync |
| **Quiet** | Dimmed, minimal info | Open if needed |
| **Stale** | Badge with days/size | Review, archive |

---

## Animation & Passive Experience

### Ambient Animation (Auto-play)
When the feed loads, the **most recent repo** begins a subtle animation:
1. File City shows the state from 24h ago
2. Commits "play" forward with typewriter text
3. Buildings grow/change as files are modified
4. Animation completes → repo card settles into "viewed" state

### User-Triggered Playback
Clicking "Play" on any repo:
1. Expands the card
2. Shows full File City visualization
3. Plays through commits with:
   - Typewriter commit messages
   - File diff highlights on the map
   - Line count changes (+/-)

---

## Progress & Completion

### "Caught Up" State
The feed should communicate completion:
- Header shows "All caught up" or "5 repos with activity"
- Viewed repos have subtle visual distinction
- Empty state: "No activity in the last 24 hours"

### Bounded Scope
- Default: Last 24 hours
- Option to expand: "Show last 7 days"
- Not infinite scroll - finite, completable

### Attention Direction
Help users know where to focus:
1. **Red indicators**: Behind upstream (action needed)
2. **Activity count**: Commits today (information)
3. **Quiet repos**: Collapsed/dimmed (no attention needed)

---

## Data Architecture

### Aggregation Layer
```typescript
interface RepoActivitySummary {
  repoPath: string;
  repoName: string;

  // Time boundaries
  latestCommitAt: Date;
  oldestActivityAt: Date;  // Start of 24h window

  // Aggregated stats
  commitCount: number;
  totalAdditions: number;
  totalDeletions: number;

  // Preview data
  topCommits: CommitInfo[];  // First 3-5 for preview

  // Upstream status
  upstreamDelta?: {
    behind: number;
    ahead: number;
    lastSyncAt: Date;
  };

  // File City snapshot
  fileCityImageUrl?: string;
  fileCityAnimation?: {
    startSnapshot: string;  // 24h ago
    endSnapshot: string;    // Current
    commits: CommitInfo[];  // For playback
  };
}
```

### Data Flow
```
┌─────────────────────────────────────────────────────────────┐
│  Main Process: ActivityFeedStore                            │
│  ───────────────────────────────────────────────────────    │
│  • Aggregates commits by repo                               │
│  • Computes upstream deltas                                 │
│  • Caches File City snapshots                               │
│  • Emits updates on new commits                             │
│  ───────────────────────────────────────────────────────    │
│  IPC: getActivitySummaries(timeRange) → RepoActivitySummary[]│
│  IPC: subscribeToActivity() → Observable<RepoActivitySummary>│
└─────────────────────────────────────────────────────────────┘
```

---

## Collections (Secondary)

Collections provide filtered views but are **not the primary interaction**:
- Dropdown or tab to filter by collection
- "All Repos" is default
- Collection activity could have its own aggregate card

Future consideration: Collection-level playback showing activity across multiple repos.

---

## Website Version Considerations

For the public website ("popular repos in the last hour"):
- Same visualization components
- Data source: GitHub API instead of local git
- Aggregation: By repo, with trending score
- Playback: Show the "story" of what's happening in popular open source

Key differentiator: **The animation makes it feel alive**, not just a static list.

---

## Open Questions

1. **Sorting**: By latest commit time? By activity volume? By "needs attention" score?
2. **Time window**: Fixed 24h or adaptive based on user's activity patterns?
3. **Upstream checks**: How often to fetch upstream status? On demand or background?
4. **Animation performance**: Pre-render File City frames or generate on demand?
5. **Completion tracking**: Persist "viewed" state across sessions?

---

## Next Steps

1. [ ] Prototype aggregated repo card component
2. [ ] Design "behind upstream" indicator and flow
3. [ ] Implement ActivityFeedStore in main process
4. [ ] Add File City animation playback to cards
5. [ ] Design "caught up" state and progress indicators
