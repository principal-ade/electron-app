import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface GitAuthEnv {
  env: NodeJS.ProcessEnv;
  cleanup: () => Promise<void>;
  source: 'github-token';
}

const TOKEN_ENV_VAR = 'PRINCIPLE_GITHUB_TOKEN';

/**
 * Lazy-load authService only when needed and only in main process context
 * This allows the module to be imported in worker threads without errors
 */
interface LazyAuthService {
  getValidToken(): Promise<string | null>;
}

let authService: LazyAuthService | false | null = null;
function getAuthService(): LazyAuthService | null {
  if (authService !== null) {
    return authService === false ? null : authService;
  }

  try {
    // Try to import - this will only work in main process context
    const { authService: service } = require('../../main/services/AuthService');
    authService = service as LazyAuthService;
    return authService;
  } catch {
    // In worker context or if import fails, return null
    console.warn('[GitHubTokenAuth] AuthService not available in this context');
    authService = false; // Mark as attempted and failed
    return null;
  }
}

function isGitHubHttpsUrl(url: string): boolean {
  return url.startsWith('https://') && /github\.com[:/]/i.test(url);
}

export async function createGitHubTokenAuthEnvForUrl(
  url: string,
): Promise<GitAuthEnv | null> {
  if (!isGitHubHttpsUrl(url)) {
    return null;
  }

  try {
    // Lazy-load AuthService - may not be available in worker context
    const service = getAuthService();
    if (!service) {
      // Auth service not available (e.g., running in worker thread)
      // Return null to let git use default credentials (SSH keys, credential helpers, etc.)
      return null;
    }

    // Use AuthService to get a valid token with automatic refresh
    const token = await service.getValidToken();

    if (!token) {
      return null;
    }

    // Find a real Node.js executable instead of Electron
    // process.execPath in Electron points to the Electron binary, not Node
    // We need to find the system Node.js
    let nodeExecutable = 'node'; // Fallback to PATH

    // Try to find node in common locations
    const { execSync } = require('child_process');
    try {
      // Use 'which node' to find the actual Node.js binary
      nodeExecutable = execSync('which node', { encoding: 'utf-8' }).trim();
    } catch (_err) {
      // Fallback to 'node' in PATH if 'which' fails
      nodeExecutable = 'node';
    }

    const scriptContent = `#!/usr/bin/env node
const prompt = process.argv[2] || '';
if (/username/i.test(prompt)) {
  process.stdout.write('x-access-token');
  process.exit(0);
}
if (/password|token/i.test(prompt)) {
  const value = process.env.${TOKEN_ENV_VAR};
  if (!value) {
    process.exit(1);
  }
  process.stdout.write(value);
  process.exit(0);
}
process.stdout.write('');
`;

    const scriptPath = path.join(
      os.tmpdir(),
      `principle-git-askpass-${randomUUID()}.js`,
    );

    await fs.writeFile(scriptPath, scriptContent, { mode: 0o700 });

    // Create a wrapper script that calls Node with the askpass script
    // This avoids shebang issues where #!/usr/bin/env node might find the wrong Node
    const wrapperPath = path.join(
      os.tmpdir(),
      `principle-git-askpass-wrapper-${randomUUID()}.sh`,
    );

    const wrapperContent = `#!/bin/bash
exec "${nodeExecutable}" "${scriptPath}" "$@"
`;

    await fs.writeFile(wrapperPath, wrapperContent, { mode: 0o700 });

    return {
      source: 'github-token',
      env: {
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: wrapperPath,
        GCM_INTERACTIVE: 'never',
        [TOKEN_ENV_VAR]: token,
        NODE_OPTIONS: '', // Clear NODE_OPTIONS to prevent ts-node preload issues
      },
      cleanup: async () => {
        try {
          await fs.unlink(scriptPath);
          await fs.unlink(wrapperPath);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            console.warn(
              '[GitAuth] Failed to remove temporary askpass script:',
              error,
            );
          }
        }
      },
    };
  } catch (error) {
    console.error(
      '[GitAuth] Failed to prepare GitHub token credentials:',
      error,
    );
    return null;
  }
}
