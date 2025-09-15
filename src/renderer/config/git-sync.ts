/**
 * Git Sync Server Configuration
 */

const isDevelopment = process.env.NODE_ENV === 'development';

// Server URLs based on environment
export const GIT_SYNC_CONFIG = {
  // Use local server in development, production server otherwise
  SERVER_URL: process.env.GIT_SYNC_SERVER_URL || 
    (isDevelopment ? 'http://localhost:3000' : 'https://34.226.213.143'),
  
  // WebSocket URLs (automatically derived from SERVER_URL)
  getWebSocketUrl: (serverUrl: string = GIT_SYNC_CONFIG.SERVER_URL): string => {
    if (serverUrl.startsWith('https://')) {
      return serverUrl.replace('https://', 'wss://');
    } else if (serverUrl.startsWith('http://')) {
      return serverUrl.replace('http://', 'ws://');
    }
    return serverUrl;
  },
  
  // Timeouts and intervals
  RECONNECT_DELAY: 5000,
  PING_INTERVAL: 30000,
  AUTH_TIMEOUT: 10000,
  
  // Feature flags
  USE_SECURE_STORAGE: true,
  AUTO_RECONNECT: true,
  DEBUG_MODE: isDevelopment,
};

// Export for backward compatibility
export const GIT_SYNC_SERVER_URL = GIT_SYNC_CONFIG.SERVER_URL;