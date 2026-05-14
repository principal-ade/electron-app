export enum OpenCodeConvertAPIEvent {
  DETECT = 'open-code-convert:detect',
  RUN_PROMPT = 'open-code-convert:run-prompt',
  CONVERT_TRAIL = 'open-code-convert:convert-trail',
  PROGRESS = 'open-code-convert:progress',
}

export interface ConvertProgressEntry {
  /** Monotonic timestamp (ms since epoch). */
  time: number;
  /** Coarse category for styling / filtering. */
  kind: 'tool' | 'tool-result' | 'text' | 'step' | 'error' | 'info';
  /** Short human-readable label. */
  label: string;
  /** Optional secondary line (e.g. tool args). Truncate to ~200 chars. */
  detail?: string;
}

export interface OpenCodeDetectResult {
  installed: boolean;
  path?: string;
  version?: string;
  authed: boolean;
  providers?: string[];
  error?: string;
}

export interface OpenCodeRunPromptArgs {
  prompt: string;
  cwd?: string;
  system?: string;
}

export interface OpenCodeRunPromptResult {
  ok: boolean;
  text?: string;
  sessionId?: string;
  durationMs: number;
  error?: string;
}

export interface ConvertTrailResult {
  ok: boolean;
  /** Id of the new informative trail the agent forked from the source. */
  newTrailId?: string;
  /** Source investigation id the new trail was derived from. */
  derivedFrom?: string;
  /** Final text the agent returned (for surfacing to the user / debugging). */
  raw?: string;
  sessionId?: string;
  durationMs: number;
  error?: string;
}

export interface OpenCodeConvertAPI {
  detect: () => Promise<OpenCodeDetectResult>;
  runPrompt: (args: OpenCodeRunPromptArgs) => Promise<OpenCodeRunPromptResult>;
  convertTrail: (trailId: string) => Promise<ConvertTrailResult>;
  /**
   * Subscribe to progress entries emitted while a convert run is active.
   * Returns an unsubscribe function. Multiple subscribers are supported.
   */
  onProgress: (handler: (entry: ConvertProgressEntry) => void) => () => void;
}
