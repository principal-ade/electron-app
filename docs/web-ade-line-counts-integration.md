# Web-ADE Line Counts Integration

The web-ade application now supports a line counts cache API. When users open File City 3D in the electron app, the app can push line counts to the web cache, making them available for web users viewing the same repository.

## Why This Matters

- Web-ADE cannot efficiently count lines for large repos (GitHub API rate limits)
- Repos with ≥2000 files require pre-computed cache from the desktop app
- Once cached, any web user can view the 3D visualization with accurate building heights

## API Endpoint

```
PUT https://app.principal-ade.com/api/line-counts/{owner}/{repo}
```

### Headers

```
Content-Type: application/json
```

### Request Body

```json
{
  "lineCounts": {
    "src/index.ts": 150,
    "src/utils/helper.ts": 42,
    "README.md": 100
  },
  "fileCount": 3
}
```

- `lineCounts`: Record of file paths to line counts (same format as `countLinesInRepository()` returns)
- `fileCount`: Optional, will be computed from lineCounts if not provided

### Response

```json
{
  "success": true,
  "fileCount": 3
}
```

## Integration Point

The integration is implemented in the main process at `src/main/stores/FileCityImageService.ts` in the `countLinesInRepository()` method.

When line counts are computed, the service automatically:
1. Extracts owner/repo from the git remote URL (`git remote get-url origin`)
2. Pushes line counts to the web cache API (fire and forget)

```typescript
// After counting lines, push to web-ade cache
const remoteUrl = execSync('git remote get-url origin', { cwd: repoPath, encoding: 'utf-8' }).trim();
const parsed = this.parseGitRemoteUrl(remoteUrl);
if (parsed) {
  this.pushLineCountsToWebCache(parsed.owner, parsed.repo, lineCounts);
}
```

## Notes

- The API is idempotent - calling it multiple times just overwrites the cache
- Cache key is `{owner}/{repo}` (lowercased), no SHA versioning
- Line counts are stored in S3 with 24h cache headers
- No need to wait for the PUT to complete - fire and forget is fine
