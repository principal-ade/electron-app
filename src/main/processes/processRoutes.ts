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
import { ProcessKind } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

/**
 * Binaries an agent may start. Narrow on purpose — this is the difference
 * between "run my dev server" and "run anything". Widen as needed.
 */
const AGENT_COMMAND_ALLOWLIST = new Set([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'npx',
  'node',
  'deno',
  'tsx',
  'tsc',
  'vite',
  'next',
  'astro',
  'nuxt',
  'storybook',
  'http-server',
  'vitest',
  'jest',
  'python',
  'python3',
  'uv',
  'go',
  'cargo',
  'make',
  'ruby',
  'bundle',
  'php',
  'composer',
  'dotnet',
  'docker',
]);

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

export function registerProcessRoutes(
  app: Application,
  registry: ProcessRegistry,
): void {
  // List managed + detected processes.
  app.get('/api/processes', (_req: Request, res: Response) => {
    res.json({ success: true, processes: registry.list() });
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
      body && Array.isArray(body.args) ? body.args.map((a) => String(a)) : undefined;
    const label =
      body && typeof body.label === 'string' ? body.label.trim() : undefined;
    const kind =
      body && typeof body.kind === 'string' && PROCESS_KINDS.includes(body.kind as ProcessKind)
        ? (body.kind as ProcessKind)
        : undefined;
    const env =
      body && body.env && typeof body.env === 'object'
        ? Object.fromEntries(
            Object.entries(body.env as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v),
            ]),
          )
        : undefined;

    if (!command) {
      res.status(400).json({ success: false, error: 'body.command is required' });
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
      { command, args, cwd, env, label, kind },
      'agent',
    );
    res
      .status(result.success ? 201 : 400)
      .json({ success: result.success, process: result.process, error: result.error });
  });

  // Stop (kill) a running process.
  app.post('/api/processes/:id/stop', async (req: Request, res: Response) => {
    const result = await registry.stop(String(req.params.id));
    res.status(result.success ? 200 : 404).json(result);
  });

  // Restart a process (re-run its command).
  app.post('/api/processes/:id/restart', async (req: Request, res: Response) => {
    const result = await registry.restart(String(req.params.id));
    res
      .status(result.success ? 200 : 404)
      .json({ success: result.success, process: result.process, error: result.error });
  });

  // Remove an entry from the list (only when not running).
  app.delete('/api/processes/:id', async (req: Request, res: Response) => {
    const result = await registry.remove(String(req.params.id));
    res.status(result.success ? 200 : 404).json(result);
  });
}
