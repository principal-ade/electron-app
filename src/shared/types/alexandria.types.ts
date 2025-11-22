/**
 * Alexandria Repository types
 * Imports from @principal-ai/alexandria-core-library package - the standard for repository management
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

export type {
  AlexandriaRepositoryRegistry,
  GithubRepository,
  CodebaseViewSummary,
} from '@principal-ai/alexandria-core-library';

/**
 * Request/response types for our application's API layer
 */
export interface RegisterRepositoryRequest {
  owner: string;
  name: string;
  branch?: string;
  localPath?: string;
}

export interface RegisterRepositoryResponse {
  success: boolean;
  repository: AlexandriaEntry;
  message?: string;
  status: 'registered' | 'updated' | 'error';
}

export interface APIError {
  error: {
    code: string;
    message: string;
  };
}
