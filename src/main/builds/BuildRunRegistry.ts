/**
 * Build run registry (topic-1793592184227, P0 item 6).
 *
 * Tracks terminal-backed build runs: wrapper construction, OSC/exit
 * capture, timeout, and cleanup. Run records are in-memory (v1) — an app
 * restart drops run history while the terminal tab itself may survive.
 */

import type {
  ProgramStatusEvent,
  ProgramStatusRecord,
} from '../../shared/terminal/programStatus';
import type {
  BuildRunRecord,
  BuildRunStatus,
} from '../../shared/build-configurations/types';
import { DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS } from '../../shared/types/userPreferences.types';
import {
  MAX_BUILD_OUTPUT_BYTES,
  sanitizeBuildOutput,
  tailBuildOutput,
} from './buildRunOutput';

/** Minimal session-manager surface the registry needs. */
export interface RunSessionBackend {
  onSessionExit(
    listener: (event: { sessionId: string; exitCode?: number }) => void,
  ): () => void;
  /**
   * Subscribe to OSC 7501 record changes. Optional so older backends and
   * fakes keep working; without it completion falls back to the session
   * exit event, which never fires for a build typed into a live shell.
   */
  onProgramStatus?(listener: (event: ProgramStatusEvent) => void): () => void;
  getProgramStatus(sessionId: string): ProgramStatusRecord[];
  hasSession(sessionId: string): boolean;
  getScrollbackBuffer?(sessionId: string): Promise<string | null>;
  destroySession(sessionId: string): Promise<void>;
}

export interface TrackRunInput {
  runId: string;
  configId: string;
  terminalSessionId: string;
  timeoutMs: number;
  cleanupDelayMs?: number;
  /** Names only: values are resolved afresh when output is redacted. */
  secretEnvNames?: string[];
}

export type BuildRunOutputSanitizer = (input: {
  run: BuildRunRecord;
  secretEnvNames: string[];
  rawOutput: string;
}) => Promise<string | null>;

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
 * OSC 7501. The record carries the run id so a reused session's earlier
 * `done` record cannot finalize a later run. The title carries `exit=N`
 * base64-encoded: the OSC parser rejects non-base64 titles, so the literal
 * `title=exit=0` form would decode to garbage while the record itself still
 * lands.
 */
export function buildRunCommand(line: string, runId: string): string {
  return `{ ${line}; } ; ec=$?; __ps_title=$(printf 'exit=%d' "$ec" | base64 | tr -d '\\n'); __ps_state=$([ "$ec" -eq 0 ] && printf done || printf error); printf '\\033]7501;state=%s:app=principal-build:id=${runId}:title=%s\\033\\\\' "$__ps_state" "$__ps_title"`;
}

/** Exit code a build record's decoded `exit=N` title carries, if any. */
function exitCodeFromTitle(title: string | undefined): number | undefined {
  const match = /^exit=(-?\d+)$/.exec(title ?? '');
  return match ? Number(match[1]) : undefined;
}

export class BuildRunRegistry {
  private readonly runs = new Map<string, BuildRunRecord>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();
  private readonly disposers = new Map<string, Array<() => void>>();
  private readonly secretEnvNames = new Map<string, string[]>();
  private readonly outputSnapshots = new Map<string, string | null>();

  constructor(
    private readonly backend: RunSessionBackend,
    private readonly maxRuns: number = MAX_RUNS,
    private readonly sanitizeOutput?: BuildRunOutputSanitizer,
  ) {}

  getRun(runId: string): BuildRunRecord | null {
    return this.runs.get(runId) ?? null;
  }

  /** Read the terminal snapshot associated with a tracked run. */
  async getOutputBuffer(runId: string): Promise<string | null> {
    const run = this.getRun(runId);
    if (!run || !this.backend.getScrollbackBuffer) return null;
    return this.backend.getScrollbackBuffer(run.terminalSessionId);
  }

  /** `undefined` while running; null if the completed output was unsafe/unavailable. */
  getOutputSnapshot(runId: string): string | null | undefined {
    return this.outputSnapshots.get(runId);
  }

  getSecretEnvNames(runId: string): string[] | null {
    if (!this.runs.has(runId)) return null;
    return [...(this.secretEnvNames.get(runId) ?? [])];
  }

  /** Stop a running build, retain its sanitized output, then close its PTY. */
  async stopRun(runId: string): Promise<BuildRunRecord | null> {
    const record = this.getRun(runId);
    if (!record) return null;
    if (record.status !== 'running') return record;

    record.status = 'cancelled';
    record.endedAt = new Date().toISOString();
    this.stopWatching(runId);
    await this.captureOutput(record);
    await this.destroySession(record.terminalSessionId);
    return record;
  }

