/**
 * TIPC Client for Gemini AI Operations
 *
 * Type-safe RPC for Gemini API interactions, replacing the need for
 * direct ipcRenderer.invoke calls.
 */

import { createClient } from '@egoist/tipc/renderer';
import type {
  ListModelsInput,
  ValidateApiKeyInput,
  SummarizeCommitsInput,
  ListModelsOutput,
  ValidateApiKeyOutput,
  SummarizeCommitsOutput,
  GeminiRouterType,
  GeminiModel,
  CommitData,
} from '../../shared/tipc/geminiRouterTypes';

// =============================================================================
// Client Interface
// =============================================================================

/**
 * Gemini TIPC Client interface matching the router implementation.
 * This provides typed access to all Gemini operations.
 */
export interface GeminiClient {
  listModels: (input: ListModelsInput) => Promise<ListModelsOutput>;
  validateApiKey: (input: ValidateApiKeyInput) => Promise<ValidateApiKeyOutput>;
  summarizeCommits: (
    input: SummarizeCommitsInput
  ) => Promise<SummarizeCommitsOutput>;
}

// =============================================================================
// Lazy-initialized Client
// =============================================================================

/**
 * Lazy-initialized TIPC client for Gemini operations.
 * We use lazy initialization because window.electron is injected by the preload
 * script and isn't available at module load time.
 */
let _geminiClient: GeminiClient | null = null;

function getGeminiClient(): GeminiClient {
  if (!_geminiClient) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error(
        'Gemini client not available - window.electron not initialized'
      );
    }
    // Use shared GeminiRouterType which satisfies RouterType constraint
    _geminiClient = createClient<GeminiRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as GeminiClient;
  }
  return _geminiClient;
}

// =============================================================================
// Exported Proxy Client
// =============================================================================

/**
 * Gemini TIPC client instance.
 * This is a Proxy that lazily accesses the actual client on first use.
 */
export const geminiClient: GeminiClient = new Proxy({} as GeminiClient, {
  get(_target, prop: keyof GeminiClient) {
    const client = getGeminiClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// =============================================================================
// Re-export Types for Convenience
// =============================================================================

export type {
  ListModelsInput,
  ValidateApiKeyInput,
  SummarizeCommitsInput,
  ListModelsOutput,
  ValidateApiKeyOutput,
  SummarizeCommitsOutput,
  GeminiModel,
  CommitData,
};
