export interface SignalingCallbacks {
    onConnected?: (peerId: string, githubHandle: string) => void;
    onPeerJoined?: (peerId: string, githubHandle: string) => void;
    onPeerLeft?: (peerId: string, githubHandle: string) => void;
    onSignal?: (from: string, signal: any) => void;
    onError?: (error: string) => void;
    onDisconnected?: () => void;
}
export declare class SignalingClient {
    private ws;
    private callbacks;
    private reconnectTimeout;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private serverUrl;
    private token;
    private repoUrl;
    constructor(serverUrl?: string);
    setCallbacks(callbacks: SignalingCallbacks): void;
    connect(token: string, repoUrl: string): void;
    private handleMessage;
    sendSignal(to: string, signal: any): void;
    private send;
    private attemptReconnect;
    disconnect(): void;
    isConnected(): boolean;
}
//# sourceMappingURL=SignalingClient.d.ts.map