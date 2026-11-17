/**
 * Express routes for the managed-process registry, mounted on the Principal
 * MCP Bridge so an agent (briefed terminal, CLI, skill) can start / stop /
 * restart processes in the running app.
 *
 * The bridge is local and unauthenticated, so agent-started commands are
 * deliberately constrained:
 * - `cwd` must be inside a registered Alexandria repository, and
 * - the command binary must be on {@link AGENT_COMMAND_ALLOWLIST}.
 *
 * UI-started processes (ipcMain) are not subject to these routes; only the
 * HTTP surface is locked down.
 */

import path from 'path';
import type { Application, Request, Response } from 'express';
import type { ProcessRegistry } from './ProcessRegistry';
import {
  parseProcessConnection,
  ProcessConnection,
  ProcessControlResult,
  ProcessEntry,
  ProcessKind,
} from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import type { RunningServer } from '../../shared/main-process-api-interfaces/LocalhostDetectionAPI';
import { AGENT_COMMAND_ALLOWLIST } from '../../shared/build-configurations/types';
import { COMMON_DEV_PORTS, detectRunningServers } from './detectServers';

const PROCESS_KINDS: ProcessKind[] = [
  'dev-server',
  'watcher',
  'task',
  'agent',
  'script',
];

function isAllowedCommand(command: string): boolean {
  return AGENT_COMMAND_ALLOWLIST.has(path.basename(command));
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

const ACTIVE_MANAGED_STATUSES = new Set([
  'starting',
  'running',
  'restarting',
  'stopping',
]);

function parsePortsQuery(value: unknown): number[] | undefined {
  if (value == null) return undefined;
  const raw = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => String(entry).split(','))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (raw.length === 0) return undefined;
  if (raw.length > 100) throw new Error('too many ports (max 100)');
  const ports = raw.map((part) => Number.parseInt(part, 10));
  if (
    ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)
  ) {
    throw new Error('ports must be integers 1-65535');
  }
  return [...new Set(ports)];
}

function parseTimeoutQuery(value: unknown): number | undefined {
  if (value == null) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const timeout = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 10000) {
    throw new Error('timeout must be an integer 100-10000 ms');
  }
  return timeout;
}

