/**
 * Orbit Configuration
 * Central configuration for the Orbit P2P collaboration system
 */
export declare const OrbitConfig: {
    apiUrl: string;
    wsUrl: string;
    oauth: {
        redirectUri: string;
    };
    timeouts: {
        oauthCode: number;
        wsReconnect: number;
        peerConnection: number;
    };
    features: {
        autoSync: boolean;
        conflictResolution: boolean;
        fileTransfer: boolean;
    };
    debug: {
        logWebSocket: boolean;
        logPeerConnections: boolean;
        logGitOperations: boolean;
    };
};
export declare const getOrbitConfig: () => {
    apiUrl: string;
    wsUrl: string;
    oauth: {
        redirectUri: string;
    };
    timeouts: {
        oauthCode: number;
        wsReconnect: number;
        peerConnection: number;
    };
    features: {
        autoSync: boolean;
        conflictResolution: boolean;
        fileTransfer: boolean;
    };
    debug: {
        logWebSocket: boolean;
        logPeerConnections: boolean;
        logGitOperations: boolean;
    };
};
export declare const setOrbitConfig: (overrides: Partial<typeof OrbitConfig>) => void;
//# sourceMappingURL=orbit.config.d.ts.map