  /**
   * Start tracking a run for an already-spawned terminal session running
   * the wrapper from `buildRunCommand`. Completion normally arrives as the
   * wrapper's OSC 7501 report, tagged with this run's id — build commands
   * are typed into a persistent shell, so the session itself rarely exits.
   * The session exit event and `timeoutMs` remain fallbacks.
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
    this.secretEnvNames.set(record.runId, [...(input.secretEnvNames ?? [])]);
    this.evictFinished();

    const finish = (status: BuildRunStatus, exitCode?: number) => {
      if (record.status !== 'running') return;
      record.status = status;
      if (exitCode !== undefined) record.exitCode = exitCode;
      record.endedAt = new Date().toISOString();
      this.stopWatching(record.runId);
      const snapshot = this.captureOutput(record);
      this.scheduleCleanup(
        record,
        input.cleanupDelayMs ?? DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS,
        snapshot,
      );
    };

    const applyRecords = (records: ProgramStatusRecord[]) => {
      const report = this.findRunReport(records, record.runId);
      if (!report) return;
      finish(
        report.state === 'done' ? 'succeeded' : 'failed',
        exitCodeFromTitle(report.title),
      );
    };

    if (this.backend.onProgramStatus) {
      this.addDisposer(
        record.runId,
        this.backend.onProgramStatus((event) => {
          if (event.sessionId !== record.terminalSessionId) return;
          applyRecords(event.records);
        }),
      );
    }
    // The report may have landed between session creation and this call.
    applyRecords(this.backend.getProgramStatus(record.terminalSessionId));

    this.addDisposer(
      record.runId,
      this.backend.onSessionExit((event) => {
        if (event.sessionId !== record.terminalSessionId) return;
        const report = this.findRunReport(
          this.backend.getProgramStatus(record.terminalSessionId),
          record.runId,
        );
        if (report) {
          finish(
            report.state === 'done' ? 'succeeded' : 'failed',
            event.exitCode ?? exitCodeFromTitle(report.title),
          );
        } else {
          finish(event.exitCode === 0 ? 'succeeded' : 'failed', event.exitCode);
        }
      }),
    );

    if (record.status === 'running') {
      const timer = setTimeout(() => {
        if (record.status !== 'running') return;
        record.status = 'timed-out';
        record.endedAt = new Date().toISOString();
        this.stopWatching(record.runId);
        void this.captureOutput(record).finally(() =>
          this.destroySession(record.terminalSessionId),
        );
      }, input.timeoutMs);
      // A stuck build must not hold the app open on quit.
      if (typeof timer.unref === 'function') timer.unref();
      this.timers.set(record.runId, timer);
    }

    return record;
  }

  /**
   * This run's terminal report. Matching on the id is what makes a reused
   * session safe: the previous run's `done` record is still in the store.
   */
  private findRunReport(
    records: ProgramStatusRecord[],
    runId: string,
  ): ProgramStatusRecord | null {
    for (let i = records.length - 1; i >= 0; i--) {
      const candidate = records[i];
      if (candidate.app === BUILD_RUN_OSC_APP && candidate.id === runId) {
        return candidate;
      }
    }
    return null;
  }

  private addDisposer(runId: string, dispose: () => void): void {
    const existing = this.disposers.get(runId);
    if (existing) existing.push(dispose);
    else this.disposers.set(runId, [dispose]);
  }

  private stopWatching(runId: string): void {
    const timer = this.timers.get(runId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(runId);
    }
    for (const dispose of this.disposers.get(runId) ?? []) dispose();
    this.disposers.delete(runId);
  }

  private async captureOutput(record: BuildRunRecord): Promise<void> {
    if (!this.backend.getScrollbackBuffer) {
      this.outputSnapshots.set(record.runId, null);
      return;
    }
    try {
      const rawOutput = await this.backend.getScrollbackBuffer(
        record.terminalSessionId,
      );
      if (rawOutput === null) {
        this.outputSnapshots.set(record.runId, null);
        return;
      }
      const secretEnvNames = this.secretEnvNames.get(record.runId) ?? [];
      const safeOutput = this.sanitizeOutput
        ? await this.sanitizeOutput({
            run: record,
            secretEnvNames: [...secretEnvNames],
            rawOutput,
          })
        : secretEnvNames.length === 0
          ? sanitizeBuildOutput(rawOutput)
          : null;
      this.outputSnapshots.set(
        record.runId,
        safeOutput === null
          ? null
          : tailBuildOutput(safeOutput, MAX_BUILD_OUTPUT_BYTES).output,
      );
    } catch (error) {
      console.warn(
        '[BuildRunRegistry] Failed to snapshot build output:',
        error,
      );
      this.outputSnapshots.set(record.runId, null);
    }
  }

  private scheduleCleanup(
    record: BuildRunRecord,
    requestedDelayMs: number,
    snapshot: Promise<void>,
  ): void {
    const delayMs =
      Number.isFinite(requestedDelayMs) && requestedDelayMs >= 0
        ? Math.min(requestedDelayMs, 24 * 60 * 60 * 1000)
        : DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS;
    const timer = setTimeout(() => {
      this.cleanupTimers.delete(record.runId);
      void snapshot.finally(() =>
        this.destroySession(record.terminalSessionId),
      );
    }, delayMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.cleanupTimers.set(record.runId, timer);
  }

  private async destroySession(sessionId: string): Promise<void> {
    try {
      await this.backend.destroySession(sessionId);
    } catch (error) {
      console.warn(
        '[BuildRunRegistry] Failed to clean up build terminal:',
        error,
      );
    }
  }

  private evictFinished(): void {
    while (this.runs.size > this.maxRuns) {
      const oldest = this.runs.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      if (this.runs.get(oldest)?.status === 'running') return;
      this.runs.delete(oldest);
      this.secretEnvNames.delete(oldest);
      this.outputSnapshots.delete(oldest);
    }
  }
}
