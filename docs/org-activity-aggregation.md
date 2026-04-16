# Organization Activity Aggregation

## Problem Statement

GitHub does not provide a native API endpoint for organization-wide commit activity heatmaps. To display an activity heatmap for an organization (similar to user profiles), we need to aggregate commit data across all repositories in the organization.

## Current Implementation

### User Profile Activity
User profiles fetch activity data from the backend API:
```typescript
GET https://app.principal-ade.com/api/github/user/${username}/activity
```
- Returns 365 days of contribution data
- Aggregated on the backend
- Efficient single API call

### Organization Profile Activity
Organization profiles also use a backend API endpoint:
```typescript
GET https://app.principal-ade.com/api/github/org/${orgName}/activity
```
- Returns aggregated commit data across all org repos
- Backend handles the heavy lifting
- Requires authentication

## Challenges with Client-Side Aggregation

### Approach 1: Repository-Based Aggregation

**Process:**
1. Fetch all organization repositories: `GET /orgs/${org}/repos`
2. For each repository, fetch commit history: `GET /repos/${owner}/${repo}/commits`
3. Paginate through commits (100 per page, up to 5000 commits per repo)
4. Aggregate commits by date across all repos

**Problems:**
- **API Rate Limits**: Authenticated users get 5,000 requests/hour. A large org with 100+ repos could easily exceed this
- **Performance**: Hundreds or thousands of API calls needed
- **Time**: Could take minutes to aggregate data for large organizations
- **Caching Complexity**: Would need sophisticated caching to avoid repeated aggregation

**Example Calculation:**
- Organization with 50 repositories
- Each repo averages 500 commits in past year
- 500 commits ÷ 100 per page = 5 API calls per repo
- 50 repos × 5 calls = **250 API requests** just for commit data
- Plus 1 request to list repos = **251 total requests**

### Approach 2: Member-Based Aggregation

**Process:**
1. Fetch all organization members: `GET /orgs/${org}/members`
2. For each member, fetch their activity
3. Filter activity to only include commits to org repositories
4. Aggregate by date

**Problems:**
- Even worse than repository-based approach
- Need to cross-reference each member's commits with org repos
- No efficient way to filter member activity by organization
- Would require fetching ALL member activity then filtering client-side

## Current Solution: Backend API

The backend API (`app.principal-ade.com`) handles aggregation with several advantages:

1. **Server-Side Processing**: No client rate limit concerns
2. **Caching**: Pre-computed data for popular organizations
3. **Batch Processing**: Can use GitHub GraphQL API for more efficient queries
4. **Background Jobs**: Can update data asynchronously without blocking UI

## Repository Heatmap Implementation

For comparison, single repository heatmaps are efficient:

### Local Repositories
Uses git CLI directly:
```typescript
// src/renderer/main-process-api/GitService.ts
git log --date=short --format=%ad --since=365 days ago
```
- Instant results
- No API calls needed
- Works offline

### Remote GitHub Repositories
Uses GitHub REST API with pagination:
```typescript
// src/main/version-control-providers/githubHandlers.ts
GET /repos/${owner}/${repo}/commits?since=${since}&per_page=100&page=${page}
```
- Paginated fetching (up to 5000 commits)
- 5-minute cache TTL
- Client-side aggregation by date
- Reasonable for single repo

## Proposed Future Solution: Local Aggregation Only

### Concept
Instead of trying to aggregate all org repos via API, only show activity for repositories we have **locally cloned** and tracked:

**Advantages:**
1. **No API calls needed**: Use local git directly (instant)
2. **Accurate representation**: Shows activity on repos the user actually works on
3. **Offline capable**: Works without internet connection
4. **No rate limits**: All data is local

**Implementation:**
```typescript
interface OrgActivityLocalAggregation {
  // Get all local repos that belong to this org
  const localOrgRepos = repositories.filter(r =>
    r.github?.owner === orgName
  );

  // For each local repo, use git CLI to get commit dates
  const activityPromises = localOrgRepos.map(repo =>
    GitService.getCommitDatesForHeatMap(repo.path, 365)
  );

  const activities = await Promise.all(activityPromises);

  // Aggregate all commits by date
  const activityMap = new Map<string, number>();
  for (const repoActivity of activities) {
    for (const day of repoActivity) {
      activityMap.set(day.date, (activityMap.get(day.date) || 0) + day.count);
    }
  }

  return activityMap;
}
```

**Limitations:**
- Only shows activity on repos the user has cloned locally
- Doesn't show full org-wide activity
- Different users will see different activity based on their local repos

**UI Considerations:**
- Add indicator: "Activity shown for X locally tracked repositories"
- Provide link to view full org activity on GitHub
- Show count of tracked vs total org repos

## Implementation Files

### Relevant Code Locations

**Organization Profile Panel:**
- `src/renderer/panels/OrgProfilePanel.tsx` - UI component
- `src/renderer/panels/OrgProfilePanel.stories.tsx` - Storybook stories

**Activity Fetching:**
- `src/renderer/feed-view/FeedPanelFramework.tsx` (line 936) - `getOrgActivity` action
- Uses `ApiProxyService` to call backend API

**Repository Activity (for reference):**
- `src/renderer/hooks/useCommitHeatMap.ts` - Hook for single repo heatmaps
- `src/renderer/main-process-api/GitService.ts` (line 158) - Local git commit fetching
- `src/main/version-control-providers/githubHandlers.ts` (line 2068) - Remote GitHub commit fetching

## Recommendations

### Short Term
Continue using backend API for org activity:
- Reliable and performant
- Works for all orgs regardless of local repos
- Provides complete picture

### Long Term
Consider hybrid approach:
1. **Local-first**: Show activity from locally tracked repos (instant, no API calls)
2. **Backend fallback**: If backend API available, show option to view full org activity
3. **Clear labeling**: Always indicate data source to user

### Alternative: Mixed Approach
```typescript
async function getOrgActivity(orgName: string) {
  // Try backend API first
  try {
    return await fetchFromBackendAPI(orgName);
  } catch (error) {
    // Fallback to local aggregation
    console.warn('Backend API unavailable, using local repos only');
    return await aggregateLocalRepoActivity(orgName);
  }
}
```

## Related Issues

- User profile activity works well (backend API)
- Repository profile activity works well (single repo, GitHub API)
- Organization profile activity needs backend OR local-only approach

## Next Steps

1. **Document current backend API contract** - What response format does it expect?
2. **Implement local aggregation fallback** - For orgs without backend support
3. **Add UI indicators** - Show users what data they're seeing
4. **Consider showing org repos** - Next major feature to implement
