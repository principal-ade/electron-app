#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');

// Simple signaling server for local development
class LocalSignalingServer {
  constructor(port = 3003) {
    this.port = port;
    this.connections = new Map();
    this.rooms = new Map();
    
    // Create HTTP server
    this.server = http.createServer();
    
    // Create WebSocket server
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/orbit/signal'
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    
    this.server.listen(port, () => {
      console.log(`🚀 Orbit Signaling Server running on http://localhost:${port}`);
      console.log(`WebSocket endpoint: ws://localhost:${port}/orbit/signal`);
    });
  }
  
  handleConnection(ws) {
    const peerId = this.generatePeerId();
    console.log(`👤 Peer connected: ${peerId}`);
    
    ws.on('message', (message) => {
      try {
        const signal = JSON.parse(message.toString());
        this.handleSignal(ws, peerId, signal);
      } catch (error) {
        console.error('❌ Signal error:', error.message);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid signal message'
        }));
      }
    });
    
    ws.on('close', () => {
      console.log(`👋 Peer disconnected: ${peerId}`);
      this.handleDisconnect(peerId);
    });
    
    ws.on('error', (error) => {
      console.error(`🔌 WebSocket error for ${peerId}:`, error.message);
    });
  }
  
  async handleSignal(ws, peerId, signal) {
    console.log(`📡 Signal from ${peerId}:`, signal.type);
    
    switch (signal.type) {
      case 'join':
        await this.handleJoin(ws, peerId, signal);
        break;
      case 'leave':
        this.handleLeave(peerId, signal.repoUrl);
        break;
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.forwardSignal(peerId, signal);
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown signal type: ${signal.type}`
        }));
    }
  }
  
  async handleJoin(ws, peerId, signal) {
    const { repoUrl, token } = signal;
    
    if (!repoUrl || !token) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Missing repoUrl or token'
      }));
      return;
    }
    
    // For local testing, we'll accept any token that looks like a GitHub token
    const githubHandle = token.startsWith('gho_') ? 'TestUser' : 'Anonymous';
    
    // Store connection
    this.connections.set(peerId, {
      ws,
      githubHandle,
      repoUrl,
      peerId
    });
    
    // Add to room
    if (!this.rooms.has(repoUrl)) {
      this.rooms.set(repoUrl, new Set());
    }
    this.rooms.get(repoUrl).add(peerId);
    
    // Notify of successful join
    ws.send(JSON.stringify({
      type: 'connected',
      peerId,
      githubHandle
    }));
    
    // Notify existing peers in the room
    const roomPeers = this.rooms.get(repoUrl);
    roomPeers.forEach(otherPeerId => {
      if (otherPeerId !== peerId) {
        const otherConnection = this.connections.get(otherPeerId);
        if (otherConnection) {
          otherConnection.ws.send(JSON.stringify({
            type: 'peer-joined',
            peerId,
            githubHandle
          }));
        }
      }
    });
    
    console.log(`🏠 ${githubHandle} joined room: ${repoUrl} (${roomPeers.size} peers total)`);
  }
  
  handleLeave(peerId, repoUrl) {
    const connection = this.connections.get(peerId);
    if (!connection) return;
    
    // Remove from room
    const room = this.rooms.get(repoUrl);
    if (room) {
      room.delete(peerId);
      
      // Notify other peers
      room.forEach(otherPeerId => {
        const otherConnection = this.connections.get(otherPeerId);
        if (otherConnection) {
          otherConnection.ws.send(JSON.stringify({
            type: 'peer-left',
            peerId
          }));
        }
      });
      
      // Clean up empty room
      if (room.size === 0) {
        this.rooms.delete(repoUrl);
      }
    }
    
    console.log(`🚪 ${connection.githubHandle} left room: ${repoUrl}`);
  }
  
  handleDisconnect(peerId) {
    const connection = this.connections.get(peerId);
    if (!connection) return;
    
    // Leave all rooms
    this.rooms.forEach((room, repoUrl) => {
      if (room.has(peerId)) {
        this.handleLeave(peerId, repoUrl);
      }
    });
    
    // Remove connection
    this.connections.delete(peerId);
  }
  
  forwardSignal(fromPeerId, signal) {
    const { to } = signal;
    if (!to) return;
    
    const targetConnection = this.connections.get(to);
    if (targetConnection) {
      targetConnection.ws.send(JSON.stringify({
        ...signal,
        from: fromPeerId
      }));
    }
  }
  
  generatePeerId() {
    return Math.random().toString(36).substring(2, 15);
  }
}

// Start the server
new LocalSignalingServer();