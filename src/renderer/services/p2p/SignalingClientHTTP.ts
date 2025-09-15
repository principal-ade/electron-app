/**
 * HTTP-based Signaling Client for WebRTC
 * Uses polling instead of WebSockets to work with AWS App Runner
 */

import { OrbitConfig } from '../../config/orbit.config';

export interface SignalingCallbacks {
  onConnected: (peerId: string, githubHandle: string) => void;
  onPeerJoined: (peerId: string, githubHandle: string) => void;
  onPeerLeft: (peerId: string) => void;
  onSignal: (from: string, signal: any) => void;
  onError: (error: string) => void;
  onDisconnected: () => void;
}

export class SignalingClient {
  private callbacks: SignalingCallbacks | null = null;
  private peerId: string | null = null;
  private token: string | null = null;
  private repoUrl: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private knownPeers: Set<string> = new Set();
  
  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
  }
  
  async connect(token: string, repoUrl: string) {
    this.token = token;
    this.repoUrl = repoUrl;
    
    try {
      // Join the room
      const joinResponse = await fetch(`${OrbitConfig.apiUrl}/api/orbit/signal/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, repoUrl }),
      });
      
      if (!joinResponse.ok) {
        throw new Error('Failed to join room');
      }
      
      const joinData = await joinResponse.json();
      this.peerId = joinData.peerId;
      this.isConnected = true;
      
      // Notify connected
      this.callbacks?.onConnected(joinData.peerId, joinData.githubHandle);
      
      // Notify of existing peers
      for (const peer of joinData.peers) {
        this.knownPeers.add(peer.peerId);
        this.callbacks?.onPeerJoined(peer.peerId, peer.githubHandle);
      }
      
      // Start polling for signals
      this.startPolling();
    } catch (error) {
      console.error('Connection error:', error);
      this.callbacks?.onError('Failed to connect to signaling server');
      this.callbacks?.onDisconnected();
    }
  }
  
  private startPolling() {
    // Poll every 1 second for signals
    this.pollInterval = setInterval(async () => {
      if (!this.isConnected || !this.peerId || !this.repoUrl) return;
      
      try {
        const response = await fetch(`${OrbitConfig.apiUrl}/api/orbit/signal/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            peerId: this.peerId, 
            repoUrl: this.repoUrl 
          }),
        });
        
        if (!response.ok) {
          throw new Error('Poll failed');
        }
        
        const data = await response.json();
        
        // Process signals
        for (const signal of data.signals) {
          this.callbacks?.onSignal(signal.from, signal.data);
        }
        
        // Update peer list
        const currentPeerIds = new Set(data.peers.map((p: any) => p.peerId));
        
        // Find new peers
        for (const peer of data.peers) {
          if (!this.knownPeers.has(peer.peerId)) {
            this.knownPeers.add(peer.peerId);
            this.callbacks?.onPeerJoined(peer.peerId, peer.githubHandle);
          }
        }
        
        // Find disconnected peers
        for (const knownPeerId of this.knownPeers) {
          if (!currentPeerIds.has(knownPeerId)) {
            this.knownPeers.delete(knownPeerId);
            this.callbacks?.onPeerLeft(knownPeerId);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Don't disconnect on poll errors, just log them
      }
    }, 1000);
  }
  
  async sendSignal(to: string, signal: any) {
    if (!this.isConnected || !this.peerId) {
      console.warn('Cannot send signal: not connected');
      return;
    }
    
    try {
      const response = await fetch(`${OrbitConfig.apiUrl}/api/orbit/signal/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.peerId,
          to,
          type: signal.type || 'signal',
          data: signal,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send signal');
      }
    } catch (error) {
      console.error('Send signal error:', error);
    }
  }
  
  async disconnect() {
    this.isConnected = false;
    
    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    // Leave the room
    if (this.peerId && this.repoUrl) {
      try {
        await fetch(`${OrbitConfig.apiUrl}/api/orbit/signal/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            peerId: this.peerId,
            repoUrl: this.repoUrl,
          }),
        });
      } catch (error) {
        console.error('Leave room error:', error);
      }
    }
    
    this.peerId = null;
    this.token = null;
    this.repoUrl = null;
    this.knownPeers.clear();
    
    this.callbacks?.onDisconnected();
  }
  
  isActive(): boolean {
    return this.isConnected;
  }
}