import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Circle, MessageSquare, Github, AlertCircle, 
  CheckCircle, Clock, GitBranch, GitCommit, RefreshCw,
  AlertTriangle, ArrowUpDown, Check
} from 'lucide-react';
import { PeerManager, PeerInfo } from '../services/p2p/PeerManager';
import { SignalingClient } from '../services/p2p/SignalingClientHTTP';
import { GitHubAuth, GitHubUser } from '../services/p2p/GitHubAuthDirect';
import { GitSyncManager, SyncStatus } from '../services/p2p/GitSyncManager';
import { OAuthCallbackModal } from './OAuthCallbackModal';

interface CollaborationPanelWithSyncProps {
  repoUrl?: string;
  repoPath?: string; // Local path to the repository
  onClose?: () => void;
  isMinimized?: boolean;
}

interface PeerSyncInfo {
  peerId: string;
  githubHandle: string;
  connected: boolean;
  syncStatus?: SyncStatus;
}

export const CollaborationPanelWithSync: React.FC<CollaborationPanelWithSyncProps> = ({ 
  repoUrl, 
  repoPath,
  onClose,
  isMinimized = false 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [peerSyncInfo, setPeerSyncInfo] = useState<Map<string, SyncStatus>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null); // peerId being synced
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  
  const peerManagerRef = useRef<PeerManager | null>(null);
  const signalingClientRef = useRef<SignalingClient | null>(null);
  const authRef = useRef<GitHubAuth | null>(null);
  const gitSyncManagerRef = useRef<GitSyncManager | null>(null);

  useEffect(() => {
    initializeAuth();
    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.status === 'approved' && repoUrl && repoPath) {
      connectToRoom();
    }
  }, [isAuthenticated, user, repoUrl, repoPath]);

  const initializeAuth = async () => {
    authRef.current = GitHubAuth.getInstance();
    const status = await authRef.current.checkStatus();
    
    if (status.user) {
      setUser(status.user);
      setIsAuthenticated(true);
    }
  };

  const connectToRoom = async () => {
    if (!repoUrl || !repoPath || !authRef.current?.getToken()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Initialize peer manager
      peerManagerRef.current = new PeerManager();
      
      // Initialize git sync manager
      gitSyncManagerRef.current = new GitSyncManager(peerManagerRef.current);
      gitSyncManagerRef.current.setCallbacks({
        onSyncUpdate: (status, peerId) => {
          setPeerSyncInfo(prev => {
            const newMap = new Map(prev);
            newMap.set(peerId, status);
            return newMap;
          });
        },
        onConflict: (files) => {
          setConflicts(files);
          setError(`Conflicts detected in: ${files.join(', ')}`);
        },
      });

      // Initialize sync for the repository
      await gitSyncManagerRef.current.initializeSync(repoPath);

      peerManagerRef.current.setCallbacks({
        onPeerUpdate: (updatedPeers) => {
          setPeers(updatedPeers);
          // Request sync status from new peers
          updatedPeers.forEach(peer => {
            if (peer.connected && !peerSyncInfo.has(peer.peerId)) {
              gitSyncManagerRef.current?.requestSync(peer.peerId);
            }
          });
        },
        onDataReceived: () => {
          // Handled by GitSyncManager
        },
      });

      // Initialize signaling client
      signalingClientRef.current = new SignalingClient();
      signalingClientRef.current.setCallbacks({
        onConnected: (peerId, githubHandle) => {
          peerManagerRef.current?.setIdentity(peerId, githubHandle);
          setIsConnected(true);
          setLoading(false);
        },
        onPeerJoined: (peerId, githubHandle) => {
          const peer = peerManagerRef.current?.createPeer(
            peerId,
            githubHandle,
            true,
            (signal) => {
              signalingClientRef.current?.sendSignal(peerId, signal);
            }
          );
        },
        onPeerLeft: () => {},
        onSignal: (from, signal) => {
          const existingPeer = peerManagerRef.current?.getPeers().find(p => p.peerId === from);
          
          if (!existingPeer) {
            peerManagerRef.current?.createPeer(
              from,
              'Unknown',
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
    setPeerSyncInfo(new Map());
  };

  const handleSync = async (peerId: string) => {
    if (!gitSyncManagerRef.current) return;
    
    setSyncing(peerId);
    setError(null);
    
    try {
      const result = await gitSyncManagerRef.current.performSync(peerId);
      
      if (result.success) {
        // Broadcast our new state to all peers
        await gitSyncManagerRef.current.broadcastSyncState();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Sync failed: ' + err);
    } finally {
      setSyncing(null);
    }
  };

  const handleBroadcastChanges = async () => {
    if (!gitSyncManagerRef.current) return;
    
    try {
      await gitSyncManagerRef.current.broadcastSyncState();
      setError(null);
    } catch (err) {
      setError('Failed to broadcast changes');
    }
  };

  // Minimized view - just show connection status
  if (isMinimized) {
    return (
      <button
        onClick={() => onClose?.()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: isConnected ? '#10b98122' : '#6b728022',
          border: `1px solid ${isConnected ? '#10b981' : '#6b7280'}`,
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          color: isConnected ? '#10b981' : '#6b7280',
          cursor: 'pointer',
        }}
      >
        <Users size={14} />
        {isConnected ? (
          <>
            <Circle size={8} fill="currentColor" />
            {peers.filter(p => p.connected).length + 1} users
          </>
        ) : (
          'Orbit'
        )}
      </button>
    );
  }

  // Full panel view
  return (
    <div style={{
      position: 'fixed',
      right: '20px',
      top: '80px',
      width: '360px',
      maxHeight: '600px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
            Orbit Collaboration
          </h3>
          {isConnected && (
            <Circle size={8} fill="#10b981" />
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          fontSize: '13px',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'start',
          gap: '8px',
        }}>
          <AlertCircle size={14} style={{ marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!isAuthenticated ? (
          // Authentication required
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <Github size={32} style={{ marginBottom: '12px', color: '#6b7280' }} />
            <p style={{ marginBottom: '16px', color: '#6b7280' }}>
              Sign in to join collaboration
            </p>
            <button
              onClick={async () => {
                setShowOAuthModal(true);
                // Start the authentication process
                const result = await authRef.current?.authenticate();
                if (result?.success && result.user) {
                  setUser(result.user);
                  setIsAuthenticated(true);
                } else if (result?.error) {
                  setError(result.error);
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#111827',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Sign in with GitHub
            </button>
          </div>
        ) : user?.status !== 'approved' ? (
          // Waitlist status
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <Clock size={32} style={{ marginBottom: '12px', color: '#f59e0b' }} />
            <p style={{ color: '#6b7280' }}>
              {user?.status === 'waitlisted' 
                ? "You're on the waitlist"
                : "Access denied"}
            </p>
          </div>
        ) : (
          // Connected and approved
          <>
            {/* Sync Status Section */}
            <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitBranch size={14} />
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>
                    Git Sync Status
                  </span>
                </div>
                <button
                  onClick={handleBroadcastChanges}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  title="Broadcast your current changes to peers"
                >
                  <RefreshCw size={12} />
                  Broadcast
                </button>
              </div>
              
              {/* Show overall sync status */}
              {gitSyncManagerRef.current?.areAllPeersSynced() ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#16a34a',
                }}>
                  <CheckCircle size={14} />
                  All peers synced
                </div>
              ) : peers.length === 0 ? (
                <div style={{
                  padding: '6px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#6b7280',
                }}>
                  No peers connected
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#d97706',
                }}>
                  <AlertCircle size={14} />
                  Sync needed with some peers
                </div>
              )}
            </div>

            {/* Peers List with Sync Status */}
            <div style={{ padding: '12px' }}>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: 500, 
                marginBottom: '8px',
                color: '#4b5563'
              }}>
                Active Peers ({peers.filter(p => p.connected).length})
              </div>
              
              {peers.length === 0 ? (
                <div style={{ 
                  fontSize: '13px', 
                  color: '#9ca3af',
                  fontStyle: 'italic' 
                }}>
                  No other users in room
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {peers.map(peer => {
                    const syncStatus = peerSyncInfo.get(peer.peerId);
                    const isSyncing = syncing === peer.peerId;
                    
                    return (
                      <div 
                        key={peer.peerId}
                        style={{
                          padding: '8px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                          }}>
                            <Circle 
                              size={8} 
                              fill={peer.connected ? '#10b981' : '#6b7280'}
                            />
                            <span>{peer.githubHandle}</span>
                          </div>
                          
                          {peer.connected && syncStatus && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {syncStatus.isSynced ? (
                                <Check size={14} color="#10b981" />
                              ) : syncStatus.conflicts.length > 0 ? (
                                <AlertTriangle size={14} color="#ef4444" />
                              ) : (
                                <button
                                  onClick={() => handleSync(peer.peerId)}
                                  disabled={isSyncing}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    backgroundColor: isSyncing ? '#e5e7eb' : '#3b82f6',
                                    color: isSyncing ? '#6b7280' : 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: isSyncing ? 'wait' : 'pointer',
                                  }}
                                >
                                  <ArrowUpDown size={12} />
                                  {isSyncing ? 'Syncing...' : 'Sync'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Sync details */}
                        {syncStatus && !syncStatus.isSynced && (
                          <div style={{
                            marginTop: '6px',
                            paddingTop: '6px',
                            borderTop: '1px solid #e5e7eb',
                            fontSize: '11px',
                            color: '#6b7280',
                          }}>
                            {syncStatus.conflicts.length > 0 ? (
                              <span style={{ color: '#ef4444' }}>
                                Conflicts: {syncStatus.conflicts.join(', ')}
                              </span>
                            ) : (
                              <span>
                                {syncStatus.pendingChanges} file(s) to sync
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* OAuth Callback Modal */}
      <OAuthCallbackModal
        isOpen={showOAuthModal}
        onClose={() => setShowOAuthModal(false)}
        onCodeSubmit={(token) => {
          // User is pasting the token, not the OAuth code
          authRef.current?.submitOAuthCode(token);
          setShowOAuthModal(false);
        }}
      />
    </div>
  );
};