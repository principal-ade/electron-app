import React, { useState, useEffect, useRef } from 'react';
import { Users, Circle, MessageSquare, Github, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { PeerManager, PeerInfo, PeerData } from '../services/p2p/PeerManager';
import { SignalingClient } from '../services/p2p/SignalingClient';
import { GitHubAuth, GitHubUser } from '../services/p2p/GitHubAuth';

interface CollaborationPanelProps {
  repoUrl?: string;
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
  isLocal: boolean;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ repoUrl, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const peerManagerRef = useRef<PeerManager | null>(null);
  const signalingClientRef = useRef<SignalingClient | null>(null);
  const authRef = useRef<GitHubAuth | null>(null);
  const myPeerIdRef = useRef<string>('');

  useEffect(() => {
    initializeAuth();
    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.status === 'approved' && repoUrl) {
      connectToRoom();
    }
  }, [isAuthenticated, user, repoUrl]);

  const initializeAuth = async () => {
    authRef.current = GitHubAuth.getInstance();
    
    // Check existing authentication
    const status = await authRef.current.checkStatus();
    
    if (status.user) {
      setUser(status.user);
      setIsAuthenticated(true);
    }
  };

  const handleAuthenticate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await authRef.current!.authenticate();
      
      if (result.success && result.user) {
        setUser(result.user);
        setIsAuthenticated(true);
        
        if (result.user.status === 'waitlisted') {
          setError('You are on the waitlist. Please wait for approval to access collaboration features.');
        } else if (result.user.status === 'denied') {
          setError('Your access request has been denied.');
        }
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Failed to authenticate with GitHub');
    } finally {
      setLoading(false);
    }
  };

  const connectToRoom = async () => {
    if (!repoUrl || !authRef.current?.getToken()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify repo access
      const hasAccess = await authRef.current.verifyRepoAccess(repoUrl);
      if (!hasAccess) {
        setError('You do not have access to this repository');
        setLoading(false);
        return;
      }

      // Initialize peer manager
      peerManagerRef.current = new PeerManager();
      peerManagerRef.current.setCallbacks({
        onPeerUpdate: setPeers,
        onDataReceived: handlePeerData,
      });

      // Initialize signaling client
      signalingClientRef.current = new SignalingClient();
      signalingClientRef.current.setCallbacks({
        onConnected: (peerId, githubHandle) => {
          myPeerIdRef.current = peerId;
          peerManagerRef.current?.setIdentity(peerId, githubHandle);
          setIsConnected(true);
          setLoading(false);
        },
        onPeerJoined: (peerId, githubHandle) => {
          // Create peer connection as initiator
          const peer = peerManagerRef.current?.createPeer(
            peerId,
            githubHandle,
            true,
            (signal) => {
              signalingClientRef.current?.sendSignal(peerId, signal);
            }
          );
        },
        onPeerLeft: (peerId) => {
          // Peer manager will handle cleanup
        },
        onSignal: (from, signal) => {
          // Handle incoming signals
          const existingPeer = peerManagerRef.current?.getPeers().find(p => p.peerId === from);
          
          if (!existingPeer) {
            // Create new peer as receiver
            peerManagerRef.current?.createPeer(
              from,
              'Unknown', // Will be updated on handshake
              false,
              (signal) => {
                signalingClientRef.current?.sendSignal(from, signal);
              }
            );
          }
          
          peerManagerRef.current?.addSignal(from, signal);
        },
        onError: (error) => {
          setError(error);
          setIsConnected(false);
        },
        onDisconnected: () => {
          setIsConnected(false);
        },
      });

      // Connect to signaling server
      const token = authRef.current.getToken()!;
      signalingClientRef.current.connect(token, repoUrl);
    } catch (err) {
      setError('Failed to connect to collaboration room');
      setLoading(false);
    }
  };

  const disconnect = () => {
    peerManagerRef.current?.disconnect();
    signalingClientRef.current?.disconnect();
    setIsConnected(false);
    setPeers([]);
  };

  const handlePeerData = (peerId: string, data: PeerData) => {
    switch (data.type) {
      case 'chat':
        const message: ChatMessage = {
          id: `${peerId}-${data.timestamp}`,
          sender: data.data.sender,
          message: data.data.message,
          timestamp: data.timestamp,
          isLocal: false,
        };
        setMessages(prev => [...prev, message]);
        break;
      
      // Handle other data types (cursor, selection, etc.)
      default:
        console.log('Received peer data:', data);
    }
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !peerManagerRef.current) {
      return;
    }

    const message: ChatMessage = {
      id: `local-${Date.now()}`,
      sender: user?.githubHandle || 'You',
      message: inputMessage,
      timestamp: Date.now(),
      isLocal: true,
    };

    setMessages(prev => [...prev, message]);
    peerManagerRef.current.sendChatMessage(inputMessage);
    setInputMessage('');
  };

  const renderAuthSection = () => {
    if (!isAuthenticated) {
      return (
        <div className="p-4 text-center">
          <Github className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold mb-2">Sign in with GitHub</h3>
          <p className="text-sm text-gray-600 mb-4">
            Authenticate with GitHub to join collaboration rooms
          </p>
          <button
            onClick={handleAuthenticate}
            disabled={loading}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign in with GitHub'}
          </button>
        </div>
      );
    }

    if (user?.status === 'waitlisted') {
      return (
        <div className="p-4 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
          <h3 className="text-lg font-semibold mb-2">You're on the Waitlist</h3>
          <p className="text-sm text-gray-600">
            Thank you for your interest! You'll be notified when your access is approved.
          </p>
        </div>
      );
    }

    if (user?.status === 'denied') {
      return (
        <div className="p-4 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-sm text-gray-600">
            Your access request has been reviewed and denied.
          </p>
        </div>
      );
    }

    return null;
  };

  const renderCollaborationUI = () => {
    if (!user || user.status !== 'approved') {
      return null;
    }

    if (!repoUrl) {
      return (
        <div className="p-4 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold mb-2">No Repository Selected</h3>
          <p className="text-sm text-gray-600">
            Open a GitHub repository to start collaborating
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Connection Status */}
        <div className="p-3 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Circle 
                className={`w-3 h-3 ${isConnected ? 'text-green-500' : 'text-gray-400'}`}
                fill="currentColor"
              />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : loading ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
            {isConnected && (
              <button
                onClick={disconnect}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Disconnect
              </button>
            )}
          </div>
          {repoUrl && (
            <div className="mt-2 text-xs text-gray-600 truncate">
              Room: {repoUrl}
            </div>
          )}
        </div>

        {/* Peers List */}
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium">
              Active Peers ({peers.filter(p => p.connected).length})
            </span>
          </div>
          <div className="space-y-1">
            {peers.length === 0 ? (
              <div className="text-sm text-gray-500">No other users in room</div>
            ) : (
              peers.map(peer => (
                <div key={peer.peerId} className="flex items-center gap-2 text-sm">
                  <Circle 
                    className={`w-2 h-2 ${peer.connected ? 'text-green-500' : 'text-gray-400'}`}
                    fill="currentColor"
                  />
                  <span>{peer.githubHandle}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={`text-sm ${msg.isLocal ? 'text-right' : 'text-left'}`}
              >
                <div className={`inline-block px-3 py-1 rounded ${
                  msg.isLocal ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <div className="font-medium text-xs text-gray-600">
                    {msg.sender}
                  </div>
                  <div>{msg.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={!isConnected}
            />
            <button
              onClick={sendMessage}
              disabled={!isConnected || !inputMessage.trim()}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Orbit Collaboration</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900"
          >
            ✕
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {renderAuthSection()}
        {renderCollaborationUI()}
      </div>
    </div>
  );
};