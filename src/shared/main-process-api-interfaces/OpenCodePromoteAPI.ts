export enum OpenCodePromoteAPIEvent {
  DETECT = 'open-code-promote:detect',
  RUN_PROMPT = 'open-code-promote:run-prompt',
  PROMOTE_TRAIL = 'open-code-promote:promote-trail',
  PROGRESS = 'open-code-promote:progress',
}

export interface PromoteProgressEntry {
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

export interface PromoteTrailResult {
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

export interface OpenCodePromoteAPI {
  detect: () => Promise<OpenCodeDetectResult>;
  runPrompt: (args: OpenCodeRunPromptArgs) => Promise<OpenCodeRunPromptResult>;
  promoteTrail: (trailId: string) => Promise<PromoteTrailResult>;
  /**
   * Subscribe to progress entries emitted while a promote run is active.
   * Returns an unsubscribe function. Multiple subscribers are supported.
   */
  onProgress: (handler: (entry: PromoteProgressEntry) => void) => () => void;
}
