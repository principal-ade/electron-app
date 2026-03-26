/**
 * TIPC Router for Gemini AI Operations
 *
 * Type-safe RPC for Gemini API interactions.
 * Handles model listing, API key validation, and commit summarization.
 */

import { tipc } from '@egoist/tipc/main';
import type {
  ListModelsInput,
  ValidateApiKeyInput,
  SummarizeCommitsInput,
  ListModelsOutput,
  ValidateApiKeyOutput,
  SummarizeCommitsOutput,
  GeminiModel,
  CommitData,
} from '../../../shared/tipc/geminiRouterTypes';

const t = tipc.create();

// =============================================================================
// Gemini API Response Types
// =============================================================================

interface GeminiListModelsResponse {
  models?: Array<{
    name: string;
    displayName: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
  }>;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// =============================================================================
// Gemini API Helper Functions
// =============================================================================

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Fetch available models from Gemini API
 */
async function fetchModels(apiKey: string): Promise<GeminiModel[]> {
  const response = await fetch(`${GEMINI_API_BASE}/models?key=${apiKey}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch models: ${error}`);
  }

  const data = (await response.json()) as GeminiListModelsResponse;

  // Filter to only models that support generateContent
  return (data.models || [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent')
    )
    .map(
      (m: {
        name: string;
        displayName: string;
        description?: string;
        inputTokenLimit?: number;
        outputTokenLimit?: number;
      }) => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
      })
    );
}

/**
 * Build prompt for commit summarization
 */
function buildPrompt(commits: CommitData[], userPrompt?: string): string {
  const commitsSummary = commits
    .map((c, i) => {
      let summary = `${i + 1}. [${c.repoName}] "${c.message}" by ${c.author}`;
      if (c.additions !== undefined || c.deletions !== undefined) {
        const parts = [];
        if (c.additions) parts.push(`+${c.additions}`);
        if (c.deletions) parts.push(`-${c.deletions}`);
        if (parts.length > 0) summary += ` (${parts.join(', ')})`;
      }
      return summary;
    })
    .join('\n');

  let prompt = `Analyze these commits and provide a concise summary.

COMMITS:
${commitsSummary}

`;

  if (userPrompt) {
    prompt += `USER'S QUESTION: ${userPrompt}

Please answer the user's question based on the commits above.`;
  } else {
    prompt += `Write a brief summary (under 200 words) covering:
- What changed (features, fixes, refactors)
- Common themes or patterns across the commits
- Notable changes to watch

Start directly with the summary. No greetings.`;
  }

  return prompt;
}

/**
 * Call Gemini API to generate content
 */
async function generateContent(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  const candidate = data.candidates?.[0];

  if (!candidate?.content?.parts?.[0]?.text) {
    throw new Error('No content in Gemini response');
  }

  return candidate.content.parts[0].text;
}

// =============================================================================
// Router Definition
// =============================================================================

export const geminiRouter = {
  /**
   * List available Gemini models
   */
  listModels: t.procedure.input<ListModelsInput>().action(async ({ input }) => {
    try {
      const models = await fetchModels(input.apiKey);
      return {
        success: true,
        models,
      } as ListModelsOutput;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list models',
      } as ListModelsOutput;
    }
  }),

  /**
   * Validate an API key by making a minimal API call
   */
  validateApiKey: t.procedure
    .input<ValidateApiKeyInput>()
    .action(async ({ input }) => {
      try {
        // Try to list models - if it works, the key is valid
        await fetchModels(input.apiKey);
        return {
          success: true,
        } as ValidateApiKeyOutput;
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Invalid API key',
        } as ValidateApiKeyOutput;
      }
    }),

  /**
   * Summarize commits using Gemini
   */
  summarizeCommits: t.procedure
    .input<SummarizeCommitsInput>()
    .action(async ({ input }) => {
      try {
        const prompt = buildPrompt(input.commits, input.userPrompt);
        const summary = await generateContent(
          input.apiKey,
          input.model,
          prompt
        );
        return {
          success: true,
          summary,
        } as SummarizeCommitsOutput;
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to summarize commits',
        } as SummarizeCommitsOutput;
      }
    }),
};

export type GeminiRouter = typeof geminiRouter;
