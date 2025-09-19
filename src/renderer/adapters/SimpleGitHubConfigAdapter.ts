/**
 * Simple GitHub Config Adapter - Direct fetch from raw.githubusercontent.com
 * Replaces SharedLibConfigAdapter for GitHub-only usage
 */

import { ConfigFetchAdapter, ConfigFetchResult } from '../../shared/configs';
import { ConfigSource } from '../../shared/configs';

export class SimpleGitHubConfigAdapter implements ConfigFetchAdapter {
  async fetchConfig(
    fileName: string,
    source: ConfigSource,
  ): Promise<ConfigFetchResult> {
    if (source.type !== 'github') {
      throw new Error('SimpleGitHubConfigAdapter only supports GitHub sources');
    }

    if (!source.owner || !source.repo) {
      throw new Error('GitHub source requires owner and repo');
    }

    const branch = source.branch || 'main';
    const url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${branch}/${fileName}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch from GitHub: ${response.status} ${response.statusText}`,
        );
      }

      const content = await response.text();

      // Validate JSON
      try {
        JSON.parse(content);
      } catch (error) {
        throw new Error(`Invalid JSON in ${fileName}: ${error.message}`);
      }

      return {
        content,
        source,
        timestamp: Date.now(),
        cached: false,
      };
    } catch (error) {
      throw new Error(`Error fetching from GitHub: ${error.message}`);
    }
  }

  async configExists(fileName: string, source: ConfigSource): Promise<boolean> {
    try {
      await this.fetchConfig(fileName, source);
      return true;
    } catch {
      return false;
    }
  }
}
