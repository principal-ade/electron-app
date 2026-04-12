# Implementation Plan: Watched Activity Feed Toggle

## ✅ STATUS: COMPLETED

## Overview
Add a toggle to the Activity Feed that switches between "My Activity" (current local git commits) and "Watched Activity" (commits from watched directories in web-ade).

## User Requirements
- **Data Source**: Fetch watched directory activities from web-ade API (similar to mobile app implementation)
- **Toggle Location**: ~~In the ActivityFeedPanel header~~ **UPDATED: In FeedView header** (top level)
- **Toggle Style**: Segmented control / Tab-style switcher (two buttons side-by-side)

## Architecture Analysis

### Current Implementation
- **File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/panels/ActivityFeedPanel.tsx`
- **Data Source**: Local git commits from Alexandria repositories (last 30 days)
- **Hook**: `useActivityFeed` hook at `/Users/griever/Developer/desktop-app/electron-app/src/renderer/hooks/useActivityFeed.ts`
- **Display**: Grouped by day quarters (Night/Morning/Afternoon/Evening)
- **Features**: File City images, commit animation, AI summary selection

### Web-ADE API Integration (from Mobile App)
- **Base URL**: `https://app.principal-ade.com/api` (production) or `http://localhost:3000/api` (dev)
- **API Type**: tRPC endpoints
- **Authentication**: Bearer token (GitHub OAuth via WorkOS)
- **Key Endpoints**:
  - `GET /api/trpc/feed.getCommitQueue?input={json:{limit}}` - Returns CommitActivityCard[] grouped by repo + hour
  - `GET /api/trpc/feed.getWatches` - Returns watched users and repos
  - `GET /api/trpc/feed.getActivityHeatmap` - Returns commits, authors, repos for time range

### Data Structures (from Mobile App)
```typescript
interface CommitActivityCard {
  itemId: string; // "YYYY-MM-DD:HH:owner/repo"
  repo: {
    owner: string;
    name: string;
  };
  hour: number; // 0-23 UTC
  hourBucket: string; // ISO timestamp for hour start
  commits: CommitInfo[];
  commitCount: number;
  latestCommitAt: string;
}

interface CommitInfo {
  sha: string;
  message: string;
  author: CommitAuthor;
  committedAt: string;
  url: string;
}
```

## Implementation Steps

### Step 1: Shared Types
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/shared/tipc/webAdeRouterTypes.ts` (new)

**Purpose**: Shared TypeScript types for web-ade TIPC router

**Implementation**:
```typescript
import type { RouterType } from '@egoist/tipc';

// Input types
export interface GetCommitQueueInput {
  limit: number;
}

export interface GetActivityHeatmapInput {
  hoursBack: number;
  authorLogins?: string[];
  repoIds?: string[];
}

// Response types
export interface CommitAuthor {
  login: string;
  avatarUrl?: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: CommitAuthor;
  committedAt: string;
  url: string;
}

export interface CommitActivityCard {
  itemId: string;
  repo: {
    owner: string;
    name: string;
  };
  hour: number;
  hourBucket: string;
  commits: CommitInfo[];
  commitCount: number;
  latestCommitAt: string;
}

export interface WatchedUser {
  login: string;
  watchedAt: string;
}

export interface WatchedRepo {
  owner: string;
  repo: string;
  watchedAt: string;
}

export interface FeedWatches {
  watchedUsers: WatchedUser[];
  watchedRepos: WatchedRepo[];
}

export interface HeatmapCommit {
  timestamp: string;
  repoId: string;
  authorLogin: string;
  authorAvatarUrl?: string;
}

export interface HeatmapAuthor {
  login: string;
  avatarUrl?: string;
  commitCount: number;
}

export interface HeatmapRepo {
  id: string;
  owner: string;
  name: string;
  commitCount: number;
}

export interface ActivityHeatmapResponse {
  commits: HeatmapCommit[];
  authors: HeatmapAuthor[];
  repos: HeatmapRepo[];
  timeRange: {
    start: string;
    end: string;
  };
}

