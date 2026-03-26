/**
 * Shared types for Gemini TIPC Router
 *
 * These types are shared between main process (implementation) and renderer (client).
 */

import type { ActionContext } from '@egoist/tipc/main';

// =============================================================================
// Domain Types
// =============================================================================

/**
 * Gemini model information
 */
export interface GeminiModel {
  id: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

/**
 * Commit data for summarization
 */
export interface CommitData {
  repoName: string;
  sha: string;
  message: string;
  author: string;
  additions?: number;
  deletions?: number;
}

/**
 * Streaming chunk from Gemini API
 */
export interface GeminiStreamChunk {
  type: 'text' | 'done' | 'error';
  content?: string;
  error?: string;
}

// =============================================================================
// Input Types
// =============================================================================

export interface ListModelsInput {
  apiKey: string;
}

export interface ValidateApiKeyInput {
  apiKey: string;
}

export interface SummarizeCommitsInput {
  apiKey: string;
  model: string;
  commits: CommitData[];
  userPrompt?: string;
}

// =============================================================================
// Output Types
// =============================================================================

export interface ListModelsOutput {
  success: boolean;
  models?: GeminiModel[];
  error?: string;
}

export interface ValidateApiKeyOutput {
  success: boolean;
  error?: string;
}

export interface SummarizeCommitsOutput {
  success: boolean;
  summary?: string;
  error?: string;
}

// =============================================================================
// Router Type Definition
// =============================================================================

/**
 * Gemini Router Type - TIPC RouterType-compatible type
 */
export type GeminiRouterType = Record<
  string,
  { action: (args: { context: ActionContext; input: unknown }) => Promise<unknown> }
> & {
  listModels: {
    action: (args: {
      context: ActionContext;
      input: ListModelsInput;
    }) => Promise<ListModelsOutput>;
  };

  validateApiKey: {
    action: (args: {
      context: ActionContext;
      input: ValidateApiKeyInput;
    }) => Promise<ValidateApiKeyOutput>;
  };

  summarizeCommits: {
    action: (args: {
      context: ActionContext;
      input: SummarizeCommitsInput;
    }) => Promise<SummarizeCommitsOutput>;
  };
};
