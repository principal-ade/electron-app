import {
  SSHKeyInfo,
  SSHKeyGenerationResponse,
  SSHConfigResponse,
  SSHKeyCheckResponse,
  SSHConnectionTestResult,
  SSHAgentResponse,
  SSHCompleteSetupResponse,
} from '../../shared/main-process-api-interfaces/SSHSetupAPI';

/**
 * Service layer for SSH Setup functionality
 * ALL window.mainProcess.sshSetup calls MUST be encapsulated here
 */
export class SSHSetupService {
  /**
   * Check if user has an existing SSH key
   */
  static async hasExistingKey(): Promise<boolean> {
    try {
      const response: SSHKeyCheckResponse =
        await window.mainProcess.sshSetup.hasExistingKey();
      return response.success && response.hasKey;
    } catch (error) {
      console.error('[SSHSetupService] Failed to check existing key:', error);
      return false;
    }
  }

  /**
   * Generate a new SSH key pair
   */
  static async generateKey(): Promise<SSHKeyInfo | null> {
    try {
      const response: SSHKeyGenerationResponse =
        await window.mainProcess.sshSetup.generateKey();
      if (response.success && response.keyInfo) {
        return response.keyInfo;
      }
      console.error('[SSHSetupService] Key generation failed:', response.error);
      return null;
    } catch (error) {
      console.error('[SSHSetupService] Failed to generate SSH key:', error);
      return null;
    }
  }

  /**
   * Configure SSH config file
   */
  static async configureSSH(): Promise<{ success: boolean; message?: string }> {
    try {
      const response: SSHConfigResponse =
        await window.mainProcess.sshSetup.configureSSH();
      return response;
    } catch (error) {
      console.error('[SSHSetupService] Failed to configure SSH:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Add SSH key to ssh-agent (optional)
   */
  static async addToAgent(): Promise<boolean> {
    try {
      const response: SSHAgentResponse =
        await window.mainProcess.sshSetup.addToAgent();
      return response.success && response.added;
    } catch (error) {
      console.warn(
        '[SSHSetupService] Failed to add key to agent (non-critical):',
        error,
      );
      return false;
    }
  }

  /**
   * Test GitHub SSH connection
   */
  static async testConnection(): Promise<SSHConnectionTestResult> {
    try {
      const response: SSHConnectionTestResult =
        await window.mainProcess.sshSetup.testConnection();
      return response;
    } catch (error) {
      console.error('[SSHSetupService] Failed to test connection:', error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to test SSH connection',
      };
    }
  }

  /**
   * Complete SSH setup (all-in-one)
   * Generates key, configures SSH, and adds to agent
   */
  static async completeSetup(): Promise<{
    success: boolean;
    keyInfo?: SSHKeyInfo;
    error?: string;
  }> {
    try {
      const response: SSHCompleteSetupResponse =
        await window.mainProcess.sshSetup.completeSetup();
      return response;
    } catch (error) {
      console.error('[SSHSetupService] Failed to complete setup:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to complete SSH setup',
      };
    }
  }
}
