/**
 * ProcessRegistry
 *
 * The main-process source of truth for managed processes: long-lived commands
 * the app (or an agent, via the Principal MCP bridge) starts, plus the ability
 * to stop / restart / remove them. Ownership lives here (not in the renderer),
 * so a process keeps running while its panel/tab is closed.
 *
 * Identity is a durable uuid minted here. The OS pid is diagnostic only.
 *
 * The renderer is kept in sync via a `processes:changed` broadcast on every
 * mutation (see {@link ProcessRegistryEvents.CHANGED}).
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { applicationWindows } from '../window/modernWindowManager';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { terminalEnvironment } from '../terminalEnvironment';
import { repoPurlFromEntry } from '../../shared/topics/repoPurl';
import {
  ProcessEntry,
  ProcessKind,
  ProcessRepo,
  ProcessRegistryEvents,
  ProcessStartRequest,
  ProcessStartResult,
  ProcessControlResult,
} from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

/** How long to wait after SIGTERM before escalating to SIGKILL. */
const KILL_ESCALATION_MS = 5000;
/** Max captured output chunks per process (ring buffer). */
const MAX_LOG_CHUNKS = 500;

/** Is `child` the same as, or inside, `parent`? (both absolute) */
function pathInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Best-effort port extraction from process output (e.g. "http://localhost:5173/"). */
function extractPort(text: string): number | undefined {
  const match =
    text.match(/(?:localhost|127\.0\.0\.1)[:/](\d{2,5})/) ??
    text.match(/https?:\/\/[^\s/:]+:(\d{2,5})/);
  if (!match) return undefined;
  const port = Number.parseInt(match[1], 10);
  return Number.isFinite(port) ? port : undefined;
}

/** Best-effort guess of the process kind from the command + args. */
function inferKind(command: string, args: string[]): ProcessKind {
  const bin = path.basename(command);
  const scriptRunners = ['npm', 'pnpm', 'yarn', 'bun'];
  const script = args[1] ?? '';

  if (bin === 'tsc' || args.includes('--watch')) return 'watcher';
  if (scriptRunners.includes(bin) && (args[0] === 'run' || args[0] === 'start')) {
    if (/storybook|dev|serve|start|preview/i.test(script)) return 'dev-server';
  }
  if (['vite', 'next', 'http-server', 'storybook', 'astro', 'nuxt'].includes(bin)) {
    return 'dev-server';
  }
  return 'script';
}

export class ProcessRegistry extends EventEmitter {
  private entries = new Map<string, ProcessEntry>();
  private children = new Map<string, ChildProcess>();
  /** The original start request per id, so restart can re-run it. */
  private descriptors = new Map<string, ProcessStartRequest>();
  /** Captured stdout/stderr chunks per id (kept for a future logs view). */
  private logs = new Map<string, string[]>();
  /** Resolved spawn environment per id (full user PATH), reused on restart. */
  private envs = new Map<string, NodeJS.ProcessEnv>();

  /** Snapshot of all entries. */
  list(): ProcessEntry[] {
    return Array.from(this.entries.values()).map((entry) => ({ ...entry }));
  }

  get(id: string): ProcessEntry | undefined {
    const entry = this.entries.get(id);
    return entry ? { ...entry } : undefined;
  }

  /** Captured output for a process (unused by the panel today). */
  getLogs(id: string): string[] {
    return [...(this.logs.get(id) ?? [])];
  }

  /**
   * Resolve a working directory to a registered repository (most specific
   * match wins). Returns undefined when the cwd isn't inside any repo.
   */
  async resolveRepo(cwd: string): Promise<ProcessRepo | undefined> {
    if (!cwd) return undefined;
    let repos: AlexandriaEntry[] = [];
    try {
      repos = await AlexandriaRegistryService.getInstance().getRepositories();
    } catch {
      return undefined;
    }
    let best: { path: string; entry: AlexandriaEntry } | null = null;
    for (const entry of repos) {
      const repoPath = String(entry.path);
      if (pathInside(cwd, repoPath)) {
        if (!best || repoPath.length > best.path.length) {
          best = { path: repoPath, entry };
        }
      }
    }
    if (!best) return undefined;
    const { entry } = best;
    const owner = entry.github?.owner;
    return {
      name: entry.name,
      owner,
      // Deterministic GitHub avatar URL — no API call / auth needed.
      avatarUrl: owner ? `https://github.com/${owner}.png` : undefined,
      purl: repoPurlFromEntry(entry) ?? undefined,
    };
  }

