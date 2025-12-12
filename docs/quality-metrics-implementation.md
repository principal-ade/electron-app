# Quality Metrics Implementation Guide

This document describes how to implement quality metrics fetching for the `RepositoryQualityGridPanel` in the Principal window's workspaces view.

## Overview

Quality metrics originate from **GitHub Actions artifacts** produced by `quality-lens-cli`. Each repository that has the Quality Lens GitHub Action configured will produce artifacts named `quality-lens-results-<commit-sha>` containing a `results.json` file with standardized quality metrics.

## Data Structure

The quality hexagon uses a 6-dimensional model:

```typescript
interface QualityHexagonMetrics {
  tests: number;         // Test coverage and passing rate (0-100)
  deadCode: number;      // Dead code elimination score (0-100)
  formatting: number;    // Code formatting consistency (0-100)
  linting: number;       // Linting compliance score (0-100)
  types: number;         // Type safety score (0-100)
  documentation: number; // Documentation coverage (0-100)
}
```

The panel expects data in this shape:

```typescript
interface RepositoriesQualitySliceData {
  repositories: Array<{
    id: string;
    name: string;
    path?: string;
    packages: Array<{
      name: string;
      version?: string;
      metrics: QualityHexagonMetrics;
    }>;
  }>;
  lastUpdated: string;
}
```

## Recommended Architecture

### Hash-Based Content-Addressable Cache

Since Git commit SHAs are immutable, use them as cache keys for quality artifacts:

```typescript
interface QualityCacheEntry {
  commitSha: string;
  metrics: QualityHexagonMetrics;
  timestamp: string;
  fetchedAt: number;
}

class QualityMetricsCache {
  private cache: Map<string, QualityCacheEntry> = new Map();
  private TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get cached metrics by commit SHA
   * Since commit SHAs are immutable, cached data is always valid
   */
  get(commitSha: string): QualityCacheEntry | null {
    const entry = this.cache.get(commitSha);
    if (!entry) return null;

    // Optional: Check TTL for very old entries
    if (Date.now() - entry.fetchedAt > this.TTL) {
      this.cache.delete(commitSha);
      return null;
    }

    return entry;
  }

  set(commitSha: string, metrics: QualityHexagonMetrics, timestamp: string): void {
    this.cache.set(commitSha, {
      commitSha,
      metrics,
      timestamp,
      fetchedAt: Date.now(),
    });
  }

  /**
   * Get cache key for a repository + branch combination
   * Used to track "latest" commit SHA per branch
   */
  private branchHeads: Map<string, string> = new Map();

  setBranchHead(owner: string, repo: string, branch: string, commitSha: string): void {
    this.branchHeads.set(`${owner}/${repo}:${branch}`, commitSha);
  }

  getBranchHead(owner: string, repo: string, branch: string): string | null {
    return this.branchHeads.get(`${owner}/${repo}:${branch}`) ?? null;
  }
}
```

### Fetching Strategy

1. **For a specific commit**: Check cache by SHA, fetch if missing
2. **For latest on branch**:
   - Check if we know the branch head SHA
   - If cached SHA matches current HEAD, use cached metrics
   - Otherwise fetch latest artifact and update cache

```typescript
async function fetchQualityMetrics(
  owner: string,
  repo: string,
  options: { commit?: string; branch?: string } = {}
): Promise<QualityArtifactResponse | null> {
  const cache = getQualityMetricsCache();

  // If specific commit requested, check cache first
  if (options.commit) {
    const cached = cache.get(options.commit);
    if (cached) {
      return {
        commitSha: cached.commitSha,
        qualityMetrics: { hexagon: cached.metrics },
        timestamp: cached.timestamp,
      };
    }
  }

  // Fetch from GitHub API
  const response = await fetchFromGitHub(owner, repo, options);

  if (response) {
    // Cache by commit SHA (immutable)
    cache.set(
      response.commitSha,
      response.qualityMetrics.hexagon,
      response.timestamp
    );

    // Update branch head tracking
    if (options.branch) {
      cache.setBranchHead(owner, repo, options.branch, response.commitSha);
    }
  }

  return response;
}
```

## GitHub API Integration

### Listing Quality Artifacts

```typescript
import { Octokit } from '@octokit/rest';

async function listQualityArtifacts(
  octokit: Octokit,
  owner: string,
  repo: string,
  options: { branch?: string; limit?: number } = {}
): Promise<QualityArtifact[]> {
  const { data } = await octokit.actions.listArtifactsForRepo({
    owner,
    repo,
    per_page: options.limit ?? 30,
    name: 'quality-lens-results', // Filter by name prefix
  });

  // Filter to quality-lens artifacts and extract commit SHA from name
  const artifacts = data.artifacts
    .filter(a => a.name.startsWith('quality-lens-results-'))
    .map(a => ({
      id: a.id,
      name: a.name,
      commitSha: a.name.replace('quality-lens-results-', ''),
      createdAt: a.created_at,
      expiresAt: a.expires_at,
    }));

  // Optionally filter by branch using workflow run info
  if (options.branch) {
    // Additional filtering logic...
  }

  return artifacts;
}
```

### Downloading and Parsing Artifact

