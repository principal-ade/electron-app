/**
 * Orbit Configuration
 * Central configuration for the Orbit P2P collaboration system
 */
// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const useLocalServer = process.env.ORBIT_USE_LOCAL === 'true';
// Server configuration
const PRODUCTION_SERVER = 'https://principle-md.com';
const LOCAL_SERVER = 'http://localhost:3002';
// WebSocket configuration
const PRODUCTION_WS = 'wss://principle-md.com/orbit/signal';
const LOCAL_WS = 'ws://localhost:3003/orbit/signal';
export const OrbitConfig = {
    // API Base URL for OAuth and user management
    apiUrl: useLocalServer ? LOCAL_SERVER : PRODUCTION_SERVER,
    // WebSocket URL for signaling server
    wsUrl: useLocalServer ? LOCAL_WS : PRODUCTION_WS,
    // GitHub OAuth configuration
    // Note: OAuth is handled server-side through code-city-landing
    // The electron app doesn't need client credentials
    oauth: {
        redirectUri: useLocalServer
            ? 'http://localhost:3002/api/orbit/auth/github/callback'
            : 'https://principle-md.com/api/orbit/auth/github/callback',
    },
    // Timeouts and retry configuration
    timeouts: {
        oauthCode: 5 * 60 * 1000, // 5 minutes for user to enter OAuth code
        wsReconnect: 3000, // 3 seconds between WebSocket reconnect attempts
        peerConnection: 30000, // 30 seconds for peer connection establishment
    },
    // Feature flags
    features: {
        autoSync: false, // Automatic sync when changes detected
        conflictResolution: false, // Advanced conflict resolution UI
        fileTransfer: false, // Direct P2P file transfer (vs shared remote)
    },
    // Debug settings
    debug: {
        logWebSocket: isDevelopment,
        logPeerConnections: isDevelopment,
        logGitOperations: isDevelopment,
    },
};
// Helper to get current configuration
export const getOrbitConfig = () => OrbitConfig;
// Helper to override configuration for testing
export const setOrbitConfig = (overrides) => {
    Object.assign(OrbitConfig, overrides);
};
