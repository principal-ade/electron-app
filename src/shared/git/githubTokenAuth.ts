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
let authService: any = null;
function getAuthService() {
  if (authService !== null) {
    return authService;
  }

  try {
    // Try to import - this will only work in main process context
    const { authService: service } = require('../../main/services/AuthService');
    authService = service;
    return authService;
  } catch (error) {
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

    return {
      source: 'github-token',
      env: {
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: scriptPath,
        GCM_INTERACTIVE: 'never',
        [TOKEN_ENV_VAR]: token,
      },
      cleanup: async () => {
        try {
          await fs.unlink(scriptPath);
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
    console.error('[GitAuth] Failed to prepare GitHub token credentials:', error);
    return null;
  }
}
