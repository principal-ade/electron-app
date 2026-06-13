/**
 * gh CLI token fallback
 *
 * When the in-app, WorkOS-backed GitHub token is unavailable (no valid WorkOS
 * session), GitHub-API destinations can still authenticate with the user's gh
 * CLI token. This shells `gh auth token` and returns it, or null when gh is
 * missing/unauthenticated.
 *
 * IMPORTANT: only valid for api.github.com / git-over-HTTPS callers. The
 * Principal backend (web-ade, git-sync, presence) validates the WorkOS-backed
 * token and will NOT accept a gh CLI token — those callers must not use this.
 */
import { electronCLI } from '../../electron-cli-bridge';

let warnedUnavailable = false;

export async function getGhCliToken(): Promise<string | null> {
  try {
    await electronCLI.initialize();

    const result = await electronCLI.execute('gh', ['auth', 'token'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      },
    });

    const token = result.stdout.trim();
    if (result.success && token) {
      console.log('[GitHub] Using gh CLI token fallback (no WorkOS session)');
      return token;
    }
    return null;
  } catch (error) {
    // gh not installed / not on PATH — log once, then stay quiet.
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn(
        '[GitHub] gh CLI token fallback unavailable:',
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}