  /**
   * Start a managed process. Policy (allowlist / cwd constraints) is enforced
   * by callers; this method only validates that the cwd exists.
   */
  async start(
    request: ProcessStartRequest,
    source = 'user',
  ): Promise<ProcessStartResult> {
    if (!request.command || !request.command.trim()) {
      return { success: false, error: 'command is required' };
    }
    if (!request.cwd || !path.isAbsolute(request.cwd)) {
      return { success: false, error: 'cwd must be an absolute path' };
    }
    if (!fs.existsSync(request.cwd)) {
      return { success: false, error: `cwd does not exist: ${request.cwd}` };
    }

    const id = uuidv4();
    const args = request.args ?? [];

    // Resolve the user's full login-shell environment. A GUI-launched Electron
    // main has a minimal PATH that often can't find npm/bun/etc., so spawned
    // commands would fail with ENOENT or missing-tool errors.
    let env: NodeJS.ProcessEnv = { ...process.env, ...request.env };
    try {
      env = {
        ...(await terminalEnvironment.getTerminalEnvironment(request.cwd)),
        ...(request.env ?? {}),
      };
    } catch {
      /* fall back to the inherited env */
    }

    const entry: ProcessEntry = {
      id,
      label: request.label?.trim() || path.basename(request.command),
      command: [request.command, ...args].join(' '),
      cwd: request.cwd,
      repo: await this.resolveRepo(request.cwd),
      kind: request.kind ?? inferKind(request.command, args),
      status: 'starting',
      origin: 'managed',
      source,
      startedAt: Date.now(),
      runCount: 1,
    };

    const descriptor: ProcessStartRequest = { ...request, args };
    this.entries.set(id, entry);
    this.descriptors.set(id, descriptor);
    this.logs.set(id, []);
    this.envs.set(id, env);
    this.emitChanged();

    this.spawnManaged(id, descriptor);
    return { success: true, process: this.get(id) };
  }

  private spawnManaged(id: string, request: ProcessStartRequest): void {
    let child: ChildProcess;
    try {
      child = spawn(request.command, request.args ?? [], {
        cwd: request.cwd,
        env: this.envs.get(id) ?? { ...process.env, ...request.env },
        stdio: 'pipe',
        shell: false,
        // Own process group so stop/restart can signal the whole tree, not just
        // the direct child (e.g. `bun run dev` → vite/node grandchild).
        detached: true,
      });
    } catch (err) {
      const entry = this.entries.get(id);
      if (entry) {
        entry.status = 'failed';
        entry.endedAt = Date.now();
        entry.lastError = err instanceof Error ? err.message : String(err);
        this.emitChanged();
      }
      return;
    }

    this.children.set(id, child);

    child.on('spawn', () => {
      const entry = this.entries.get(id);
      if (entry) {
        entry.status = 'running';
        entry.pid = child.pid ?? undefined;
        this.emitChanged();
      }
    });

    child.on('error', (err) => {
      const entry = this.entries.get(id);
      if (entry) {
        entry.status = 'failed';
        entry.endedAt = Date.now();
        entry.lastError = err.message;
        this.emitChanged();
      }
      this.children.delete(id);
    });

    child.on('exit', (code, signal) => {
      const entry = this.entries.get(id);
      if (entry) {
        entry.endedAt = Date.now();
        entry.exitCode = code ?? undefined;
        entry.pid = undefined;
        if (entry.status === 'stopping') {
          entry.status = 'stopped';
        } else if (signal) {
          entry.status = 'failed';
          entry.lastError = `terminated by ${signal}`;
        } else if (code === 0) {
          entry.status = 'stopped';
        } else {
          entry.status = 'failed';
        }
        if (entry.status === 'failed' && !entry.lastError) {
          entry.lastError =
            this.logTail(id) ?? `exited with code ${entry.exitCode}`;
        }
        this.emitChanged();
      }
      this.children.delete(id);
    });

    child.stdout?.on('data', (data: Buffer) => this.appendLog(id, data.toString()));
    child.stderr?.on('data', (data: Buffer) => this.appendLog(id, data.toString()));
  }

