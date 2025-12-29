/**
 * GitHub Actions Artifact Retrieval Service (Electron Main Process)
 *
 * Fetches quality lens results from GitHub Actions artifacts.
 * Adapted from web-ade's GitHubArtifactService for use in electron main process.
 */

import { Octokit } from '@octokit/rest';
import JSZip from 'jszip';
import { authService } from './AuthService';
import type {
  QualityHexagonMetrics,
  FormattedResults,
} from '@principal-ai/codebase-quality-lenses';

/**
 * Artifact info returned when listing
 */
export interface ArtifactInfo {
  id: number;
  name: string;
  size_in_bytes: number;
  created_at: string;
  expires_at: string;
  commitSha: string | null;
}

/**
 * Per-file quality metric from a lens
 */
export interface FileMetricData {
  file: string;
  score: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
  fixableCount?: number;
  categories?: Record<string, number>;
}

/**
 * Per-package quality metrics (from CLI output)
 */
export interface PackageQualityMetrics {
  name: string;
  path?: string;
  hexagon: QualityHexagonMetrics;
  /** List of lens IDs that actually ran for this package */
  lensesRan?: string[];
  /** True if this is a monorepo orchestrator package (config-only, no source) */
  isOrchestrator?: boolean;
}

/**
 * Response shape for the API
 */
export interface QualityArtifactResponse {
  commitSha: string;
  branch: string;
  timestamp: string;
  qualityMetrics: {
    /** Per-package hexagons for monorepo support */
    packages: PackageQualityMetrics[];
  };
  /** Per-file coverage percentages from Jest (path -> line coverage %) */
  fileCoverage?: Record<string, number>;
  /** Per-file quality metrics from all lenses, keyed by lens name */
  fileMetrics?: {
    eslint?: FileMetricData[];
    typescript?: FileMetricData[];
    prettier?: FileMetricData[];
    knip?: FileMetricData[];
    alexandria?: FileMetricData[];
  };
  artifactId: number;
  artifactName: string;
}

/**
 * Simple in-memory cache entry
 */
interface CacheEntry {
  data: QualityArtifactResponse;
  timestamp: number;
}

/**
 * Extracts commit SHA from artifact name
 * Expected format: quality-lens-results-<sha>
 */
function extractCommitSha(artifactName: string): string | null {
  const match = artifactName.match(/^quality-lens-results-([a-f0-9]+)$/);
  return match?.[1] ?? null;
}

/**
 * Unzips artifact data and extracts results.json
 * GitHub always returns artifacts as ZIP files
 */
async function extractResultsFromZip(
  zipData: ArrayBuffer,
): Promise<FormattedResults> {
  const zip = await JSZip.loadAsync(zipData);
  const resultsFile = zip.file('results.json');

  if (!resultsFile) {
    throw new Error('results.json not found in artifact');
  }

  const content = await resultsFile.async('string');
  return JSON.parse(content) as FormattedResults;
}

export class GitHubArtifactService {
  private static instance: GitHubArtifactService;
  private cache = new Map<string, CacheEntry>();
  // 1 hour TTL - artifacts are immutable per commit
  private readonly CACHE_TTL = 60 * 60 * 1000;

  private constructor() {
    console.log('[GitHubArtifactService] Initialized');
  }

  static getInstance(): GitHubArtifactService {
    if (!GitHubArtifactService.instance) {
      GitHubArtifactService.instance = new GitHubArtifactService();
    }
    return GitHubArtifactService.instance;
  }

