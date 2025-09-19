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

export class PeerManager {
  private peers: Map<string, PeerInfo> = new Map();
  private myPeerId: string = '';
  private myGithubHandle: string = '';
  private onPeerUpdate?: (peers: PeerInfo[]) => void;
  private onDataReceived?: (peerId: string, data: PeerData) => void;

  constructor() {
    // Initialize WebRTC support check
    if (!SimplePeer.WEBRTC_SUPPORT) {
      console.error('WebRTC is not supported in this environment');
    }
  }

  setIdentity(peerId: string, githubHandle: string) {
    this.myPeerId = peerId;
    this.myGithubHandle = githubHandle;
  }

  setCallbacks(options: {
    onPeerUpdate?: (peers: PeerInfo[]) => void;
    onDataReceived?: (peerId: string, data: PeerData) => void;
  }) {
    this.onPeerUpdate = options.onPeerUpdate;
    this.onDataReceived = options.onDataReceived;
  }

  createPeer(
    peerId: string,
    githubHandle: string,
    initiator: boolean,
    signalCallback: (signal: any) => void,
  ): SimplePeer.Instance {
    console.log(
      `Creating peer connection to ${githubHandle} (${peerId}), initiator: ${initiator}`,
    );

    const peer = new SimplePeer({
      initiator,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      signalCallback(signal);
    });

    peer.on('connect', () => {
      console.log(`Connected to peer ${githubHandle}`);
      this.updatePeerStatus(peerId, true);

      // Send initial handshake
      this.sendToPeer(peerId, {
        type: 'handshake',
        data: {
          githubHandle: this.myGithubHandle,
          version: '1.0.0',
        },
      });
    });

    peer.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handlePeerData(peerId, message);
      } catch (error) {
        console.error('Failed to parse peer data:', error);
      }
    });

    peer.on('error', (error) => {
      console.error(`Peer connection error with ${githubHandle}:`, error);
      this.updatePeerStatus(peerId, false);
    });

    peer.on('close', () => {
      console.log(`Connection closed with ${githubHandle}`);
      this.removePeer(peerId);
    });

    // Store peer info
    this.peers.set(peerId, {
      peerId,
      githubHandle,
      peer,
      connected: false,
    });

    this.notifyPeerUpdate();
    return peer;
  }

  addSignal(peerId: string, signal: any) {
    const peerInfo = this.peers.get(peerId);
    if (peerInfo?.peer) {
      peerInfo.peer.signal(signal);
    }
  }

  private updatePeerStatus(peerId: string, connected: boolean) {
    const peerInfo = this.peers.get(peerId);
    if (peerInfo) {
      peerInfo.connected = connected;
      this.notifyPeerUpdate();
    }
  }

  private removePeer(peerId: string) {
    const peerInfo = this.peers.get(peerId);
    if (peerInfo?.peer) {
      peerInfo.peer.destroy();
    }
    this.peers.delete(peerId);
    this.notifyPeerUpdate();
  }

  private handlePeerData(peerId: string, data: any) {
    if (data.type === 'handshake') {
      console.log(`Received handshake from ${data.data.githubHandle}`);
      return;
    }

    const peerData: PeerData = {
      type: data.type,
      data: data.data,
      timestamp: data.timestamp || Date.now(),
    };

    this.onDataReceived?.(peerId, peerData);
  }

  private notifyPeerUpdate() {
    const peerList = Array.from(this.peers.values());
    this.onPeerUpdate?.(peerList);
  }

  // Public methods for sending data

  sendToPeer(peerId: string, data: any) {
    const peerInfo = this.peers.get(peerId);
    if (peerInfo?.peer && peerInfo.connected) {
      const message = {
        ...data,
        timestamp: Date.now(),
      };
      peerInfo.peer.send(JSON.stringify(message));
    }
  }

  broadcast(data: any) {
    const message = {
      ...data,
      timestamp: Date.now(),
    };
    const messageStr = JSON.stringify(message);

    this.peers.forEach((peerInfo) => {
      if (peerInfo.peer && peerInfo.connected) {
        peerInfo.peer.send(messageStr);
      }
    });
  }

  // Collaboration-specific methods

  sendCursorPosition(position: { x: number; y: number; file?: string }) {
    this.broadcast({
      type: 'cursor',
      data: position,
    });
  }

  sendSelection(selection: { file: string; start: number; end: number }) {
    this.broadcast({
      type: 'selection',
      data: selection,
    });
  }

  sendEdit(edit: { file: string; changes: any }) {
    this.broadcast({
      type: 'edit',
      data: edit,
    });
  }

  sendFileOpen(file: string) {
    this.broadcast({
      type: 'file-open',
      data: { file },
    });
  }

  sendChatMessage(message: string) {
    this.broadcast({
      type: 'chat',
      data: {
        message,
        sender: this.myGithubHandle,
      },
    });
  }

  // Cleanup

  disconnect() {
    this.peers.forEach((peerInfo) => {
      if (peerInfo.peer) {
        peerInfo.peer.destroy();
      }
    });
    this.peers.clear();
    this.notifyPeerUpdate();
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).filter((p) => p.connected);
  }
}
