/**
 * HTTP-based Signaling Client for WebRTC
 * Uses polling instead of WebSockets to work with AWS App Runner
 */
export interface SignalingCallbacks {
    onConnected: (peerId: string, githubHandle: string) => void;
    onPeerJoined: (peerId: string, githubHandle: string) => void;
    onPeerLeft: (peerId: string) => void;
    onSignal: (from: string, signal: any) => void;
    onError: (error: string) => void;
    onDisconnected: () => void;
}
export declare class SignalingClient {
    private callbacks;
    private peerId;
    private token;
    private repoUrl;
    private pollInterval;
    private isConnected;
    private knownPeers;
    setCallbacks(callbacks: SignalingCallbacks): void;
    connect(token: string, repoUrl: string): Promise<void>;
    private startPolling;
    sendSignal(to: string, signal: any): Promise<void>;
    disconnect(): Promise<void>;
    isActive(): boolean;
}
//# sourceMappingURL=SignalingClientHTTP.d.ts.map