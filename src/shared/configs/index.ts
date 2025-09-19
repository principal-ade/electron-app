/**
 * Shared configuration module
 * Central export point for all configuration-related types and data
 * This module can be extracted to a separate package if needed
 */

// Export types
export type {
  ConfigSource,
  ConfigFetchResult,
  ConfigFetchAdapter,
} from './types';

// Export gitignore patterns
export { universalGitignorePatterns } from './gitignorePatterns';
