# UserProfilePanel Architecture - Actions/Context Pattern

## Overview

This document explains how UserProfilePanel will be converted from a props-based component to using the panel framework's actions/context pattern for GitHub users.

## Current vs. Proposed Architecture

### Current (Props-based)

```typescript
<UserProfilePanel
  userData={...}           // All data passed as props
  loading={...}
  error={...}
  context={...}            // Passed but unused
  actions={...}            // Passed but unused
  events={...}             // Passed but unused
/>
```

**Problems:**
- Bypasses the panel framework convention
- Parent must fetch and transform all data
- Makes direct service calls in parent (`GithubService`, `ApiProxyService`)
- Tightly couples data fetching to parent component
- Hard to reuse in different contexts
- Actions/context props are unused (not following framework pattern)

### Proposed (Actions/Context)

```typescript
<UserProfilePanel
  context={context}   // Data flows through context
  actions={actions}   // Operations through actions
  events={events}     // User interactions emit events
/>
```

**Benefits:**
- Consistent with panel framework (ProjectInfoPanel, RepositoryProfilePanel, etc.)
- Testable (mock actions/context)
- Centralized data flow
- Parent controls data fetching strategy
- Proper separation of concerns
- Follows established patterns

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Parent Component                          │
│  (FeedPanelFramework, ProfilesView, etc.)                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Context Provider                                    │    │
│  │  - currentScope.user (GitHub username)            │    │
│  │  - Profile data managed by panel                  │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Actions                                            │    │
│  │  - getUserProfile(username)                       │    │
│  │  - getUserActivity(username)                      │    │
│  │  - getUserRepositories(username)                  │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Event Handlers                                     │    │
│  │  - user-profile:follow-requested                  │    │
│  │  - user-profile:unfollow-requested                │    │
│  │  - user-profile:view-repository                   │    │
│  │  - user-profile:open-link                         │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              UserProfilePanel                                │
│                                                              │
│  Reads from context:                                        │
│  - user = context.currentScope?.user                        │
│  - Can also fetch its own data via actions                  │
│                                                              │
│  Fetches (via actions):                                     │
│  - Profile data (name, bio, avatar, etc.)                   │
│  - Activity data (commit heatmap)                           │
│  - Statistics (repos, followers, following)                 │
│                                                              │
│  User actions:                                              │
│  - events.emit('user-profile:follow-requested')            │
│  - events.emit('user-profile:view-repository')             │
│  - events.emit('user-profile:open-link', { url })          │
└─────────────────────────────────────────────────────────────┘
```

## User Profile

### Concept

The panel displays GitHub user profiles fetched from the GitHub API.

### User Data

```typescript
{
  username: 'octocat'
}
// → Fetch from GitHub API
// → Show GitHub stats (followers, public repos, etc.)
// → Show "Follow" button if authenticated
// → Show activity heatmap from commit history
```

## Data Fetching Strategy

### Option A: Panel Fetches (Recommended for UserProfile)

**Pattern:** Panel manages its own data state and fetches via actions when mounted.

```typescript
const UserProfilePanel: React.FC<Props> = ({ context, actions, events }) => {
  const user = context.currentScope?.user;

  // Panel manages its own profile data state
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [activityData, setActivityData] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch profile when user changes
  useEffect(() => {
    if (!user) {
      setProfileData(null);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch profile and activity in parallel
        const [profile, activity] = await Promise.all([
          actions.getUserProfile(user.username),
          actions.getUserActivity(user.username)
        ]);

        setProfileData(profile);
        setActivityData(activity);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, actions]);

  // ... render
};
```

**Pros:**
- Panel is self-contained and manages its own state
- Parent doesn't need to track panel-specific data
- Scales well when multiple panels exist
- Consistent with RepositoryProfilePanel approach

**Cons:**
- More complex than receiving data via props
- Panel has more responsibilities

### Option B: Parent Fetches (Current Pattern)

**Pattern:** Parent fetches data and passes via context or props.

```typescript
// In parent component
const [profileData, setProfileData] = useState<UserProfileData | null>(null);

const context: UserProfilePanelContext = {
  currentScope: {
    user: selectedUser,
  },
  profileData: profileData, // ❌ This violates the "panel fetches" principle
};
```

**Pros:**
- Simple for panel implementation
- Parent has full control over data

**Cons:**
- Parent must manage state for every panel
- Doesn't scale well
- Violates panel framework separation of concerns

### Recommendation

**Use Option A (Panel Fetches)** to match the RepositoryProfilePanel pattern and panel framework conventions.

## Context Interface

```typescript
interface UserProfilePanelContext extends PanelContextValue {
  currentScope?: {
    user?: UserIdentifier;      // The user to display
    // Profile data NOT in context - fetched by panel
  };

  // GitHub sync state (optional)
  githubSyncState?: {
    authenticatedUser?: string;  // Current authenticated GitHub user
    following: string[];         // Users we're following
    followers: string[];         // Users following us
  };
}

interface UserIdentifier {
  username: string;             // GitHub username
}
```

**Why profile data is NOT in context:**
- Panel-specific data (only UserProfilePanel needs it)
- Multiple user profiles might be open simultaneously
- On-demand loading (fetch when panel mounts)
- Scalability (parent doesn't manage state for every panel)

## Actions Interface

```typescript
interface UserProfilePanelActions extends PanelActions {
  /**
   * Get GitHub user profile
   * Implementation: GithubService.getUser(username)
   */
  getUserProfile: (username: string) => Promise<UserProfileData>;

  /**
   * Get user activity/contribution data
   * Implementation: ApiProxyService.call('/users/{username}/activity')
   */
  getUserActivity: (username: string) => Promise<Map<string, number>>;

  /**
   * Get user's repositories
   * Implementation: GithubService.getUserRepositories(username)
   */
  getUserRepositories: (username: string) => Promise<RepositoryMetadata[]>;

  /**
   * Follow a GitHub user
   * Implementation: GithubService.followUser(username)
   */
  followUser?: (username: string) => Promise<void>;

  /**
   * Unfollow a GitHub user
   * Implementation: GithubService.unfollowUser(username)
   */
  unfollowUser?: (username: string) => Promise<void>;
}
```

## Event Interface

```typescript
// Events emitted by the panel
interface UserProfilePanelEvents {
  'user-profile:follow-requested': {
    username: string;
  };

  'user-profile:unfollow-requested': {
    username: string;
  };

  'user-profile:view-repository': {
    repository: RepositoryMetadata;
  };

  'user-profile:open-link': {
    url: string;
    type: 'website' | 'twitter' | 'github' | 'email';
  };

  'user-profile:refresh-requested': {
    username: string;
  };
}
```

## Data Types

```typescript
interface UserProfileData {
  // Basic info
  username: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;

  // Location/company
  location?: string;
  company?: string;

  // Social links
  twitterHandle?: string;
  websiteUrl?: string;
  githubUrl?: string;

  // Statistics
  totalCommits: number;
  totalRepos: number;
  followers: number;
  following: number;

  // Metadata
  joinedDate: string;      // ISO date string

  // Activity (optional - fetched separately)
  activityData?: Map<string, number>; // date -> commit count
}
```

## Example: Parent Implementation

```typescript
const FeedPanelFramework: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<UserIdentifier | null>(null);
  const [githubSyncState, setGithubSyncState] = useState<any>(null);

  // Context for the panel - provides user identifier
  const context: UserProfilePanelContext = {
    currentScope: {
      user: selectedUser,
    },
    githubSyncState,
    refresh: async () => {
      // Parent-level refresh logic
      // Panel will re-fetch its own data
    },
  };

  // Actions implementation - provides capabilities
  const actions: UserProfilePanelActions = {
    getUserProfile: async (username) => {
      const githubUser = await GithubService.getUser(username);

      return {
        username: githubUser.login,
        name: githubUser.name,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
        bio: githubUser.bio,
        location: githubUser.location,
        company: githubUser.company,
        twitterHandle: githubUser.twitter_username,
        websiteUrl: githubUser.blog,
        githubUrl: githubUser.html_url,
        totalRepos: githubUser.public_repos,
        followers: githubUser.followers,
        following: githubUser.following,
        joinedDate: githubUser.created_at,
        totalCommits: 0, // Fetched separately via getUserActivity
      };
    },

    getUserActivity: async (username) => {
      // Fetch from Principal ADE API
      const response = await ApiProxyService.call<UserActivityResponse>({
        endpoint: `/users/${username}/activity`,
        method: 'GET',
      });

      return new Map(response.contributions);
    },

    getUserRepositories: async (username) => {
      return await GithubService.getUserRepositories(username);
    },

    followUser: async (username) => {
      await GithubService.followUser(username);
      // Update sync state
      setGithubSyncState(prev => ({
        ...prev,
        following: [...(prev?.following || []), username],
      }));
    },

    unfollowUser: async (username) => {
      await GithubService.unfollowUser(username);
      // Update sync state
      setGithubSyncState(prev => ({
        ...prev,
        following: (prev?.following || []).filter(u => u !== username),
      }));
    },
  };

  // Event handlers
  useEffect(() => {
    const unsubscribers = [
      events.on('user-profile:follow-requested', async (event) => {
        const { username } = event.payload;
        await actions.followUser?.(username);
      }),

      events.on('user-profile:unfollow-requested', async (event) => {
        const { username } = event.payload;
        await actions.unfollowUser?.(username);
      }),

      events.on('user-profile:view-repository', (event) => {
        const { repository } = event.payload;
        // Navigate to repository view
        openRepositoryView(repository);
      }),

      events.on('user-profile:open-link', (event) => {
        const { url } = event.payload;
        window.open(url, '_blank');
      }),
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [events, actions]);

  return (
    <UserProfilePanel
      context={context}
      actions={actions}
      events={events}
    />
  );
};
```

## Implementation Considerations

### Edge Cases

1. **User not found (404)**
   - Show empty state with "User not found" message
   - Offer to search for similar usernames
   - Check if username is valid

2. **Private profile**
   - Limited data available
   - Show what's publicly accessible
   - Indicate that profile is private

3. **Rate limiting (GitHub API)**
   - Implement exponential backoff
   - Show rate limit status
   - Cache responses when possible

4. **Unauthenticated access**
   - Some GitHub data requires authentication
   - Show "Sign in to see more" CTA
   - Gracefully degrade features

### Performance Optimizations

```typescript
// Debounce profile fetches if user changes rapidly
const debouncedFetchProfile = useMemo(
  () => debounce(fetchProfile, 300),
  [actions]
);

// Cancel in-flight requests when user changes
useEffect(() => {
  const abortController = new AbortController();

  fetchProfile(user, abortController.signal);

  return () => abortController.abort();
}, [user]);

// Cache profile data by username
const profileCache = useRef<Map<string, UserProfileData>>(new Map());

// Memoize activity heatmap rendering (expensive)
const activityHeatmap = useMemo(
  () => <ActivityHeatmap data={activityData} />,
  [activityData]
);
```

### Error Handling

```typescript
const [errors, setErrors] = useState<{
  profile?: string;
  activity?: string;
  repositories?: string;
}>({});

// Handle partial failures gracefully
try {
  const profile = await actions.getGitHubUserProfile(username);
  setProfileData(profile);
} catch (error) {
  setErrors(prev => ({ ...prev, profile: error.message }));
  // Still try to fetch activity even if profile failed
}

// Show error states in UI
{errors.profile && (
  <Alert variant="error">
    Failed to load profile: {errors.profile}
  </Alert>
)}

{errors.activity && (
  <Alert variant="warning">
    Failed to load activity data: {errors.activity}
  </Alert>
)}
```

## Implementation Status

**Status: ✅ COMPLETED**

### Current State
- UserProfilePanel uses actions/context pattern
- Panel manages its own data fetching and state
- Actions implemented in parent (FeedPanelFramework)
- Events emitted for user interactions (link opening)
- GitHub users only (remote profiles)

### What Was Implemented
1. ✅ Converted to actions/context pattern
2. ✅ Moved data fetching from parent to panel
3. ✅ Implemented action handlers in parent (getUserProfile, getUserActivity)
4. ✅ Added event emissions for external link opening
5. ✅ Simplified to GitHub users only (no local Git support)

## Migration Checklist

- [x] Define `UserProfilePanelContext` interface (user identifier only)
- [x] Define `UserProfilePanelActions` interface (getUserProfile, getUserActivity, etc.)
- [ ] Define `UserProfilePanelEvents` interface (follow, unfollow, view-repository, etc.) - *Partially done: open-link event implemented*
- [x] Update component props to remove `userData`, `loading`, `error` props
- [x] Add state management in panel for profile data, activity, loading, errors
- [x] Replace direct data props with reading from `context.currentScope.user`
- [x] Implement data fetching in panel using actions (useEffect hook)
- [x] Replace callback behaviors with event emissions
- [x] Implement actions in parent component (delegate to GithubService, ApiProxyService)
- [x] Implement event handlers in parent component
- [x] Update Storybook stories for new pattern
- [x] Add story for GitHub user
- [x] Add story for loading state
- [x] Add story for error state (user not found)
- [ ] Add story for error state (network failure) - *Covered by error state*
- [ ] Add story for private profile
- [ ] Test follow/unfollow actions - *Not yet implemented*
- [ ] Test repository navigation - *Not yet needed*
- [x] Test external link opening
- [ ] Test performance with large activity datasets

## Architectural Decisions Summary

### 1. Panel Fetches Data, Not Parent

**Decision:** Panel fetches profile and activity data using actions, parent doesn't manage profile state.

**Rationale:**
- UserProfilePanel is **self-contained** - only it needs the profile data
- Multiple user profiles might be open simultaneously
- Parent shouldn't manage state for every panel (doesn't scale)
- Consistent with RepositoryProfilePanel pattern
- Panel framework best practice

### 2. Context Provides User Identifier Only

**Decision:** Context only contains `currentScope.user` identifier, not full profile data.

**Rationale:**
- User identifier is minimal metadata needed for panel to fetch data
- Profile data is panel-specific (not shared)
- Keeps context lightweight
- Clear separation: parent manages selection, panel manages data

### 3. GitHub Users Only

**Decision:** Support GitHub users only (remote profiles).

**Rationale:**
- Focused use case on GitHub collaboration
- Consistent data source (GitHub API)
- Simpler implementation without local/remote branching
- Leverages existing GitHub integration

### 4. Activity Data Fetched Separately

**Decision:** Profile and activity data fetched via separate actions, combined in panel.

**Rationale:**
- Activity data is expensive to fetch (requires API call)
- May want to show profile immediately, load activity progressively
- Different error handling strategies
- Allows caching strategies to differ

### 5. Social Actions via Events

**Decision:** Follow/unfollow emit events, parent handles implementation.

**Rationale:**
- Parent decides how to handle social actions (optimistic updates, etc.)
- May need to update multiple views (sidebar, lists, etc.)
- Consistent with event-driven architecture
- Panel doesn't need to know about authentication

### 6. External Links via Events

**Decision:** Opening external links (website, Twitter, GitHub) emits events.

**Rationale:**
- Parent may want to track analytics
- May want to intercept certain URLs (e.g., GitHub repos)
- Could implement in-app browser in future
- Consistent with panel framework

## Key Takeaways

1. **Panel fetches its own data** - Using actions, not receiving through props
2. **Actions abstract implementation** - Panel doesn't know about GithubService internals
3. **Events for user interactions** - Parent decides how to handle follow/unfollow/navigation
4. **GitHub-focused** - Simplified to remote GitHub users only
5. **Progressive data loading** - Profile and activity fetched in parallel
6. **Consistent with framework** - Uses actions/context/events pattern correctly
7. **Scalable architecture** - Parent doesn't manage per-panel state

## Comparison with RepositoryProfilePanel

| Aspect | RepositoryProfilePanel | UserProfilePanel |
|--------|----------------------|-----------------|
| **Data Source** | Local file system OR GitHub API | GitHub API |
| **Primary Data** | File tree, activity heatmap | Profile info, activity heatmap |
| **Expensive Operation** | Building city data from file tree | Fetching activity from API |
| **Local/Remote** | Dual file trees (local + remote) | Remote only (GitHub) |
| **Actions** | getLocalFileTree, getRemoteFileTree | getUserProfile, getUserActivity |
| **Context** | Repository identifier | User identifier (username) |
| **Events** | open-requested, delete-requested | follow-requested, view-repository |
| **Transformation** | FileTree → CityData | GitHub API → UserProfileData |

Both follow the same architectural pattern but adapted to their specific domains.