  /**
   * Get an authenticated Octokit instance using the stored GitHub token
   */
  private async getOctokit(): Promise<Octokit> {
    const token = await authService.getValidToken();
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }
    return new Octokit({ auth: token });
  }

  /**
   * Create a cache key for owner/repo@commit
   */
  private getCacheKey(owner: string, repo: string, commitSha: string): string {
    return `${owner}/${repo}@${commitSha}`;
  }

  /**
   * Get cached response if available and not expired
   */
  private getFromCache(key: string): QualityArtifactResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Store response in cache
   */
  private setCache(key: string, data: QualityArtifactResponse): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Lists all quality lens artifacts for a repository
   */
  async listQualityArtifacts(
    owner: string,
    repo: string,
    options: { limit?: number } = {},
  ): Promise<ArtifactInfo[]> {
    const { limit = 10 } = options;
    console.log(
      `[GitHubArtifactService] Listing artifacts for ${owner}/${repo}`,
    );

    const octokit = await this.getOctokit();

    const { data } = await octokit.rest.actions.listArtifactsForRepo({
      owner,
      repo,
      per_page: 100,
    });

    // Filter to only quality-lens artifacts and limit
    const qualityArtifacts: ArtifactInfo[] = data.artifacts
      .filter((a) => a.name.startsWith('quality-lens-results-'))
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        name: a.name,
        size_in_bytes: a.size_in_bytes,
        created_at: a.created_at ?? '',
        expires_at: a.expires_at ?? '',
        commitSha: extractCommitSha(a.name),
      }));

    console.log(
      `[GitHubArtifactService] Found ${qualityArtifacts.length} quality artifacts`,
    );
    return qualityArtifacts;
  }

  /**
   * Gets quality metrics for a specific commit
   */
  async getQualityMetricsForCommit(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<QualityArtifactResponse | null> {
    // Check cache first
    const cacheKey = this.getCacheKey(owner, repo, commitSha);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[GitHubArtifactService] Cache hit for ${cacheKey}`);
      return cached;
    }

    console.log(
      `[GitHubArtifactService] Fetching metrics for ${owner}/${repo}@${commitSha}`,
    );

    const octokit = await this.getOctokit();

    // Search for artifact by commit SHA
    const { data } = await octokit.rest.actions.listArtifactsForRepo({
      owner,
      repo,
      name: `quality-lens-results-${commitSha}`,
      per_page: 1,
    });

    if (data.artifacts.length === 0) {
      // Try partial match - search all and filter
      const allArtifacts = await this.listQualityArtifacts(owner, repo, {
        limit: 50,
      });
      const matching = allArtifacts.find(
        (a) => a.commitSha?.startsWith(commitSha) || a.name.includes(commitSha),
      );

      if (!matching) {
        console.log(
          `[GitHubArtifactService] No artifact found for commit ${commitSha}`,
        );
        return null;
      }

      const result = await this.downloadAndParseArtifact(
        owner,
        repo,
        matching.id,
        matching.name,
      );
      if (result) {
        this.setCache(this.getCacheKey(owner, repo, result.commitSha), result);
      }
      return result;
    }

    const artifact = data.artifacts[0]!;
    const result = await this.downloadAndParseArtifact(
      owner,
      repo,
      artifact.id,
      artifact.name,
    );
    if (result) {
      this.setCache(cacheKey, result);
    }
    return result;
  }

  /**
   * Gets quality metrics for the latest commit on a branch
   */
  async getLatestQualityMetrics(
    owner: string,
    repo: string,
    branch: string = 'main',
  ): Promise<QualityArtifactResponse | null> {
    console.log(
      `[GitHubArtifactService] Getting latest metrics for ${owner}/${repo}@${branch}`,
    );

    try {
      const octokit = await this.getOctokit();

      // Get the latest commit SHA on the branch
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });

      const commitSha = refData.object.sha;
      console.log(
        `[GitHubArtifactService] Latest commit on ${branch}: ${commitSha}`,
      );

      // Try to find artifact for this exact commit
      const result = await this.getQualityMetricsForCommit(
        owner,
        repo,
        commitSha,
      );

      if (result) {
        return result;
      }

      // If no artifact for latest commit, return the most recent artifact
      console.log(
        `[GitHubArtifactService] No artifact for latest commit, checking for most recent`,
      );
      const artifacts = await this.listQualityArtifacts(owner, repo, {
        limit: 1,
      });

      if (artifacts.length === 0) {
        console.log(`[GitHubArtifactService] No quality artifacts found`);
        return null;
      }

      const firstArtifact = artifacts[0]!;
      return this.downloadAndParseArtifact(
        owner,
        repo,
        firstArtifact.id,
        firstArtifact.name,
      );
    } catch (error) {
      // If branch doesn't exist or any API error, try to get any artifact
      console.log(
        `[GitHubArtifactService] Error during lookup, checking for any artifact:`,
        error instanceof Error ? error.message : error,
      );

      try {
        const artifacts = await this.listQualityArtifacts(owner, repo, {
          limit: 1,
        });

        if (artifacts.length === 0) {
          console.log(
            `[GitHubArtifactService] No quality artifacts found for ${owner}/${repo}`,
          );
          return null;
        }

        const firstArtifact = artifacts[0]!;
        return this.downloadAndParseArtifact(
          owner,
          repo,
          firstArtifact.id,
          firstArtifact.name,
        );
      } catch (fallbackError) {
        // No artifacts available for this repo
        console.log(
          `[GitHubArtifactService] No quality artifacts available for ${owner}/${repo}:`,
          fallbackError instanceof Error
            ? fallbackError.message
            : fallbackError,
        );
        return null;
      }
    }
  }

  /**
   * Downloads artifact and parses the results.json
   */
  private async downloadAndParseArtifact(
    owner: string,
    repo: string,
    artifactId: number,
    artifactName: string,
  ): Promise<QualityArtifactResponse> {
    console.log(
      `[GitHubArtifactService] Downloading artifact ${artifactId}: ${artifactName}`,
    );

    const octokit = await this.getOctokit();

    // Download artifact as ZIP
    const { data: zipData } = await octokit.rest.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: artifactId,
      archive_format: 'zip',
    });

    // Extract and parse results.json
    const results = await extractResultsFromZip(zipData as ArrayBuffer);

    // Extract file coverage and file metrics from lens results
    const fileCoverage: Record<string, number> = {};
    const fileMetrics: QualityArtifactResponse['fileMetrics'] = {};

    for (const result of results.results) {
      // Use type assertion since these fields may not be in the published npm types yet
      const resultWithExtras = result as typeof result & {
        coverage?: { files?: Array<{ file: string; lines: number }> };
        fileMetrics?: FileMetricData[];
      };

      // Extract coverage data (Jest)
      if (resultWithExtras.coverage?.files) {
        for (const file of resultWithExtras.coverage.files) {
          fileCoverage[file.file] = file.lines;
        }
      }

      // Extract fileMetrics by lens type
      if (
        resultWithExtras.fileMetrics &&
        resultWithExtras.fileMetrics.length > 0
      ) {
        const lensId = result.lens.id.toLowerCase();
        switch (lensId) {
          case 'eslint':
            fileMetrics.eslint = resultWithExtras.fileMetrics;
            break;
          case 'typescript':
            fileMetrics.typescript = resultWithExtras.fileMetrics;
            break;
          case 'prettier':
            fileMetrics.prettier = resultWithExtras.fileMetrics;
            break;
          case 'knip':
            fileMetrics.knip = resultWithExtras.fileMetrics;
            break;
          case 'alexandria':
            fileMetrics.alexandria = resultWithExtras.fileMetrics;
            break;
        }
      }
    }

    // Get per-package hexagons from CLI output
    const packages =
      (results.qualityMetrics as { packages?: PackageQualityMetrics[] })
        ?.packages ?? [];

    console.log(
      `[GitHubArtifactService] Parsed artifact with ${packages.length} packages, ` +
        `fileCoverage: ${Object.keys(fileCoverage).length} files, ` +
        `fileMetrics: ${Object.keys(fileMetrics).join(', ') || 'none'}`,
    );

    return {
      commitSha:
        results.metadata.git?.commit ??
        extractCommitSha(artifactName) ??
        'unknown',
      branch: results.metadata.git?.branch ?? 'unknown',
      timestamp: results.metadata.timestamp,
      qualityMetrics: { packages },
      fileCoverage:
        Object.keys(fileCoverage).length > 0 ? fileCoverage : undefined,
      fileMetrics:
        Object.keys(fileMetrics).length > 0 ? fileMetrics : undefined,
      artifactId,
      artifactName,
    };
  }

  /**
   * Clear the in-memory cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[GitHubArtifactService] Cache cleared');
  }
}

export const gitHubArtifactService = GitHubArtifactService.getInstance();
