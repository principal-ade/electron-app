/**
 * SSH Setup IPC Handlers
 *
 * Provides IPC communication bridge between renderer process and main process
 * for SSH setup operations.
 */

import { ipcMain } from 'electron';
import { sshSetupService } from '../../../version-control-providers/SSHSetupService';

export function registerSSHSetupHandlers(): void {
  console.log('[SSHSetupHandlers] Registering SSH setup IPC handlers...');

  /**
   * Check if user has an existing SSH key
   */
  ipcMain.handle('ssh-setup:has-existing-key', async () => {
    try {
      console.log('[SSHSetupHandlers] Checking for existing SSH key...');
      const hasKey = await sshSetupService.hasExistingSSHKey();
      console.log('[SSHSetupHandlers] Has existing key:', hasKey);
      return { success: true, hasKey };
    } catch (error) {
      console.error(
        '[SSHSetupHandlers] Error checking for existing key:',
        error,
      );
      return {
        success: false,
        hasKey: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Generate a new SSH key pair
   */
  ipcMain.handle('ssh-setup:generate-key', async () => {
    try {
      console.log('[SSHSetupHandlers] Generating SSH key...');
      const keyInfo = await sshSetupService.generateSSHKey();
      console.log('[SSHSetupHandlers] SSH key generated successfully');
      return {
        success: true,
        keyInfo,
      };
    } catch (error) {
      console.error('[SSHSetupHandlers] Error generating SSH key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Configure SSH config file
   */
  ipcMain.handle('ssh-setup:configure-ssh', async () => {
    try {
      console.log('[SSHSetupHandlers] Configuring SSH config...');
      const result = await sshSetupService.configureSSHConfig();
      console.log('[SSHSetupHandlers] SSH config result:', result);
      return result;
    } catch (error) {
      console.error('[SSHSetupHandlers] Error configuring SSH:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Add SSH key to ssh-agent
   */
  ipcMain.handle('ssh-setup:add-to-agent', async () => {
    try {
      console.log('[SSHSetupHandlers] Adding key to ssh-agent...');
      const added = await sshSetupService.addKeyToAgent();
      console.log('[SSHSetupHandlers] Added to agent:', added);
      return { success: true, added };
    } catch (error) {
      console.error('[SSHSetupHandlers] Error adding to agent:', error);
      return {
        success: true, // Non-critical failure
        added: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Test GitHub SSH connection
   */
  ipcMain.handle('ssh-setup:test-connection', async () => {
    try {
      console.log('[SSHSetupHandlers] Testing GitHub connection...');
      const result = await sshSetupService.testGitHubConnection();
      console.log('[SSHSetupHandlers] Connection test result:', result);
      return result;
    } catch (error) {
      console.error('[SSHSetupHandlers] Error testing connection:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Complete SSH setup (all-in-one)
   */
  ipcMain.handle('ssh-setup:complete-setup', async () => {
    try {
      console.log('[SSHSetupHandlers] Starting complete SSH setup...');
      const result = await sshSetupService.completeSetup();
      console.log('[SSHSetupHandlers] Complete setup result:', result);
      return result;
    } catch (error) {
      console.error('[SSHSetupHandlers] Error in complete setup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  console.log(
    '[SSHSetupHandlers] SSH setup IPC handlers registered successfully',
  );
}
