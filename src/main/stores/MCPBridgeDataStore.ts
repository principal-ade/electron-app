import crypto from 'crypto';
import { getTypedStorageManagerInstance } from './initialization';
import { StaticNamespaces } from '../../shared/types/namespaces.types';
import { repositoryCache } from './RepositoryCache';

interface MCPBridgeRequest {
  id: string;
  endpoint: string;
  method: string;
  body: any;
  headers?: Record<string, string>;
  timestamp: number;
  repositoryUrl?: string;
  filePath?: string;
}

interface MCPBridgeResponse {
  id: string;
  requestId: string;
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
  timestamp: number;
  duration: number;
}

interface MCPBridgeDataEntry {
  request: MCPBridgeRequest;
  response?: MCPBridgeResponse;
  repositoryUrl?: string;
  sessionId?: string;
  tags?: string[];
}

interface MCPBridgeStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  endpointUsage: Map<string, number>;
  lastAccessTime: number;
}

export class MCPBridgeDataStore {
  private memoryCache: Map<string, MCPBridgeDataEntry[]> = new Map();
  private statisticsCache: Map<string, MCPBridgeStatistics> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private maxEntriesPerRepository = 1000;
  private retentionDays = 30;

  constructor() {
    // Lazy initialization
  }

  /**
   * Generate a storage key for a repository URL
   */
  private getRepositoryKey(remoteUrl: string): string {
    const urlHash = crypto.createHash('sha256').update(remoteUrl).digest('hex').substring(0, 16);
    return `mcp_bridge_${urlHash}`;
  }

  /**
   * Generate a statistics key for a repository URL
   */
  private getStatisticsKey(remoteUrl: string): string {
    const urlHash = crypto.createHash('sha256').update(remoteUrl).digest('hex').substring(0, 16);
    return `mcp_stats_${urlHash}`;
  }

