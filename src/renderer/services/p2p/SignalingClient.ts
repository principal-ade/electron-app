import { OrbitConfig } from '../../config/orbit.config';

export interface SignalingCallbacks {
  onConnected?: (peerId: string, githubHandle: string) => void;
  onPeerJoined?: (peerId: string, githubHandle: string) => void;
  onPeerLeft?: (peerId: string, githubHandle: string) => void;
  onSignal?: (from: string, signal: any) => void;
  onError?: (error: string) => void;
  onDisconnected?: () => void;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private callbacks: SignalingCallbacks = {};
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private serverUrl: string;
  private token: string = '';
  private repoUrl: string = '';

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || OrbitConfig.wsUrl;
  }

  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
  }

  connect(token: string, repoUrl: string) {
    this.token = token;
    this.repoUrl = repoUrl;
    
    if (this.ws) {
      this.disconnect();
    }

    try {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => {
        console.log('Connected to signaling server');
        this.reconnectAttempts = 0;
        
        // Send join message
        this.send({
          type: 'join',
          token: this.token,
          repoUrl: this.repoUrl,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse signaling message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.callbacks.onError?.('Connection error');
      };

      this.ws.onclose = () => {
        console.log('Disconnected from signaling server');
        this.callbacks.onDisconnected?.();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to connect to signaling server:', error);
      this.callbacks.onError?.('Failed to connect');
      this.attemptReconnect();
    }
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'joined':
        console.log('Joined room successfully', message);
        this.callbacks.onConnected?.(message.peerId, message.githubHandle);
        
        // Handle existing peers
        if (message.peers && Array.isArray(message.peers)) {
          message.peers.forEach((peer: any) => {
            this.callbacks.onPeerJoined?.(peer.peerId, peer.githubHandle);
          });
        }
        break;

      case 'peer-joined':
        console.log('New peer joined:', message.githubHandle);
        this.callbacks.onPeerJoined?.(message.peerId, message.githubHandle);
        break;

      case 'peer-left':
        console.log('Peer left:', message.githubHandle);
        this.callbacks.onPeerLeft?.(message.peerId, message.githubHandle);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.callbacks.onSignal?.(message.from, message.data);
        break;

      case 'error':
        console.error('Signaling error:', message.message);
        this.callbacks.onError?.(message.message);
        
        // Handle specific errors
        if (message.status === 'waitlisted') {
          this.callbacks.onError?.('You are on the waitlist. Please wait for approval.');
        } else if (message.status === 'denied') {
          this.callbacks.onError?.('Your access has been denied.');
        } else if (message.message === 'No access to repository') {
          this.callbacks.onError?.('You do not have access to this repository.');
        }
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  sendSignal(to: string, signal: any) {
    const type = signal.type === 'offer' ? 'offer' : 
                 signal.type === 'answer' ? 'answer' : 
                 'ice-candidate';
    
    this.send({
      type,
      to,
      data: signal,
    });
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.callbacks.onError?.('Unable to reconnect to server');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.token && this.repoUrl) {
        this.connect(this.token, this.repoUrl);
      }
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.send({ type: 'leave' });
      this.ws.close();
      this.ws = null;
    }
    
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}