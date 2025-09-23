/**
 * Observability API Interface
 */

export interface ObservabilityConfig {
  tursoUrl?: string;
  tursoAuthToken?: string;
  environment?: 'development' | 'staging' | 'production';
  enabled?: boolean;
}

export interface ObservabilityStatus {
  isInitialized: boolean;
  eventCount: number;
  errorCount: number;
  errorRate: number;
  enabled: boolean;
  hasConfig: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

export interface ObservabilityAPI {
  /**
   * Get current observability configuration
   */
  getConfig(): Promise<{ success: boolean; config?: ObservabilityConfig; error?: string }>;

  /**
   * Save observability configuration
   */
  saveConfig(config: ObservabilityConfig): Promise<{ success: boolean; error?: string }>;

  /**
   * Test connection with provided configuration
   */
  testConnection(config: ObservabilityConfig): Promise<ConnectionTestResult>;

  /**
   * Get observability status and statistics
   */
  getStatus(): Promise<{ success: boolean; status?: ObservabilityStatus; error?: string }>;
}