  /**
   * Ensure store is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeStore();
    await this.initPromise;
    this.initialized = true;
  }

  /**
   * Initialize store from storage
   */
  private async initializeStore(): Promise<void> {
    try {
      const typedStore = await getTypedStorageManagerInstance();

      // Get all MCP bridge data keys
      const keys = await typedStore.keys(StaticNamespaces.MCP_BRIDGE_DATA);

      // Load recent data into memory cache (last 24 hours)
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);

      for (const key of keys) {
        if (key.startsWith('mcp_bridge_')) {
          const result = await typedStore.get(key, StaticNamespaces.MCP_BRIDGE_DATA);
          if (result.success && result.data) {
            const entries = result.data as MCPBridgeDataEntry[];
            
            // Filter for recent entries
            const recentEntries = entries.filter(
              entry => entry.request.timestamp > cutoffTime
            );

            if (recentEntries.length > 0) {
              // Extract repository URL from key
              const urlHash = key.replace('mcp_bridge_', '');
              // We'll need to maintain a reverse mapping or store the URL with the data
              // For now, we'll store by key
              this.memoryCache.set(key, recentEntries);
            }
          }
        } else if (key.startsWith('mcp_stats_')) {
          const result = await typedStore.get(key, StaticNamespaces.MCP_BRIDGE_DATA);
          if (result.success && result.data) {
            const stats = result.data as any;
            // Convert endpointUsage back to Map if it was serialized as object
            if (stats.endpointUsage && !(stats.endpointUsage instanceof Map)) {
              stats.endpointUsage = new Map(Object.entries(stats.endpointUsage));
            }
            this.statisticsCache.set(key, stats as MCPBridgeStatistics);
          }
        }
      }

      console.log(`[MCPBridgeDataStore] Initialized with ${this.memoryCache.size} repositories in cache`);
    } catch (error) {
      console.error('[MCPBridgeDataStore] Failed to initialize:', error);
    }
  }

  /**
   * Store a request/response pair
   */
  async storeInteraction(
    request: Omit<MCPBridgeRequest, 'id' | 'timestamp'>,
    response?: Omit<MCPBridgeResponse, 'id' | 'requestId' | 'timestamp' | 'duration'>,
    filePath?: string
  ): Promise<void> {
    await this.ensureInitialized();

    // Generate IDs and timestamps
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const requestTimestamp = Date.now();

    // Discover repository if path is provided
    let repositoryUrl: string | undefined;
    if (filePath) {
      try {
        const repoInfo = await repositoryCache.getRepositoryForPath(filePath);
        repositoryUrl = repoInfo?.repository?.remoteUrl;
      } catch (error) {
        console.warn('[MCPBridgeDataStore] Could not determine repository for path:', filePath);
      }
    }

    // Create the full request object
    const fullRequest: MCPBridgeRequest = {
      ...request,
      id: requestId,
      timestamp: requestTimestamp,
      repositoryUrl,
      filePath
    };

    // Create the full response object if provided
    let fullResponse: MCPBridgeResponse | undefined;
    if (response) {
      const responseTimestamp = Date.now();
      fullResponse = {
        ...response,
        id: `res_${responseTimestamp}_${Math.random().toString(36).substr(2, 9)}`,
        requestId,
        timestamp: responseTimestamp,
        duration: responseTimestamp - requestTimestamp
      };
    }

    // Create the entry
    const entry: MCPBridgeDataEntry = {
      request: fullRequest,
      response: fullResponse,
      repositoryUrl,
      sessionId: process.env.SESSION_ID,
      tags: this.extractTags(request.endpoint, request.body)
    };

    // Store in memory and persist
    if (repositoryUrl) {
      await this.storeForRepository(repositoryUrl, entry);
      await this.updateStatistics(repositoryUrl, entry);
    } else {
      // Store under a general key for non-repository requests
      await this.storeForRepository('__no_repository__', entry);
    }
  }

  /**
   * Store entry for a specific repository
   */
  private async storeForRepository(
    repositoryUrl: string,
    entry: MCPBridgeDataEntry
  ): Promise<void> {
    const key = this.getRepositoryKey(repositoryUrl);

    // Get existing entries from cache or storage
    let entries = this.memoryCache.get(key) || [];
    
    if (entries.length === 0) {
      // Try to load from storage if not in cache
      const typedStore = await getTypedStorageManagerInstance();
      const result = await typedStore.get(key, StaticNamespaces.MCP_BRIDGE_DATA);
      if (result.success && result.data) {
        entries = result.data as MCPBridgeDataEntry[];
      }
    }

    // Add new entry
    entries.push(entry);

    // Enforce retention policy
    entries = this.enforceRetentionPolicy(entries);

    // Update memory cache
    this.memoryCache.set(key, entries);

    // Persist to storage
    const typedStore = await getTypedStorageManagerInstance();
    const result = await typedStore.set(key, entries, StaticNamespaces.MCP_BRIDGE_DATA);

    if (!result.success) {
      console.error('[MCPBridgeDataStore] Failed to persist entries:', result.error);
    }
  }

  /**
   * Update statistics for a repository
   */
  private async updateStatistics(
    repositoryUrl: string,
    entry: MCPBridgeDataEntry
  ): Promise<void> {
    const key = this.getStatisticsKey(repositoryUrl);

    // Get existing statistics
    let stats: MCPBridgeStatistics = this.statisticsCache.get(key) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      endpointUsage: new Map<string, number>(),
      lastAccessTime: Date.now()
    };

    // Update statistics
    stats.totalRequests++;
    stats.lastAccessTime = Date.now();

    // Update endpoint usage
    const endpoint = entry.request.endpoint;
    const currentUsage = stats.endpointUsage.get(endpoint) || 0;
    stats.endpointUsage.set(endpoint, currentUsage + 1);

    // Update success/failure counts and response time
    if (entry.response) {
      const statusCode = entry.response.statusCode;
      if (statusCode >= 200 && statusCode < 300) {
        stats.successfulRequests++;
      } else {
        stats.failedRequests++;
      }

      // Update average response time
      const newAverage = 
        (stats.averageResponseTime * (stats.totalRequests - 1) + entry.response.duration) / 
        stats.totalRequests;
      stats.averageResponseTime = newAverage;
    }

    // Update caches
    this.statisticsCache.set(key, stats);

    // Persist to storage (convert Map to object for JSON serialization)
    const typedStore = await getTypedStorageManagerInstance();
    const statsToStore = {
      ...stats,
      endpointUsage: Object.fromEntries(stats.endpointUsage)
    };
    await typedStore.set(key, statsToStore, StaticNamespaces.MCP_BRIDGE_DATA);
  }

  /**
   * Extract tags from request data
   * Only uses explicitly provided tags - no auto-generation
   */
  private extractTags(endpoint: string, body: any): string[] {
    // Only use tags explicitly provided in the request
    if (Array.isArray(body?.tags)) {
      // Ensure all tags are strings
      const stringTags = body.tags.filter((tag: any) => typeof tag === 'string') as string[];
      return [...new Set(stringTags)]; // Remove duplicates
    }

    return [];
  }

  /**
   * Enforce retention policy on entries
   */
  private enforceRetentionPolicy(entries: MCPBridgeDataEntry[]): MCPBridgeDataEntry[] {
    const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);

    // Remove old entries
    let filtered = entries.filter(entry => entry.request.timestamp > cutoffTime);

    // If still too many, keep only the most recent
    if (filtered.length > this.maxEntriesPerRepository) {
      filtered = filtered
        .sort((a, b) => b.request.timestamp - a.request.timestamp)
        .slice(0, this.maxEntriesPerRepository);
    }

    return filtered;
  }

  /**
   * Get all interactions for a repository
   */
  async getInteractionsForRepository(
    repositoryUrl: string,
    options?: {
      startTime?: number;
      endTime?: number;
      endpoint?: string;
      tags?: string[];
      limit?: number;
    }
  ): Promise<MCPBridgeDataEntry[]> {
    await this.ensureInitialized();

    const key = this.getRepositoryKey(repositoryUrl);
    let entries = this.memoryCache.get(key);

    if (!entries) {
      // Load from storage
      const typedStore = await getTypedStorageManagerInstance();
      const result = await typedStore.get(key, StaticNamespaces.MCP_BRIDGE_DATA);
      if (result.success && result.data) {
        entries = result.data as MCPBridgeDataEntry[];
        this.memoryCache.set(key, entries);
      } else {
        return [];
      }
    }

    // Apply filters
    let filtered = [...entries];

    if (options?.startTime) {
      filtered = filtered.filter(e => e.request.timestamp >= options.startTime!);
    }

    if (options?.endTime) {
      filtered = filtered.filter(e => e.request.timestamp <= options.endTime!);
    }

    if (options?.endpoint) {
      filtered = filtered.filter(e => e.request.endpoint === options.endpoint);
    }

    if (options?.tags && options.tags.length > 0) {
      filtered = filtered.filter(e => 
        options.tags!.some(tag => e.tags?.includes(tag))
      );
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.request.timestamp - a.request.timestamp);

    // Apply limit
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get statistics for a repository
   */
  async getStatisticsForRepository(repositoryUrl: string): Promise<MCPBridgeStatistics | null> {
    await this.ensureInitialized();

    const key = this.getStatisticsKey(repositoryUrl);
    let stats = this.statisticsCache.get(key);

    if (!stats) {
      // Load from storage
      const typedStore = await getTypedStorageManagerInstance();
      const result = await typedStore.get(key, StaticNamespaces.MCP_BRIDGE_DATA);
      if (result.success && result.data) {
        stats = result.data as MCPBridgeStatistics;
        this.statisticsCache.set(key, stats);
      }
    }

    return stats || null;
  }

  /**
   * Export interactions for testing
   */
  async exportForTesting(
    repositoryUrl: string,
    outputFormat: 'json' | 'jest' | 'mocha' = 'json'
  ): Promise<string> {
    const interactions = await this.getInteractionsForRepository(repositoryUrl);

    switch (outputFormat) {
      case 'jest':
        return this.formatAsJestTests(interactions);
      case 'mocha':
        return this.formatAsMochaTests(interactions);
      case 'json':
      default:
        return JSON.stringify(interactions, null, 2);
    }
  }

  /**
   * Format interactions as Jest tests
   */
  private formatAsJestTests(interactions: MCPBridgeDataEntry[]): string {
    let output = `// Generated MCP Bridge Tests\n`;
    output += `import { MCPBridge } from '../MCPBridge';\n\n`;
    output += `describe('MCP Bridge Interactions', () => {\n`;

    for (const interaction of interactions) {
      const testName = `${interaction.request.endpoint} - ${new Date(interaction.request.timestamp).toISOString()}`;
      output += `  test('${testName}', async () => {\n`;
      output += `    const request = ${JSON.stringify(interaction.request.body, null, 6).split('\n').join('\n    ')};\n`;
      output += `    const response = await MCPBridge.send('${interaction.request.endpoint}', request);\n`;
      
      if (interaction.response) {
        output += `    expect(response.statusCode).toBe(${interaction.response.statusCode});\n`;
        if (interaction.response.body?.success !== undefined) {
          output += `    expect(response.body.success).toBe(${interaction.response.body.success});\n`;
        }
      }
      
      output += `  });\n\n`;
    }

    output += `});\n`;
    return output;
  }

  /**
   * Format interactions as Mocha tests
   */
  private formatAsMochaTests(interactions: MCPBridgeDataEntry[]): string {
    let output = `// Generated MCP Bridge Tests\n`;
    output += `const { expect } = require('chai');\n`;
    output += `const { MCPBridge } = require('../MCPBridge');\n\n`;
    output += `describe('MCP Bridge Interactions', function() {\n`;

    for (const interaction of interactions) {
      const testName = `${interaction.request.endpoint} - ${new Date(interaction.request.timestamp).toISOString()}`;
      output += `  it('${testName}', async function() {\n`;
      output += `    const request = ${JSON.stringify(interaction.request.body, null, 6).split('\n').join('\n    ')};\n`;
      output += `    const response = await MCPBridge.send('${interaction.request.endpoint}', request);\n`;
      
      if (interaction.response) {
        output += `    expect(response.statusCode).to.equal(${interaction.response.statusCode});\n`;
        if (interaction.response.body?.success !== undefined) {
          output += `    expect(response.body.success).to.equal(${interaction.response.body.success});\n`;
        }
      }
      
      output += `  });\n\n`;
    }

    output += `});\n`;
    return output;
  }

  /**
   * Clear all data for a repository
   */
  async clearRepositoryData(repositoryUrl: string): Promise<void> {
    await this.ensureInitialized();

    const dataKey = this.getRepositoryKey(repositoryUrl);
    const statsKey = this.getStatisticsKey(repositoryUrl);

    // Clear from memory cache
    this.memoryCache.delete(dataKey);
    this.statisticsCache.delete(statsKey);

    // Clear from storage
    const typedStore = await getTypedStorageManagerInstance();
    await typedStore.delete(dataKey, StaticNamespaces.MCP_BRIDGE_DATA);
    await typedStore.delete(statsKey, StaticNamespaces.MCP_BRIDGE_DATA);

    console.log(`[MCPBridgeDataStore] Cleared all data for repository: ${repositoryUrl}`);
  }

  /**
   * Get summary of all stored data
   */
  async getSummary(): Promise<{
    totalRepositories: number;
    totalInteractions: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  }> {
    await this.ensureInitialized();

    let totalInteractions = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;
    const endpointCounts = new Map<string, number>();

    // Aggregate from all repositories
    for (const [, entries] of this.memoryCache) {
      totalInteractions += entries.length;

      for (const entry of entries) {
        // Track oldest/newest
        if (!oldestEntry || entry.request.timestamp < oldestEntry) {
          oldestEntry = entry.request.timestamp;
        }
        if (!newestEntry || entry.request.timestamp > newestEntry) {
          newestEntry = entry.request.timestamp;
        }

        // Count endpoints
        const count = endpointCounts.get(entry.request.endpoint) || 0;
        endpointCounts.set(entry.request.endpoint, count + 1);
      }
    }

    // Get top endpoints
    const topEndpoints = Array.from(endpointCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    return {
      totalRepositories: this.memoryCache.size,
      totalInteractions,
      oldestEntry,
      newestEntry,
      topEndpoints
    };
  }
}

// Export singleton instance
export const mcpBridgeDataStore = new MCPBridgeDataStore();