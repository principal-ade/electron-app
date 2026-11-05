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
  private readonly disposers = new Map<string, Array<() => void>>();

  constructor(
    private readonly backend: RunSessionBackend,
    private readonly maxRuns: number = MAX_RUNS,
  ) {}

  getRun(runId: string): BuildRunRecord | null {
    return this.runs.get(runId) ?? null;
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
    this.evictFinished();

    const finish = (status: BuildRunStatus, exitCode?: number) => {
      if (record.status !== 'running') return;
      record.status = status;
      if (exitCode !== undefined) record.exitCode = exitCode;
      record.endedAt = new Date().toISOString();
      this.stopWatching(record.runId);
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

  private evictFinished(): void {
    while (this.runs.size > this.maxRuns) {
      const oldest = this.runs.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      if (this.runs.get(oldest)?.status === 'running') return;
      this.runs.delete(oldest);
    }
  }
}
