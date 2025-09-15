import SimplePeer from 'simple-peer';
export class PeerManager {
    peers = new Map();
    myPeerId = '';
    myGithubHandle = '';
    onPeerUpdate;
    onDataReceived;
    constructor() {
        // Initialize WebRTC support check
        if (!SimplePeer.WEBRTC_SUPPORT) {
            console.error('WebRTC is not supported in this environment');
        }
    }
    setIdentity(peerId, githubHandle) {
        this.myPeerId = peerId;
        this.myGithubHandle = githubHandle;
    }
    setCallbacks(options) {
        this.onPeerUpdate = options.onPeerUpdate;
        this.onDataReceived = options.onDataReceived;
    }
    createPeer(peerId, githubHandle, initiator, signalCallback) {
        console.log(`Creating peer connection to ${githubHandle} (${peerId}), initiator: ${initiator}`);
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
            }
            catch (error) {
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
    addSignal(peerId, signal) {
        const peerInfo = this.peers.get(peerId);
        if (peerInfo?.peer) {
            peerInfo.peer.signal(signal);
        }
    }
    updatePeerStatus(peerId, connected) {
        const peerInfo = this.peers.get(peerId);
        if (peerInfo) {
            peerInfo.connected = connected;
            this.notifyPeerUpdate();
        }
    }
    removePeer(peerId) {
        const peerInfo = this.peers.get(peerId);
        if (peerInfo?.peer) {
            peerInfo.peer.destroy();
        }
        this.peers.delete(peerId);
        this.notifyPeerUpdate();
    }
    handlePeerData(peerId, data) {
        if (data.type === 'handshake') {
            console.log(`Received handshake from ${data.data.githubHandle}`);
            return;
        }
        const peerData = {
            type: data.type,
            data: data.data,
            timestamp: data.timestamp || Date.now(),
        };
        this.onDataReceived?.(peerId, peerData);
    }
    notifyPeerUpdate() {
        const peerList = Array.from(this.peers.values());
        this.onPeerUpdate?.(peerList);
    }
    // Public methods for sending data
    sendToPeer(peerId, data) {
        const peerInfo = this.peers.get(peerId);
        if (peerInfo?.peer && peerInfo.connected) {
            const message = {
                ...data,
                timestamp: Date.now(),
            };
            peerInfo.peer.send(JSON.stringify(message));
        }
    }
    broadcast(data) {
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
    sendCursorPosition(position) {
        this.broadcast({
            type: 'cursor',
            data: position,
        });
    }
    sendSelection(selection) {
        this.broadcast({
            type: 'selection',
            data: selection,
        });
    }
    sendEdit(edit) {
        this.broadcast({
            type: 'edit',
            data: edit,
        });
    }
    sendFileOpen(file) {
        this.broadcast({
            type: 'file-open',
            data: { file },
        });
    }
    sendChatMessage(message) {
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
    getPeers() {
        return Array.from(this.peers.values());
    }
    getConnectedPeers() {
        return Array.from(this.peers.values()).filter(p => p.connected);
    }
}
