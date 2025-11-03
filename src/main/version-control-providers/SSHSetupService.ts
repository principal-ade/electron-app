/**
 * SSH Setup Service
 *
 * Handles SSH key generation, configuration, and testing for GitHub authentication.
 * This service helps users set up SSH authentication when Git clone operations fail.
 */

import { exec, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SSHKeyInfo {
  privateKeyPath: string; // ~/.ssh/principle_github
  publicKeyPath: string; // ~/.ssh/principle_github.pub
  publicKey: string; // The actual public key content
  fingerprint: string; // Key fingerprint for verification
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export class SSHSetupService {
  private readonly sshDir: string;
  private readonly keyName = 'principle_github';
  private readonly keyPath: string;
  private readonly publicKeyPath: string;

  constructor() {
    this.sshDir = path.join(os.homedir(), '.ssh');
    this.keyPath = path.join(this.sshDir, this.keyName);
    this.publicKeyPath = `${this.keyPath}.pub`;
  }

  /**
   * Check if the user already has an existing SSH key for Principle
   */
  async hasExistingSSHKey(): Promise<boolean> {
    try {
      await fs.access(this.keyPath);
      await fs.access(this.publicKeyPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a new SSH key pair using ed25519 algorithm
   */
  async generateSSHKey(): Promise<SSHKeyInfo> {
    try {
      // Ensure .ssh directory exists with correct permissions
      await this.ensureSSHDirectory();

      // Check if key already exists
      const exists = await this.hasExistingSSHKey();
      if (exists) {
        console.log('[SSHSetupService] Key already exists, reusing it');
        return await this.getExistingKeyInfo();
      }

      // Generate SSH key using ssh-keygen
      // -t ed25519: Use ed25519 algorithm (modern, secure)
      // -f: Output file path
      // -N "": No passphrase (for UX, trade-off for security)
      // -C: Comment (email-like identifier)
      const command = `ssh-keygen -t ed25519 -f "${this.keyPath}" -N "" -C "principal-ade@github.com"`;

      console.log('[SSHSetupService] Generating SSH key...');
      await execAsync(command);
      console.log('[SSHSetupService] SSH key generated successfully');

      // Set correct permissions
      await this.setKeyPermissions();

      // Get key info
      return await this.getExistingKeyInfo();
    } catch (error) {
      console.error('[SSHSetupService] Error generating SSH key:', error);
      throw new Error(
        `Failed to generate SSH key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get information about an existing SSH key
   */
  private async getExistingKeyInfo(): Promise<SSHKeyInfo> {
    try {
      // Read public key content
      const publicKey = await fs.readFile(this.publicKeyPath, 'utf-8');

      // Get key fingerprint
      const { stdout: fingerprint } = await execAsync(
        `ssh-keygen -lf "${this.publicKeyPath}"`,
      );

      return {
        privateKeyPath: this.keyPath,
        publicKeyPath: this.publicKeyPath,
        publicKey: publicKey.trim(),
        fingerprint: fingerprint.trim(),
      };
    } catch (error) {
      console.error('[SSHSetupService] Error reading key info:', error);
      throw new Error(
        `Failed to read SSH key info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Ensure .ssh directory exists with correct permissions
   */
  private async ensureSSHDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.sshDir, { recursive: true });
      await fs.chmod(this.sshDir, 0o700); // drwx------
      console.log('[SSHSetupService] SSH directory ready');
    } catch (error) {
      console.error('[SSHSetupService] Error creating SSH directory:', error);
      throw new Error(
        `Failed to create SSH directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Set correct permissions on SSH key files
   */
  private async setKeyPermissions(): Promise<void> {
    try {
      // Private key: -rw------- (0600)
      await fs.chmod(this.keyPath, 0o600);

      // Public key: -rw-r--r-- (0644)
      await fs.chmod(this.publicKeyPath, 0o644);

      console.log('[SSHSetupService] Key permissions set correctly');
    } catch (error) {
      console.error('[SSHSetupService] Error setting key permissions:', error);
      throw new Error(
        `Failed to set key permissions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Configure SSH config file to use the generated key for GitHub
   */
  async configureSSHConfig(): Promise<{ success: boolean; message?: string }> {
    try {
      const configPath = path.join(this.sshDir, 'config');
      const githubConfigMarker = '# Added by Principle AI';
      const githubConfigBlock = `
${githubConfigMarker}
Host github.com
    HostName github.com
    User git
    IdentityFile ${this.keyPath}
    IdentitiesOnly yes
    AddKeysToAgent yes
`;

      // Read existing config or create new one
      let existingConfig = '';
      try {
        existingConfig = await fs.readFile(configPath, 'utf-8');
      } catch {
        // File doesn't exist, that's fine
        console.log(
          '[SSHSetupService] No existing SSH config, creating new one',
        );
      }

      // Check if Principle AI config already exists
      if (existingConfig.includes(githubConfigMarker)) {
        console.log(
          '[SSHSetupService] SSH config already contains Principle AI settings',
        );
        return {
          success: true,
          message: 'SSH config already configured',
        };
      }

      // Check if there's already a github.com Host entry
      if (existingConfig.includes('Host github.com')) {
        console.warn(
          '[SSHSetupService] Existing github.com config found, appending Principle config',
        );
        // We'll append our config, SSH will use the first matching Host
      }

      // Append our config block
      const newConfig = existingConfig + '\n' + githubConfigBlock;
      await fs.writeFile(configPath, newConfig, 'utf-8');

      // Set correct permissions on config file
      await fs.chmod(configPath, 0o600);

      console.log('[SSHSetupService] SSH config updated successfully');
      return {
        success: true,
        message: 'SSH config configured successfully',
      };
    } catch (error) {
      console.error('[SSHSetupService] Error configuring SSH:', error);
      return {
        success: false,
        message: `Failed to configure SSH: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Add the SSH key to ssh-agent (if available)
   * This is optional - SSH will still work without it
   */
  async addKeyToAgent(): Promise<boolean> {
    try {
      // Try to add key to ssh-agent
      // This might fail if ssh-agent isn't running, which is fine
      await execAsync(`ssh-add "${this.keyPath}"`);
      console.log('[SSHSetupService] Key added to ssh-agent');
      return true;
    } catch (error) {
      // This is not critical - SSH will work without agent
      console.warn(
        '[SSHSetupService] Could not add key to ssh-agent (this is OK):',
        error,
      );
      return false;
    }
  }

  /**
   * Test SSH connection to GitHub
   */
  async testGitHubConnection(): Promise<ConnectionTestResult> {
    return new Promise((resolve) => {
      console.log('[SSHSetupService] Testing GitHub SSH connection...');

      // Use spawn instead of exec to handle the interactive nature of SSH
      const sshTest = spawn(
        'ssh',
        ['-T', 'git@github.com', '-o', 'StrictHostKeyChecking=no'],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let stdout = '';
      let stderr = '';

      sshTest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      sshTest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Set a timeout for the connection test
      const timeout = setTimeout(() => {
        sshTest.kill();
        console.log('[SSHSetupService] Connection test timed out');
        resolve({
          success: false,
          message:
            'Connection test timed out. Please check your internet connection.',
        });
      }, 15000); // 15 second timeout

      sshTest.on('close', (code) => {
        clearTimeout(timeout);

        const output = stdout + stderr;
        console.log('[SSHSetupService] SSH test exit code:', code);
        console.log('[SSHSetupService] SSH test output:', output);

        // GitHub SSH returns exit code 1 even on successful auth
        // We check the output message instead
        if (
          output.includes("You've successfully authenticated") ||
          output.includes('successfully authenticated')
        ) {
          console.log('[SSHSetupService] ✅ GitHub SSH connection successful');
          resolve({
            success: true,
            message: 'Successfully connected to GitHub via SSH',
          });
        } else if (output.includes('Permission denied')) {
          console.log('[SSHSetupService] ❌ Permission denied');
          resolve({
            success: false,
            message:
              'Permission denied. Make sure you uploaded the SSH key to GitHub.',
          });
        } else if (
          output.includes('Could not resolve hostname') ||
          output.includes('Connection timed out')
        ) {
          console.log('[SSHSetupService] ❌ Network error');
          resolve({
            success: false,
            message:
              'Could not reach GitHub. Please check your internet connection.',
          });
        } else {
          console.log('[SSHSetupService] ❌ Unknown error');
          resolve({
            success: false,
            message: `SSH connection test failed: ${output.trim() || 'Unknown error'}`,
          });
        }
      });

      sshTest.on('error', (error) => {
        clearTimeout(timeout);
        console.error('[SSHSetupService] Error running SSH test:', error);
        resolve({
          success: false,
          message: `Failed to run SSH test: ${error.message}`,
        });
      });
    });
  }

  /**
   * Complete SSH setup flow: generate key, configure SSH, add to agent
   */
  async completeSetup(): Promise<{
    success: boolean;
    keyInfo?: SSHKeyInfo;
    error?: string;
  }> {
    try {
      console.log('[SSHSetupService] Starting complete SSH setup...');

      // Generate or get existing key
      const keyInfo = await this.generateSSHKey();

      // Configure SSH config
      const configResult = await this.configureSSHConfig();
      if (!configResult.success) {
        return {
          success: false,
          error: configResult.message || 'Failed to configure SSH',
        };
      }

      // Try to add to agent (non-critical)
      await this.addKeyToAgent();

      console.log('[SSHSetupService] ✅ Complete SSH setup successful');
      return {
        success: true,
        keyInfo,
      };
    } catch (error) {
      console.error('[SSHSetupService] Error in complete setup:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error during setup',
      };
    }
  }
}

// Export singleton instance
export const sshSetupService = new SSHSetupService();
