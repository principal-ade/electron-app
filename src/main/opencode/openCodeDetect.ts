import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface OpenCodeDetectResult {
  installed: boolean;
  path?: string;
  version?: string;
  authed: boolean;
  providers?: string[];
  error?: string;
}

const CANDIDATE_PATHS = (): string[] => {
  const home = os.homedir();
  return [
    path.join(home, '.local', 'bin', 'opencode'),
    '/opt/homebrew/bin/opencode',
    '/usr/local/bin/opencode',
    path.join(home, '.npm-global', 'bin', 'opencode'),
  ];
};

async function resolveBinaryPath(): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync('which opencode', { timeout: 3000 });
    const trimmed = stdout.trim();
    if (trimmed) return trimmed;
  } catch {
    // fall through to candidates
  }
  for (const candidate of CANDIDATE_PATHS()) {
    try {
      await fs.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return undefined;
}

async function readVersion(binPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`"${binPath}" --version`, {
      timeout: 5000,
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

// Read auth state directly from opencode's credentials file rather than
// parsing the `opencode auth list` CLI output, which has changed format
// across versions (tree-drawing chars in older versions, plain rows in
// newer ones). The credentials file is the same source opencode itself
// reads at runtime, so this matches what the user sees in the terminal.
function authFileCandidates(): string[] {
  const home = os.homedir();
  // XDG_DATA_HOME wins when set; otherwise the OS-default location.
  // Platform fallbacks aren't exhaustive — we add them as we hit cases.
  const xdg = process.env.XDG_DATA_HOME;
  const candidates: string[] = [];
  if (xdg) candidates.push(path.join(xdg, 'opencode', 'auth.json'));
  candidates.push(path.join(home, '.local', 'share', 'opencode', 'auth.json'));
  if (process.platform === 'darwin') {
    candidates.push(
      path.join(
        home,
        'Library',
        'Application Support',
        'opencode',
        'auth.json',
      ),
    );
  }
  return candidates;
}

async function readAuthState(): Promise<{
  authed: boolean;
  providers: string[];
}> {
  for (const candidate of authFileCandidates()) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>);
        if (entries.length === 0) continue;
        const providers = entries.map(([id, value]) => {
          const method =
            value && typeof value === 'object' && 'type' in value
              ? String((value as { type: unknown }).type)
              : 'unknown';
          return `${id} (${method})`;
        });
        return { authed: true, providers };
      }
    } catch {
      // file missing or unparseable — try the next candidate
    }
  }
  return { authed: false, providers: [] };
}

export async function detectOpenCode(): Promise<OpenCodeDetectResult> {
  try {
    const binPath = await resolveBinaryPath();
    if (!binPath) {
      return { installed: false, authed: false };
    }
    const [version, authState] = await Promise.all([
      readVersion(binPath),
      readAuthState(),
    ]);
    return {
      installed: true,
      path: binPath,
      version,
      authed: authState.authed,
      providers: authState.providers,
    };
  } catch (err) {
    return {
      installed: false,
      authed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
