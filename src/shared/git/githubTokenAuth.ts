import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { UnifiedSecureStorage, TOKEN_KEYS } from '../../main/services/UnifiedSecureStorage';
import { authService } from '../../main/services/AuthService';

export interface GitAuthEnv {
  env: NodeJS.ProcessEnv;
  cleanup: () => Promise<void>;
  source: 'github-token';
}

const TOKEN_ENV_VAR = 'PRINCIPLE_GITHUB_TOKEN';

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
    // Use AuthService to get a valid token with automatic refresh
    const token = await authService.getValidToken();

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
