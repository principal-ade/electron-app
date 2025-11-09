/**
 * GitCredentialHelper - Manages git credential configuration for HTTPS authentication
 *
 * This service configures git's credential.helper to store GitHub credentials,
 * allowing seamless HTTPS cloning without complex GIT_ASKPASS scripts.
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitCredentialHelper {
  /**
   * Configure git to use stored credentials for GitHub HTTPS
   * This sets up git's credential helper and writes the token to ~/.git-credentials
   *
   * @param token - GitHub personal access token or OAuth token
   */
  static async configureGitCredentials(token: string): Promise<void> {
    try {
      console.log('[GitCredentialHelper] Configuring git credentials for GitHub HTTPS...');

      // Configure git to use credential helper store
      // This tells git to store credentials in ~/.git-credentials
      await execAsync('git config --global credential.helper store');
      console.log('[GitCredentialHelper] ✓ Set credential.helper to store');

      // Set username to x-access-token (GitHub convention for token auth)
      // When using a token, GitHub ignores the username but requires one
      await execAsync('git config --global credential.https://github.com.username x-access-token');
      console.log('[GitCredentialHelper] ✓ Set GitHub username to x-access-token');

      // Write credentials to ~/.git-credentials
      const credentialsPath = path.join(os.homedir(), '.git-credentials');
      const credentialLine = `https://x-access-token:${token}@github.com`;

      // Read existing credentials (if any)
      let existingCreds = '';
      try {
        existingCreds = await fs.readFile(credentialsPath, 'utf-8');
      } catch {
        // File doesn't exist yet, which is fine
        console.log('[GitCredentialHelper] Creating new .git-credentials file');
      }

      // Remove any existing github.com credentials to avoid duplicates
      const lines = existingCreds
        .split('\n')
        .filter(line => line.trim() && !line.includes('github.com'));

      // Add new credential
      lines.push(credentialLine);

      // Write back with proper permissions (read/write for owner only)
      await fs.writeFile(
        credentialsPath,
        lines.join('\n') + '\n',
        { mode: 0o600 }
      );

      console.log('[GitCredentialHelper] ✓ GitHub credentials stored in ~/.git-credentials');
      console.log('[GitCredentialHelper] Git is now configured for GitHub HTTPS authentication');
    } catch (error) {
      console.error('[GitCredentialHelper] Failed to configure git credentials:', error);
      throw new Error(
        `Failed to configure git credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Remove GitHub credentials from git
   * Called during logout to clean up stored credentials
   */
  static async clearGitCredentials(): Promise<void> {
    try {
      console.log('[GitCredentialHelper] Clearing GitHub credentials...');

      const credentialsPath = path.join(os.homedir(), '.git-credentials');

      try {
        // Read and filter out GitHub credentials
        const existingCreds = await fs.readFile(credentialsPath, 'utf-8');
        const lines = existingCreds
          .split('\n')
          .filter(line => line.trim() && !line.includes('github.com'));

        if (lines.length > 0) {
          // Keep other credentials if they exist
          await fs.writeFile(credentialsPath, lines.join('\n') + '\n');
          console.log('[GitCredentialHelper] ✓ GitHub credentials removed, other credentials preserved');
        } else {
          // No other credentials, remove the file
          await fs.unlink(credentialsPath);
          console.log('[GitCredentialHelper] ✓ Removed .git-credentials file (no other credentials)');
        }
      } catch (error) {
        // If file doesn't exist, that's fine
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          console.log('[GitCredentialHelper] No .git-credentials file to clear');
        } else {
          throw error;
        }
      }

      // Optionally clear the username config (but keep credential.helper for other services)
      try {
        await execAsync('git config --global --unset credential.https://github.com.username');
        console.log('[GitCredentialHelper] ✓ Cleared GitHub username config');
      } catch {
        // Config may not exist, which is fine
      }

      console.log('[GitCredentialHelper] GitHub credentials cleared successfully');
    } catch (error) {
      console.error('[GitCredentialHelper] Error clearing credentials:', error);
      // Don't throw - clearing credentials is best-effort
    }
  }

  /**
   * Check if git credentials are configured for GitHub
   * Useful for diagnostics
   */
  static async areCredentialsConfigured(): Promise<boolean> {
    try {
      const credentialsPath = path.join(os.homedir(), '.git-credentials');
      const content = await fs.readFile(credentialsPath, 'utf-8');
      return content.includes('github.com');
    } catch {
      return false;
    }
  }

  /**
   * Get git credential helper configuration
   * Useful for diagnostics
   */
  static async getCredentialHelperConfig(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git config --global credential.helper');
      return stdout.trim();
    } catch {
      return null;
    }
  }
}