// Router type definition
export type WebAdeRouterType = RouterType<{
  getCommitQueue: {
    input: GetCommitQueueInput;
    output: CommitActivityCard[];
  };
  getWatches: {
    input: void;
    output: FeedWatches;
  };
  getActivityHeatmap: {
    input: GetActivityHeatmapInput;
    output: ActivityHeatmapResponse;
  };
  isAuthenticated: {
    input: void;
    output: boolean;
  };
}>;
```

### Step 2: Main Process - Web-ADE API Service
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/main/services/WebAdeService.ts` (new)

**Purpose**: Backend service that makes HTTP requests to web-ade API

**Implementation**:
```typescript
import { SecureTokenStore } from '../utils/SecureTokenStore';

export class WebAdeService {
  private baseUrl: string;
  private tokenStore: SecureTokenStore;

  constructor() {
    this.baseUrl = process.env.WEB_ADE_API_URL || 'https://app.principal-ade.com/api';
    this.tokenStore = new SecureTokenStore('web-ade-tokens');
  }

  // Check if user has a GitHub token (reuse from existing GitHub integration)
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  // Get GitHub token from secure storage
  private async getToken(): Promise<string | null> {
    // First check if we can reuse existing GitHub token
    const githubToken = await this.tokenStore.get('github-token');
    return githubToken;
  }

  // Fetch commit queue from web-ade
  async getCommitQueue(limit: number): Promise<CommitActivityCard[]> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = `${this.baseUrl}/trpc/feed.getCommitQueue?input=${encodeURIComponent(JSON.stringify({ json: { limit } }))}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication failed');
      }
      throw new Error(`Failed to fetch commit queue: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result.data.json;
  }

  // Fetch watched items from web-ade
  async getWatches(): Promise<FeedWatches> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = `${this.baseUrl}/trpc/feed.getWatches`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch watches: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result.data.json;
  }

  // Fetch activity heatmap from web-ade
  async getActivityHeatmap(options: GetActivityHeatmapInput): Promise<ActivityHeatmapResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = `${this.baseUrl}/trpc/feed.getActivityHeatmap?input=${encodeURIComponent(JSON.stringify({ json: options }))}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch activity heatmap: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result.data.json;
  }
}
```

**Error Handling**:
- Network errors
- Authentication errors (401/403)
- Rate limiting
- JSON parsing errors

### Step 3: Main Process - TIPC Router
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/main/web-ade/tipc/webAdeRouter.ts` (new)

**Purpose**: Type-safe IPC router for web-ade operations

**Implementation**:
```typescript
import { tipc } from '@egoist/tipc/main';
import type {
  GetCommitQueueInput,
  GetActivityHeatmapInput,
} from '../../../shared/tipc/webAdeRouterTypes';
import { WebAdeService } from '../../services/WebAdeService';

const webAdeService = new WebAdeService();
const t = tipc.create();

export const webAdeRouter = {
  isAuthenticated: t.procedure.action(async () => {
    return webAdeService.isAuthenticated();
  }),

  getCommitQueue: t.procedure
    .input<GetCommitQueueInput>()
    .action(async ({ input }) => {
      return webAdeService.getCommitQueue(input.limit);
    }),

  getWatches: t.procedure.action(async () => {
    return webAdeService.getWatches();
  }),

  getActivityHeatmap: t.procedure
    .input<GetActivityHeatmapInput>()
    .action(async ({ input }) => {
      return webAdeService.getActivityHeatmap(input);
    }),
};
```

**Registration**: Register this router in the main TIPC setup file (find where `githubRouter` is registered)

### Step 4: Renderer - TIPC Client
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/tipc/webAdeClient.ts` (new)

**Purpose**: Type-safe client for calling web-ade operations from renderer

**Implementation**:
```typescript
import { createClient } from '@egoist/tipc/renderer';
import type {
  GetCommitQueueInput,
  GetActivityHeatmapInput,
  WebAdeRouterType,
  CommitActivityCard,
  FeedWatches,
  ActivityHeatmapResponse,
} from '../../shared/tipc/webAdeRouterTypes';

