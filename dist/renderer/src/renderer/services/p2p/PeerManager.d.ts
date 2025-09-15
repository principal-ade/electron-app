import SimplePeer from 'simple-peer';
export interface PeerInfo {
    peerId: string;
    githubHandle: string;
    peer?: SimplePeer.Instance;
    connected: boolean;
}
export interface PeerData {
    type: 'cursor' | 'selection' | 'edit' | 'file-open' | 'chat';
    data: any;
    timestamp: number;
}
export declare class PeerManager {
    private peers;
    private myPeerId;
    private myGithubHandle;
    private onPeerUpdate?;
    private onDataReceived?;
    constructor();
    setIdentity(peerId: string, githubHandle: string): void;
    setCallbacks(options: {
        onPeerUpdate?: (peers: PeerInfo[]) => void;
        onDataReceived?: (peerId: string, data: PeerData) => void;
    }): void;
    createPeer(peerId: string, githubHandle: string, initiator: boolean, signalCallback: (signal: any) => void): SimplePeer.Instance;
    addSignal(peerId: string, signal: any): void;
    private updatePeerStatus;
    private removePeer;
    private handlePeerData;
    private notifyPeerUpdate;
    sendToPeer(peerId: string, data: any): void;
    broadcast(data: any): void;
    sendCursorPosition(position: {
        x: number;
        y: number;
        file?: string;
    }): void;
    sendSelection(selection: {
        file: string;
        start: number;
        end: number;
    }): void;
    sendEdit(edit: {
        file: string;
        changes: any;
    }): void;
    sendFileOpen(file: string): void;
    sendChatMessage(message: string): void;
    disconnect(): void;
    getPeers(): PeerInfo[];
    getConnectedPeers(): PeerInfo[];
}
//# sourceMappingURL=PeerManager.d.ts.map