export function registerProcessRoutes(
  app: Application,
  registry: ProcessRegistry,
): void {
  // List managed processes started by the app or an agent.
  app.get('/api/processes', (_req: Request, res: Response) => {
    res.json({ success: true, processes: registry.list() });
  });

  // List externally detected localhost servers (not started by the app),
  // merged the same way the Processes panel merges them: entries the app
  // already manages (matched by pid or port) are dropped.
  app.get('/api/processes/detected', async (req: Request, res: Response) => {
    let ports: number[] | undefined;
    let timeout: number | undefined;
    try {
      ports = parsePortsQuery(req.query.ports);
      timeout = parseTimeoutQuery(req.query.timeout);
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'invalid query',
      });
      return;
    }

    let scan;
    try {
      scan = await detectRunningServers({
        ports: ports ?? COMMON_DEV_PORTS,
        timeout,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'scan failed',
      });
      return;
    }

    const managed = registry.list();
    const active = managed.filter((m) => ACTIVE_MANAGED_STATUSES.has(m.status));
    const managedPids = new Set(
      active
        .map((m) => m.pid)
        .filter((pid): pid is number => typeof pid === 'number'),
    );
    const managedPorts = new Set(
      active
        .map((m) => m.port)
        .filter((port): port is number => typeof port === 'number'),
    );

    // Port-scoped overrides win over pid-scoped ones so two services sharing a
    // PID can be named and opened differently.
    const detectedLabel = (s: RunningServer): string | undefined =>
      registry.getDetectedLabelForServer?.(s.pid, s.port) ??
      registry.getDetectedLabel(`detected:${s.pid ?? s.port}`);
    const detectedConnection = (
      s: RunningServer,
    ): ProcessConnection | undefined =>
      registry.getDetectedConnectionForServer?.(s.pid, s.port);

    const servers: RunningServer[] = scan.servers
      .filter((s) => {
        if (s.pid != null && managedPids.has(s.pid)) return false;
        if (s.port != null && managedPorts.has(s.port)) return false;
        return true;
      })
      .map((s) => ({
        ...s,
        displayName: detectedLabel(s) ?? s.displayName,
        connection: detectedConnection(s),
      }));

    const processes: ProcessEntry[] = await Promise.all(
      servers.map(async (s) => ({
        id: `detected:${s.pid ?? s.port}`,
        label:
          s.displayName?.trim() ||
          (s.command?.trim()
            ? `${s.command.trim()} :${s.port}`
            : `localhost:${s.port}`),
        command: s.command || '',
        cwd: s.cwd || '',
        repo: s.cwd ? await registry.resolveRepo(s.cwd) : undefined,
        kind: 'dev-server' as const,
        status: 'running' as const,
        origin: 'detected' as const,
        pid: s.pid,
        port: s.port,
        connection: s.connection,
        source: 'external',
        startedAt: Date.now(),
      })),
    );

    res.json({
      success: true,
      processes,
      servers,
      scannedPorts: scan.scannedPorts,
      scanDuration: scan.scanDuration,
    });
  });

  // Captured stdout/stderr for a process — diagnostics when it exits fast.
  app.get('/api/processes/:id/logs', (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!registry.get(id)) {
      res.status(404).json({ success: false, error: 'unknown process id' });
      return;
    }
    res.json({ success: true, id, logs: registry.getLogs(id).join('') });
  });

  // Start a managed process.
  app.post('/api/processes', async (req: Request, res: Response) => {
    const body = asObject(req.body);
    const command =
      body && typeof body.command === 'string' ? body.command.trim() : '';
    const cwd = body && typeof body.cwd === 'string' ? body.cwd.trim() : '';
    const args =
      body && Array.isArray(body.args)
        ? body.args.map((a) => String(a))
        : undefined;
    const label =
      body && typeof body.label === 'string' ? body.label.trim() : undefined;
    const kind =
      body &&
      typeof body.kind === 'string' &&
      PROCESS_KINDS.includes(body.kind as ProcessKind)
        ? (body.kind as ProcessKind)
        : undefined;
    const env =
      body && body.env && typeof body.env === 'object'
        ? Object.fromEntries(
            Object.entries(body.env as Record<string, unknown>).map(
              ([k, v]) => [k, String(v)],
            ),
          )
        : undefined;
    const connection =
      body && Object.prototype.hasOwnProperty.call(body, 'connection')
        ? parseProcessConnection(body.connection)
        : undefined;

    if (
      body &&
      Object.prototype.hasOwnProperty.call(body, 'connection') &&
      !connection
    ) {
      res.status(400).json({
        success: false,
        error: 'body.connection is not a valid process connection',
      });
      return;
    }

    if (!command) {
      res
        .status(400)
        .json({ success: false, error: 'body.command is required' });
      return;
    }
    if (!cwd || !path.isAbsolute(cwd)) {
      res
        .status(400)
        .json({ success: false, error: 'body.cwd must be an absolute path' });
      return;
    }
    if (!isAllowedCommand(command)) {
      res.status(400).json({
        success: false,
        error: `command "${path.basename(command)}" is not on the agent allowlist`,
      });
      return;
    }

    // cwd must live inside a registered repository.
    const repo = await registry.resolveRepo(cwd);
    if (!repo) {
      res.status(400).json({
        success: false,
        error: `body.cwd is not inside a registered repository: ${cwd}`,
      });
      return;
    }

    const result = await registry.start(
      { command, args, cwd, env, label, kind, connection },
      'agent',
    );
    res.status(result.success ? 201 : 400).json({
      success: result.success,
      process: result.process,
      error: result.error,
    });
  });

  // Update a process's display name and/or its open-action metadata.
  app.patch('/api/processes/:id', (req: Request, res: Response) => {
    const body = asObject(req.body);
    const label = body?.label;
    const hasLabel = label !== undefined;
    const hasConnection =
      body !== null &&
      Object.prototype.hasOwnProperty.call(body, 'connection');
    const rawConnection =
      hasConnection && body ? body.connection : undefined;
    const parsedConnection =
      hasConnection && rawConnection !== null
        ? parseProcessConnection(rawConnection)
        : undefined;

    if (
      (hasLabel &&
        (typeof label !== 'string' || label.trim().length === 0)) ||
      (!hasLabel && !hasConnection)
    ) {
      res.status(400).json({
        success: false,
        error:
          'body.label must be a non-empty string, or body.connection must be provided',
      });
      return;
    }
    if (hasConnection && rawConnection !== null && !parsedConnection) {
      res.status(400).json({
        success: false,
        error: 'body.connection is not a valid process connection',
      });
      return;
    }

    const id = String(req.params.id);
    let result: ProcessControlResult = { success: true };
    if (hasLabel) result = registry.setLabel(id, label as string);
    if (result.success && hasConnection) {
      result = registry.setConnection(id, parsedConnection ?? undefined);
    }
    const status = result.success
      ? 200
      : result.error === 'unknown managed process id'
        ? 404
        : 500;
    res.status(status).json(result);
  });

  // Stop (kill) a running process.
  app.post('/api/processes/:id/stop', async (req: Request, res: Response) => {
    const result = await registry.stop(String(req.params.id));
    res.status(result.success ? 200 : 404).json(result);
  });

  // Restart a process (re-run its command).
  app.post(
    '/api/processes/:id/restart',
    async (req: Request, res: Response) => {
      const result = await registry.restart(String(req.params.id));
      res.status(result.success ? 200 : 404).json({
        success: result.success,
        process: result.process,
        error: result.error,
      });
    },
  );

  // Remove an entry from the list (only when not running).
  app.delete('/api/processes/:id', async (req: Request, res: Response) => {
    const result = await registry.remove(String(req.params.id));
    res.status(result.success ? 200 : 404).json(result);
  });
}