export interface WebAdeClient {
  isAuthenticated: () => Promise<boolean>;
  getCommitQueue: (input: GetCommitQueueInput) => Promise<CommitActivityCard[]>;
  getWatches: () => Promise<FeedWatches>;
  getActivityHeatmap: (input: GetActivityHeatmapInput) => Promise<ActivityHeatmapResponse>;
}

let _webAdeClient: WebAdeClient | null = null;

function getWebAdeClient(): WebAdeClient {
  if (!_webAdeClient) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error('WebADE client not available - window.electron not initialized');
    }
    _webAdeClient = createClient<WebAdeRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as WebAdeClient;
  }
  return _webAdeClient;
}

export const webAdeClient: WebAdeClient = new Proxy({} as WebAdeClient, {
  get(_target, prop: keyof WebAdeClient) {
    const client = getWebAdeClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Re-export types
export type {
  GetCommitQueueInput,
  GetActivityHeatmapInput,
  CommitActivityCard,
  FeedWatches,
  ActivityHeatmapResponse,
};
```

### Step 5: Renderer - Service Wrapper
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/main-process-api/WebAdeService.ts` (new)

**Purpose**: High-level service wrapper (similar to GithubService pattern)

**Implementation**:
```typescript
import { webAdeClient } from '../tipc/webAdeClient';
import type {
  CommitActivityCard,
  FeedWatches,
  ActivityHeatmapResponse,
} from '../../shared/tipc/webAdeRouterTypes';

export class WebAdeService {
  static async isAuthenticated(): Promise<boolean> {
    return webAdeClient.isAuthenticated();
  }

  static async getCommitQueue(limit = 50): Promise<CommitActivityCard[]> {
    return webAdeClient.getCommitQueue({ limit });
  }

  static async getWatches(): Promise<FeedWatches> {
    return webAdeClient.getWatches();
  }

  static async getActivityHeatmap(hoursBack = 24, options?: {
    authorLogins?: string[];
    repoIds?: string[];
  }): Promise<ActivityHeatmapResponse> {
    return webAdeClient.getActivityHeatmap({
      hoursBack,
      ...options,
    });
  }
}
```

### Step 6: Watched Activity Hook
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/hooks/useWatchedActivityFeed.ts` (new)

**Purpose**: React hook to fetch and manage watched activity data

**Implementation**:
```typescript
export interface WatchedActivityCommit {
  repoName: string;
  repoOwner: string;
  sha: string;
  message: string;
  author: string;
  authorAvatarUrl?: string;
  committedAt: string; // ISO date string
  url: string;
}

export interface WatchedRepoGroup {
  owner: string;
  name: string;
  commits: WatchedActivityCommit[];
  latestCommitAt: Date;
  commitCount: number;
}

export function useWatchedActivityFeed(
  enabled: boolean,
  maxCards = 20
) {
  const [repoGroups, setRepoGroups] = useState<WatchedRepoGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  // Returns: { repoGroups, loading, error, authenticated, refresh }
}
```

**Features**:
- Only fetches when `enabled` is true
- Checks authentication status first
- Transforms CommitActivityCard[] into format compatible with ActivityFeedPanel
- Handles authentication errors gracefully
- Provides refresh function

### Step 7: Segmented Control Component
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/components/SegmentedControl.tsx` (new)

**Purpose**: Reusable segmented control UI component

**Implementation**:
```typescript
interface SegmentedControlOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}

export const SegmentedControl: React.FC<SegmentedControlProps>
```

**Design**:
- Two buttons side-by-side
- Active state: Primary color background with white text
- Inactive state: Transparent background with text secondary color
- Smooth transition (0.15s ease)
- Border radius matching theme
- Hover states

**Visual Example**:
```
┌─────────────────┬─────────────────┐
│  My Activity    │ Watched Activity│  <- Inactive has border, transparent bg
│  (ACTIVE)       │                 │  <- Active has primary bg, white text
└─────────────────┴─────────────────┘
```

### Step 8: Update ActivityFeedPanel
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/panels/ActivityFeedPanel.tsx`

**Changes**:

1. **Add state for feed mode**:
```typescript
type FeedMode = 'my-activity' | 'watched-activity';
const [feedMode, setFeedMode] = useState<FeedMode>('my-activity');
```

2. **Add useWatchedActivityFeed hook**:
```typescript
const watchedFeed = useWatchedActivityFeed(
  feedMode === 'watched-activity',
  100 // maxCards
);
```

3. **Update header (lines 573-692)** to include segmented control:
```typescript
{/* Header - spans full width */}
<div style={{ /* existing styles */ }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
    <h3>Activity Feed</h3>

    {/* NEW: Segmented Control */}
    <SegmentedControl
      options={[
        { value: 'my-activity', label: 'My Activity' },
        { value: 'watched-activity', label: 'Watched' },
      ]}
      value={feedMode}
      onChange={(value) => setFeedMode(value as FeedMode)}
      theme={theme}
    />
  </div>

  {/* Existing status indicator and controls */}
</div>
```

4. **Update data source logic**:
```typescript
// Determine which feed to display
const displayedRepoSummaries = useMemo(() => {
  if (feedMode === 'watched-activity') {
    // Transform watchedFeed.repoGroups to RepoActivitySummary[]
    return watchedFeed.repoGroups.map(group => ({
      repoPath: '', // No local path for watched repos
      repoName: group.name,
      commits: group.commits.map(c => ({
        repoName: group.name,
        repoPath: '',
        hash: c.sha,
        message: c.message,
        author: c.author,
        authorEmail: '',
        date: c.committedAt,
      })),
      latestCommitAt: group.latestCommitAt,
      commitCount: group.commitCount,
      githubOwner: group.owner,
      githubRepoName: group.name,
    }));
  } else {
    return repoSummaries; // Existing local summaries
  }
}, [feedMode, watchedFeed.repoGroups, repoSummaries]);
```

5. **Handle empty states**:
```typescript
// When feedMode === 'watched-activity' and !watchedFeed.authenticated
// Show: "Sign in to view watched activity" with auth button

// When feedMode === 'watched-activity' and watchedFeed.repoGroups.length === 0
// Show: "No watched repositories. Visit web-ade to watch repos and users."
```

6. **Disable features for watched activity**:
- File City images (no local repo path)
- "Open" button (can't open remote repos)
- Keep: Commit animation, AI summary, GitHub avatars

### Step 9: Configuration & Environment
**File**: `/Users/griever/Developer/desktop-app/electron-app/src/renderer/config/webAdeConfig.ts` (new)

**Purpose**: Centralized configuration for web-ade integration

**Implementation**:
```typescript
export const WEB_ADE_CONFIG = {
  // API endpoints
  apiBaseUrl: process.env.WEB_ADE_API_URL || 'https://app.principal-ade.com/api',
  authServerUrl: process.env.WEB_ADE_AUTH_URL || 'https://auth.principal-ade.com',

  // OAuth config
  oauthClientId: process.env.WEB_ADE_CLIENT_ID || '',
  oauthRedirectUri: 'claude-code://oauth/callback',

  // Feature flags
  enableWatchedActivity: process.env.ENABLE_WATCHED_ACTIVITY !== 'false', // true by default
} as const;
```

### Step 10: Error Handling & Edge Cases

**Authentication Errors**:
- 401/403: Show "Sign in to web-ade" message with auth button
- Network errors: Show "Unable to connect to web-ade" with retry button
- CORS errors: Log error, show generic message

**Empty States**:
- No watched repos: "Visit web-ade.com to watch repositories and users"
- No recent activity: "No recent activity from watched repos"
- Authentication required: "Sign in to view watched activity"

**Loading States**:
- Show existing loading indicator when fetching watched activity
- Maintain current UI while switching between modes (no flicker)

**Data Transformation**:
- Watched commits don't have local repo paths (set to empty string)
- Disable File City image generation for watched activity
- Use GitHub API for commit author avatars
- Convert UTC timestamps to local time

**Feature Compatibility**:
| Feature | My Activity | Watched Activity |
|---------|-------------|------------------|
| File City images | ✅ | ❌ (no local path) |
| Commit dots | ✅ | ✅ |
| Commit animation | ✅ | ✅ |
| AI Summary | ✅ | ✅ |
| Open repo | ✅ | ❌ (external link to GitHub) |
| Show details | ✅ | ✅ |
| GitHub avatars | ✅ | ✅ |
| Diff stats | ✅ | ⚠️ (from API if available) |

### Step 11: Testing Considerations

**Manual Testing**:
1. Toggle between My Activity and Watched Activity
2. Verify data loads correctly from web-ade
3. Test authentication flow
4. Test error states (network error, auth error, no watched repos)
5. Verify UI doesn't break with empty states
6. Test with various commit counts (1, 10, 100+)

**Edge Cases**:
- User not authenticated
- No watched repos/users
- API down
- Rate limiting
- Very large number of watched repos (>100)
- Rapid toggling between modes
- Token expiration during use

## Implementation Order

1. ✅ **Research Phase** (COMPLETE)
   - Understand current ActivityFeedPanel implementation
   - Analyze mobile app's web-ade integration
   - Document API endpoints and data structures
   - Understand TIPC architecture

2. **Shared Types** (Implement first)
   - Create `src/shared/tipc/webAdeRouterTypes.ts` with all TypeScript interfaces
   - This file is needed by both main and renderer

3. **Main Process Backend**
   - Create `src/main/services/WebAdeService.ts` (HTTP client, token management)
   - Create `src/main/web-ade/tipc/webAdeRouter.ts` (TIPC router)
   - Register router in main TIPC setup
   - Test with a simple curl/fetch to verify endpoints work

4. **Renderer Client**
   - Create `src/renderer/tipc/webAdeClient.ts` (TIPC client)
   - Create `src/renderer/main-process-api/WebAdeService.ts` (service wrapper)
   - Test IPC calls work end-to-end

5. **Data Layer**
   - Create `src/renderer/hooks/useWatchedActivityFeed.ts` hook
   - Test hook independently with console logs

6. **UI Components**
   - Create `src/renderer/components/SegmentedControl.tsx` component
   - Test component in isolation

7. **Integration**
   - Update `ActivityFeedPanel.tsx`:
     - Import SegmentedControl and useWatchedActivityFeed
     - Add segmented control to header
     - Add feed mode state
     - Integrate useWatchedActivityFeed hook
     - Update data source logic
     - Add empty/error states

8. **Polish**
   - Handle edge cases
   - Add loading states
   - Add error messages
   - Test authentication flow
   - Test all features with both modes

## Files to Create

### Shared (TypeScript types)
1. `/Users/griever/Developer/desktop-app/electron-app/src/shared/tipc/webAdeRouterTypes.ts` - Shared TIPC types

### Main Process (Backend)
2. `/Users/griever/Developer/desktop-app/electron-app/src/main/services/WebAdeService.ts` - Backend service for web-ade API
3. `/Users/griever/Developer/desktop-app/electron-app/src/main/web-ade/tipc/webAdeRouter.ts` - TIPC router

### Renderer Process (Frontend)
4. `/Users/griever/Developer/desktop-app/electron-app/src/renderer/tipc/webAdeClient.ts` - TIPC client
5. `/Users/griever/Developer/desktop-app/electron-app/src/renderer/main-process-api/WebAdeService.ts` - Service wrapper
6. `/Users/griever/Developer/desktop-app/electron-app/src/renderer/hooks/useWatchedActivityFeed.ts` - React hook
7. `/Users/griever/Developer/desktop-app/electron-app/src/renderer/components/SegmentedControl.tsx` - UI component
8. `/Users/griever/Developer/desktop-app/electron-app/src/renderer/config/webAdeConfig.ts` - Configuration (optional)

## Files to Modify

1. `/Users/griever/Developer/desktop-app/electron-app/src/renderer/panels/ActivityFeedPanel.tsx` - Add toggle and integrate watched activity
2. **Main TIPC setup file** (need to find where `githubRouter` is registered) - Register `webAdeRouter`
3. `/Users/griever/Developer/desktop-app/electron-app/.env` or config - Add `WEB_ADE_API_URL` environment variable

## Dependencies

**Already installed** (verified from existing code):
- `@egoist/tipc` - Already used for `githubRouter`
- Native `fetch` API - Available in Node.js 18+

**No new dependencies needed** - We're using the existing TIPC architecture

## Open Questions

1. **GitHub Token Source**: Does the app already have a GitHub token we can reuse? Or do we need to implement full OAuth?
   - **Action**: Check how `GitHubAdapter` in `src/main/version-control-providers/githubHandlers.ts` gets its token
   - **Action**: Look for `SecureTokenStore` or similar in the codebase

2. **TIPC Router Registration**: Where is the main TIPC router setup that registers `githubRouter`?
   - **Action**: Search for files that import and register `githubRouter`
   - **Pattern**: Likely in `src/main/index.ts` or similar main entry point

3. **Environment Variables**: Where should we store the web-ade API URL configuration?
   - **Action**: Check existing .env files or config patterns in the app
   - **Pattern**: Look for `.env.example` or similar

4. **Feature Flag**: Should this be behind a feature flag initially?
   - **Recommendation**: Yes, use `ENABLE_WATCHED_ACTIVITY` env var

5. **CORS**: ~~Will the web-ade API allow requests from Electron?~~
   - **Resolved**: Since we're proxying through main process, CORS is not an issue

## Success Criteria

- [x] User can toggle between "My Activity" and "Watched Activity" using segmented control
- [x] Watched Activity fetches data from web-ade API
- [x] Watched Activity displays commits grouped by repo
- [x] Authentication flow works (reuses existing GitHub token)
- [x] Empty states show helpful messages
- [x] Error states are handled gracefully
- [x] Loading states work smoothly
- [x] AI Summary works with watched activity (same component)
- [x] Commit animation works with watched activity (same component)
- [x] No breaking changes to existing "My Activity" functionality

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Authentication complexity | Medium | Reuse existing GitHub token if possible |
| API rate limiting | Medium | Implement caching and respect rate limits |
| Data structure mismatch | Medium | Transform API data to match current format |
| TIPC router registration | Medium | Find existing pattern and follow it |
| Performance with many watched repos | Low | Implement pagination or limit |
| Feature parity issues | Low | Document limitations clearly in UI |

## Implementation Notes & Bug Fixes

### Critical Bug Fixes During Implementation

1. **Missing feedMode in useMemo dependencies** (FeedPanelFramework.tsx:516-533)
   - **Issue**: `allPanels` useMemo didn't include `feedMode` in dependency array
   - **Impact**: Panels wouldn't re-render when feedMode changed
   - **Fix**: Added `feedMode` to dependency array

2. **Missing feedMode prop passthrough** (FeedPanelFramework.tsx:564-594)
   - **Issue**: Outer `FeedPanelFramework` component (TerminalProvider wrapper) didn't pass `feedMode` to inner component
   - **Impact**: feedMode state wasn't reaching child components
   - **Fix**: Added `feedMode` to props destructuring and passthrough

3. **RouterType import issue** (webAdeRouterTypes.ts)
   - **Issue**: Used `RouterType` from `@egoist/tipc` but it's not exported from that path
   - **Fix**: Used `ActionContext` from `@egoist/tipc/main` and defined compatible type manually (following githubRouterTypes.ts pattern)

### Architecture Decisions

1. **Toggle Placement**: Initially planned for ActivityFeedPanel header, moved to FeedView header for better UX
   - Reason: Toggle affects entire view (left panel should show watched users/repos in future)

2. **Data Flow**: feedMode flows: FeedView → FeedPanelFramework → ActivityFeedCardPanel
   - FeedView manages state
   - FeedPanelFramework passes through
   - ActivityFeedCardPanel uses it to conditionally fetch/display

3. **Authentication**: Reuses existing GitHub OAuth token from AuthService
   - No separate auth flow needed
   - WebAdeService checks token via `authService.getValidToken()`

## Future Enhancements

- **Left Panel for Watched Mode**: Show watched users and repos list (instead of heatmap) when in watched mode
- **Manage Watches UI**: Add UI to watch/unwatch repos directly from the app
- **Combined Feed**: Option to show both my activity and watched activity together
- **Filters**: Filter watched activity by specific users or repos
- **Notifications**: Notify when watched repos have new activity
- **Offline Support**: Cache watched activity for offline viewing
- **Activity Heatmap**: Integrate with heatmap panel to show watched activity