  private appendLog(id: string, chunk: string): void {
    const buf = this.logs.get(id);
    if (buf) {
      buf.push(chunk);
      if (buf.length > MAX_LOG_CHUNKS) {
        buf.splice(0, buf.length - MAX_LOG_CHUNKS);
      }
    }
    // Opportunistically learn the port from the process's own output so the
    // row can show it and the panel can dedupe against detected servers.
    const entry = this.entries.get(id);
    if (entry && entry.port == null) {
      const port = extractPort(chunk);
      if (port != null) {
        entry.port = port;
        this.emitChanged();
      }
    }
  }

  /**
   * Signal a process and its descendants. Children are spawned detached (own
   * process group), so killing the negative pid targets the whole group —
   * without this, a `bun/npm run <script>` wrapper dies but its server
   * grandchild leaks and keeps holding the port.
   */
  private killTree(child: ChildProcess, signal: NodeJS.Signals): void {
    if (child.pid != null) {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch {
        /* no group (or already gone) — fall back to the direct child */
      }
    }
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  }

  /** Last chunk of captured output, trimmed — used for failure messages. */
  private logTail(id: string, maxChars = 400): string | undefined {
    const text = (this.logs.get(id) ?? []).join('').trim();
    if (!text) return undefined;
    return text.length > maxChars ? `…${text.slice(-maxChars)}` : text;
  }

  /** Stop (kill) a running process. Escalates SIGTERM → SIGKILL. */
  async stop(id: string): Promise<ProcessControlResult> {
    const entry = this.entries.get(id);
    if (!entry) return { success: false, error: 'unknown process id' };
    const child = this.children.get(id);
    if (!child) {
      if (entry.status !== 'stopped' && entry.status !== 'failed') {
        entry.status = 'stopped';
        entry.endedAt = entry.endedAt ?? Date.now();
        this.emitChanged();
      }
      return { success: true };
    }

    entry.status = 'stopping';
    this.emitChanged();

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      child.once('exit', finish);
      this.killTree(child, 'SIGTERM');
      setTimeout(() => {
        this.killTree(child, 'SIGKILL');
        finish();
      }, KILL_ESCALATION_MS);
    });

    return { success: true };
  }

  /** Restart a process by re-running its original command (same entry id). */
  async restart(id: string): Promise<ProcessStartResult> {
    const entry = this.entries.get(id);
    const descriptor = this.descriptors.get(id);
    if (!entry || !descriptor) {
      return { success: false, error: 'unknown process id' };
    }

    await this.stop(id);

    entry.status = 'restarting';
    entry.runCount = (entry.runCount ?? 1) + 1;
    entry.startedAt = Date.now();
    entry.endedAt = undefined;
    entry.exitCode = undefined;
    entry.lastError = undefined;
    // A restarted server may bind a different port. Do not reuse the old one.
    entry.port = undefined;
    entry.fromHistory = false;
    this.emitChanged();

    this.spawnManaged(id, descriptor);
    return { success: true, process: this.get(id) };
  }

  /** Remove an entry from the list. Refuses while it's still running. */
  async remove(id: string): Promise<ProcessControlResult> {
    if (this.children.has(id)) {
      return { success: false, error: 'process is still running' };
    }
    const existed = this.entries.delete(id);
    this.descriptors.delete(id);
    this.logs.delete(id);
    this.envs.delete(id);
    if (existed) this.emitChanged();
    return existed
      ? { success: true }
      : { success: false, error: 'unknown process id' };
  }

  private emitChanged(): void {
    const processes = this.list();
    this.emit('changed', processes);
    const windows = Array.from(applicationWindows.values());
    for (const { window } of windows) {
      if (window && !window.isDestroyed()) {
        window.webContents.send(ProcessRegistryEvents.CHANGED, processes);
      }
    }
  }
}

// Singleton instance
let processRegistry: ProcessRegistry | null = null;

export function getProcessRegistry(): ProcessRegistry {
  if (!processRegistry) {
    processRegistry = new ProcessRegistry();
  }
  return processRegistry;
}