```typescript
import JSZip from 'jszip';

async function downloadAndParseArtifact(
  octokit: Octokit,
  owner: string,
  repo: string,
  artifactId: number
): Promise<QualityHexagonMetrics | null> {
  // Download artifact as ZIP
  const { data } = await octokit.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: 'zip',
  });

  // Parse ZIP and extract results.json
  const zip = await JSZip.loadAsync(data as ArrayBuffer);
  const resultsFile = zip.file('results.json');

  if (!resultsFile) {
    return null;
  }

  const content = await resultsFile.async('string');
  const results = JSON.parse(content);

  return results.qualityMetrics?.hexagon ?? null;
}
```

## Integration with WorkspacesPanelContext

Add a `repositoriesQuality` slice to the WorkspacesPanelContext:

```typescript
// In WorkspacesPanelContext.tsx

const [repositoriesQuality, setRepositoriesQuality] = useState<DataSlice<RepositoriesQualitySliceData>>({
  scope: 'workspace',
  name: 'repositoriesQuality',
  data: null,
  loading: false,
  error: null,
  refresh: async () => {
    await fetchAllRepositoriesQuality();
  },
});

async function fetchAllRepositoriesQuality() {
  setRepositoriesQuality(prev => ({ ...prev, loading: true, error: null }));

  try {
    // Get list of repositories in current workspace/organization
    const repositories = getWorkspaceRepositories();

    // Fetch quality metrics for each repository in parallel
    const results = await Promise.all(
      repositories.map(async (repo) => {
        const metrics = await fetchQualityMetrics(repo.owner, repo.name, { branch: 'main' });
        if (!metrics) return null;

        return {
          id: repo.id,
          name: repo.name,
          path: repo.path,
          packages: [{
            name: repo.name,
            metrics: metrics.qualityMetrics.hexagon,
          }],
        };
      })
    );

    setRepositoriesQuality({
      scope: 'workspace',
      name: 'repositoriesQuality',
      data: {
        repositories: results.filter(Boolean),
        lastUpdated: new Date().toISOString(),
      },
      loading: false,
      error: null,
      refresh: async () => fetchAllRepositoriesQuality(),
    });
  } catch (error) {
    setRepositoriesQuality(prev => ({
      ...prev,
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to fetch quality metrics',
    }));
  }
}
```

## Caching Recommendations

### Why Hash-Based Caching Works

1. **Immutability**: Git commit SHAs are content-addressed hashes - they never change
2. **Deduplication**: Same commit = same metrics, regardless of when/where fetched
3. **Long TTL**: Can cache for 24+ hours since data won't change
4. **Offline Support**: Cached data remains valid indefinitely

### Cache Storage Options

| Storage | Pros | Cons |
|---------|------|------|
| In-Memory Map | Fast, simple | Lost on restart |
| electron-store | Persists across sessions | Slight I/O overhead |
| SQLite (libsql) | Query-able, indexed | More complexity |
| IndexedDB | Browser-native, large capacity | Async API |

### Recommended Approach

Use a two-tier cache:

1. **Memory cache**: Fast access during session
2. **Persistent cache** (electron-store): Survives restarts

```typescript
class TieredQualityCache {
  private memoryCache = new Map<string, QualityCacheEntry>();
  private store: ElectronStore;

  async get(commitSha: string): Promise<QualityCacheEntry | null> {
    // Check memory first
    if (this.memoryCache.has(commitSha)) {
      return this.memoryCache.get(commitSha)!;
    }

    // Check persistent store
    const stored = await this.store.get(`quality:${commitSha}`);
    if (stored) {
      // Promote to memory cache
      this.memoryCache.set(commitSha, stored);
      return stored;
    }

    return null;
  }

  async set(commitSha: string, entry: QualityCacheEntry): Promise<void> {
    this.memoryCache.set(commitSha, entry);
    await this.store.set(`quality:${commitSha}`, entry);
  }
}
```

## Error Handling

Handle common scenarios gracefully:

```typescript
async function fetchWithFallback(owner: string, repo: string): Promise<QualityResult> {
  try {
    const metrics = await fetchQualityMetrics(owner, repo, { branch: 'main' });
    if (metrics) return { status: 'success', data: metrics };

    // No artifact found - repo may not have Quality Lens configured
    return { status: 'not-configured' };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { status: 'auth-required' };
    }
    if (error.status === 404) {
      return { status: 'not-found' };
    }
    return { status: 'error', error: error.message };
  }
}
```

## Performance Considerations

1. **Parallel Fetching**: Fetch metrics for multiple repos concurrently
2. **Batch Requests**: Use GitHub GraphQL API to fetch multiple repos in one request
3. **Background Refresh**: Update cache in background, show stale data immediately
4. **Rate Limiting**: GitHub API has rate limits - implement exponential backoff

## References

- [quality-lens-cli](https://github.com/principal-ai/quality-lens-cli) - CLI that generates quality artifacts
- [web-ade implementation](../../../web-ade/web-ade/src/lib/server/GitHubArtifactService.ts) - Reference implementation
- [@principal-ai/codebase-quality-lenses](https://www.npmjs.com/package/@principal-ai/codebase-quality-lenses) - Type definitions
