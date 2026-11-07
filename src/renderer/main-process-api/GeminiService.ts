import { geminiClient } from '../tipc/geminiClient';
import type { SummarizeCommitsInput } from '../../shared/tipc/geminiRouterTypes';

/** Renderer-facing service for Gemini-backed commit summaries. */
export class GeminiService {
  static summarizeCommits(input: SummarizeCommitsInput) {
    return geminiClient.summarizeCommits(input);
  }
}
