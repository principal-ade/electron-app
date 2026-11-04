/**
 * Build run registry (topic-1793592184227, P0 item 6).
 *
 * Tracks terminal-backed build runs: wrapper construction, OSC/exit
 * capture, timeout, and cleanup. Run records are in-memory (v1) — an app
 * restart drops run history while the terminal tab itself may survive.
 */

import type { ProgramStatusRecord } from '../../shared/terminal/programStatus';
import type {
  BuildRunRecord,
  BuildRunStatus,
} from '../../shared/build-configurations/types';

/** Minimal session-manager surface the registry needs. */
export interface RunSessionBackend {
  onSessionExit(
    listener: (event: { sessionId: string; exitCode?: number }) => void,
  ): () => void;
  getProgramStatus(sessionId: string): ProgramStatusRecord[];
  hasSession(sessionId: string): boolean;
  destroySession(sessionId: string): Promise<void>;
}

export interface TrackRunInput {
  runId: string;
  configId: string;
  terminalSessionId: string;
  timeoutMs: number;
}

/** OSC 7501 app tag the run wrapper reports under. */
export const BUILD_RUN_OSC_APP = 'principal-build';

const MAX_RUNS = 200;

export function generateRunId(): string {
  return `run-${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0')}`;
}

/**
 * Wrap the config's command so the tab itself reports completion via
 * OSC 7501. The title carries `exit=N` base64-encoded: the OSC parser
 * rejects non-base64 titles, so the literal `title=exit=0` form would
 * decode to garbage while the record itself still lands.
 */
export function buildRunCommand(line: string): string {
  return `{ ${line}; } ; ec=$?; __ps_title=$(printf 'exit=%d' "$ec" | base64 | tr -d '\\n'); __ps_state=$([ "$ec" -eq 0 ] && printf done || printf error); printf '\\033]7501;state=%s:app=principal-build:title=%s\\033\\\\' "$__ps_state" "$__ps_title"`;
}

export class BuildRunRegistry {
  private readonly runs = new Map<string, BuildRunRecord>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly unsubscribes = new Map<string, () => void>();

  constructor(
    private readonly backend: RunSessionBackend,
    private readonly maxRuns: number = MAX_RUNS,
  ) {}

  getRun(runId: string): BuildRunRecord | null {
    return this.runs.get(runId) ?? null;
  }

  /**
   * Start tracking a run for an already-spawned terminal session running
   * the wrapper from `buildRunCommand`. Completion arrives via the session
   * exit event; the OSC record decides success vs failure, the exit event
   * supplies the code. A run that outlives `timeoutMs` is marked timed-out
   * and its session destroyed.
   */
  trackRun(input: TrackRunInput): BuildRunRecord {
    const record: BuildRunRecord = {
      runId: input.runId,
      configId: input.configId,
      terminalSessionId: input.terminalSessionId,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    this.runs.set(record.runId, record);
    this.evictFinished();

    const finish = (status: BuildRunStatus, exitCode?: number) => {
      if (record.status !== 'running') return;
      record.status = status;
      if (exitCode !== undefined) record.exitCode = exitCode;
      record.endedAt = new Date().toISOString();
      this.stopWatching(record.runId);
    };

    this.unsubscribes.set(
      record.runId,
      this.backend.onSessionExit((event) => {
        if (event.sessionId !== record.terminalSessionId) return;
        const report = this.buildReport(record.terminalSessionId);
        if (report) {
          finish(
            report.state === 'done' ? 'succeeded' : 'failed',
            event.exitCode,
          );
        } else {
          finish(event.exitCode === 0 ? 'succeeded' : 'failed', event.exitCode);
        }
      }),
    );

    const timer = setTimeout(() => {
      if (record.status !== 'running') return;
      record.status = 'timed-out';
      record.endedAt = new Date().toISOString();
      this.stopWatching(record.runId);
      this.backend.destroySession(record.terminalSessionId).catch(() => {});
    }, input.timeoutMs);
    // A stuck build must not hold the app open on quit.
    if (typeof timer.unref === 'function') timer.unref();
    this.timers.set(record.runId, timer);

    return record;
  }

  /** Latest principal-build OSC record for the session, if any. */
  private buildReport(sessionId: string): ProgramStatusRecord | null {
    const records = this.backend.getProgramStatus(sessionId);
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].app === BUILD_RUN_OSC_APP) return records[i];
    }
    return null;
  }

  private stopWatching(runId: string): void {
    const timer = this.timers.get(runId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(runId);
    }
    this.unsubscribes.get(runId)?.();
    this.unsubscribes.delete(runId);
  }

  private evictFinished(): void {
    while (this.runs.size > this.maxRuns) {
      const oldest = this.runs.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      if (this.runs.get(oldest)?.status === 'running') return;
      this.runs.delete(oldest);
    }
  }
}
