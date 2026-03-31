# User Feed Panel

## Overview

The User Feed Panel displays GitHub activity and contribution data for users selected in the Network page. When a user is clicked in the GitHubSocialPanel, their activity feed is fetched from the Principal ADE API and displayed in the right panel.

## Architecture

### Data Flow

```
GitHubSocialPanel → user:selected event → GitSyncPanelContext
                                                ↓
                                        SecureAuthService (get token)
                                                ↓
                                        ApiProxyService.call()
                                                ↓
                                        Main Process (IPC)
                                                ↓
                                        app.principal-ade.com/api
                                                ↓
                                        UserFeedPanel renders
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| GitHubSocialPanel | `@industry-theme/git-sync-panels` | Displays followers/following, emits user selection events |
| GitSyncPanelContext | `src/renderer/contexts/GitSyncPanelContext.tsx` | Manages state, fetches user activity data |
| ApiProxyService | `src/renderer/main-process-api/ApiProxyService.ts` | Proxies API calls through main process to avoid CORS |
| UserFeedPanel | `src/renderer/panels/UserFeedPanel.tsx` | Renders user header, contribution graph, and activity feed |

## API Integration

### Endpoint

```
GET https://app.principal-ade.com/api/github/user/{username}/activity
Authorization: Bearer {github_token}
```

### Response Structure

```typescript
interface UserActivityResponse {
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    followersCount: number;
  };
  activity: ActivityEvent[];
  contributions: DailyContribution[];
}
```

### Activity Event Types

| Type | Description |
|------|-------------|
| `commit` | Commits pushed to repositories |
| `pr_merged` | Pull requests merged |
| `pr_opened` | Pull requests opened |
| `issue_opened` | Issues opened |

## UI Components

### User Header
- Avatar image
- Display name and login
- Follower count
- "Open in GitHub" button

### Contribution Graph
- 7-day bar visualization
- Day-of-week labels
- Contribution count tooltip

### Activity Feed
- Color-coded icons per activity type
- Repository name and timestamp
- Clickable items open in GitHub
- Shows additions/deletions for merged PRs

## Event Flow

1. **User Selection**: User clicks on a person in GitHubSocialPanel
2. **Event Emission**: `user:selected` event emitted with username
3. **Auth Check**: SecureAuthService retrieves GitHub token
4. **API Call**: ApiProxyService routes request through main process
5. **Data Storage**: Activity data stored in `userActivity` slice
6. **Rendering**: UserFeedPanel re-renders with new data

## Design Decisions

### Why proxy through main process?

Direct `fetch()` calls from the renderer process to `app.principal-ade.com` fail due to CORS restrictions. The ApiProxyService routes requests through the main process, which has no CORS limitations.

### Why separate from profile data?

The activity feed requires a different API call than profile data. Keeping them separate allows for:
- Independent loading states
- Caching strategies
- Future API changes

## Related Canvases

- `activity-feed/activity-feed.otel.canvas` - Local repository activity feed
- `auth-flow/auth-flow.canvas` - GitHub authentication flow
