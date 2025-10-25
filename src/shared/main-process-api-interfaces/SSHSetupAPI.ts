/**
 * SSH Setup API - Types and interface for SSH key generation and configuration
 */

export interface SSHKeyInfo {
  privateKeyPath: string; // ~/.ssh/principle_github
  publicKeyPath: string; // ~/.ssh/principle_github.pub
  publicKey: string; // The actual public key content
  fingerprint: string; // Key fingerprint for verification
}

export interface SSHSetupResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SSHKeyGenerationResponse {
  success: boolean;
  keyInfo?: SSHKeyInfo;
  error?: string;
}

export interface SSHConfigResponse {
  success: boolean;
  message?: string;
}

export interface SSHKeyCheckResponse {
  success: boolean;
  hasKey: boolean;
  error?: string;
}

export interface SSHConnectionTestResult {
  success: boolean;
  message: string;
}

export interface SSHAgentResponse {
  success: boolean;
  added: boolean;
  error?: string;
}

export interface SSHCompleteSetupResponse {
  success: boolean;
  keyInfo?: SSHKeyInfo;
  error?: string;
}

/**
 * SSHSetupAPI - Handles SSH key generation, configuration, and testing
 */
export interface SSHSetupAPI {
  /**
   * Check if user has an existing SSH key
   */
  hasExistingKey(): Promise<SSHKeyCheckResponse>;

  /**
   * Generate a new SSH key pair
   */
  generateKey(): Promise<SSHKeyGenerationResponse>;

  /**
   * Configure SSH config file
   */
  configureSSH(): Promise<SSHConfigResponse>;

  /**
   * Add SSH key to ssh-agent (optional)
   */
  addToAgent(): Promise<SSHAgentResponse>;

  /**
   * Test GitHub SSH connection
   */
  testConnection(): Promise<SSHConnectionTestResult>;

  /**
   * Complete SSH setup (all-in-one: generate, configure, add to agent)
   */
  completeSetup(): Promise<SSHCompleteSetupResponse>;
}
