# GitHub User Activity API

API endpoint for fetching a user's recent GitHub activity, used for the network tab user feed.

## Endpoint

```
GET https://app.principal-ade.com/api/github/user/{username}/activity
```

## Authentication

Pass the viewer's GitHub token in the `Authorization` header:

```
Authorization: Bearer {github_token}
```

The token determines visibility - only repos the authenticated user can access are returned.

## Response

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

interface ActivityEvent {
  id: string;
  type: 'commit' | 'pr_merged' | 'pr_opened' | 'issue_opened';
  timestamp: string;           // ISO 8601
  repository: string;          // "owner/repo"
  repositoryUrl?: string;
  ownerType?: 'User' | 'Organization';
  isPrivate?: boolean;         // true if repo is private
  title?: string;              // PR/issue title
  url?: string;                // Link to PR/issue
  metadata?: {
    commitCount?: number;      // For commit events
    additions?: number;        // For merged PRs
    deletions?: number;        // For merged PRs
    prNumber?: number;
    issueNumber?: number;
    isClosed?: boolean;        // For issues
    closedBy?: string;         // Username who closed
    reactions?: ReactionCounts;
  };
}

interface DailyContribution {
  date: string;   // "YYYY-MM-DD"
  count: number;
}

interface ReactionCounts {
  totalCount: number;
  counts: Partial<Record<ReactionContent, number>>;
  viewerReactions: Partial<Record<ReactionContent, number>>;
  users: Partial<Record<ReactionContent, string[]>>;
}

type ReactionContent =
  | 'THUMBS_UP' | 'THUMBS_DOWN' | 'LAUGH' | 'HOORAY'
  | 'CONFUSED' | 'HEART' | 'ROCKET' | 'EYES';
```

## Example Request

```typescript
const response = await fetch(
  `https://app.principal-ade.com/api/github/user/${username}/activity`,
  {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
    },
  }
);
const data: UserActivityResponse = await response.json();
```

## Example Response

```json
{
  "user": {
    "login": "octocat",
    "name": "The Octocat",
    "avatarUrl": "https://avatars.githubusercontent.com/u/583231",
    "followersCount": 1234
  },
  "activity": [
    {
      "id": "commit-octocat/hello-world-2024-01-15T10:30:00Z",
      "type": "commit",
      "timestamp": "2024-01-15T10:30:00Z",
      "repository": "octocat/hello-world",
      "repositoryUrl": "https://github.com/octocat/hello-world",
      "ownerType": "User",
      "isPrivate": false,
      "metadata": {
        "commitCount": 3
      }
    },
    {
      "id": "pr-merged-octocat/hello-world-42",
      "type": "pr_merged",
      "timestamp": "2024-01-14T15:00:00Z",
      "repository": "octocat/hello-world",
      "ownerType": "User",
      "isPrivate": false,
      "title": "Add new feature",
      "url": "https://github.com/octocat/hello-world/pull/42",
      "metadata": {
        "prNumber": 42,
        "additions": 150,
        "deletions": 20,
        "reactions": {
          "totalCount": 5,
          "counts": { "THUMBS_UP": 3, "ROCKET": 2 },
          "viewerReactions": { "THUMBS_UP": 12345 },
          "users": { "THUMBS_UP": ["user1", "user2", "user3"] }
        }
      }
    }
  ],
  "contributions": [
    { "date": "2024-01-09", "count": 5 },
    { "date": "2024-01-10", "count": 12 },
    { "date": "2024-01-11", "count": 3 },
    { "date": "2024-01-12", "count": 0 },
    { "date": "2024-01-13", "count": 8 },
    { "date": "2024-01-14", "count": 2 },
    { "date": "2024-01-15", "count": 7 }
  ]
}
```

## Notes

- Returns last 7 days of activity events
- Returns last 7 days of contribution counts (for contribution graph)
- Cached for 2 minutes server-side
- `isPrivate` indicates repo visibility - useful for UI badges/indicators
- `viewerReactions` contains reaction IDs (for deletion), keyed by reaction type
