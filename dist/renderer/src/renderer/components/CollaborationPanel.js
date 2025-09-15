import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Users, Circle, Github, AlertCircle, Clock } from 'lucide-react';
import { PeerManager } from '../services/p2p/PeerManager';
import { SignalingClient } from '../services/p2p/SignalingClient';
import { GitHubAuth } from '../services/p2p/GitHubAuth';
export const CollaborationPanel = ({ repoUrl, onClose }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [peers, setPeers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const peerManagerRef = useRef(null);
    const signalingClientRef = useRef(null);
    const authRef = useRef(null);
    const myPeerIdRef = useRef('');
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
            const result = await authRef.current.authenticate();
            if (result.success && result.user) {
                setUser(result.user);
                setIsAuthenticated(true);
                if (result.user.status === 'waitlisted') {
                    setError('You are on the waitlist. Please wait for approval to access collaboration features.');
                }
                else if (result.user.status === 'denied') {
                    setError('Your access request has been denied.');
                }
            }
            else {
                setError(result.error || 'Authentication failed');
            }
        }
        catch (err) {
            setError('Failed to authenticate with GitHub');
        }
        finally {
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
                    const peer = peerManagerRef.current?.createPeer(peerId, githubHandle, true, (signal) => {
                        signalingClientRef.current?.sendSignal(peerId, signal);
                    });
                },
                onPeerLeft: (peerId) => {
                    // Peer manager will handle cleanup
                },
                onSignal: (from, signal) => {
                    // Handle incoming signals
                    const existingPeer = peerManagerRef.current?.getPeers().find(p => p.peerId === from);
                    if (!existingPeer) {
                        // Create new peer as receiver
                        peerManagerRef.current?.createPeer(from, 'Unknown', // Will be updated on handshake
                        false, (signal) => {
                            signalingClientRef.current?.sendSignal(from, signal);
                        });
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
            const token = authRef.current.getToken();
            signalingClientRef.current.connect(token, repoUrl);
        }
        catch (err) {
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
    const handlePeerData = (peerId, data) => {
        switch (data.type) {
            case 'chat':
                const message = {
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
        const message = {
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
            return (_jsxs("div", { className: "p-4 text-center", children: [_jsx(Github, { className: "w-12 h-12 mx-auto mb-4 text-gray-600" }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "Sign in with GitHub" }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Authenticate with GitHub to join collaboration rooms" }), _jsx("button", { onClick: handleAuthenticate, disabled: loading, className: "px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50", children: loading ? 'Authenticating...' : 'Sign in with GitHub' })] }));
        }
        if (user?.status === 'waitlisted') {
            return (_jsxs("div", { className: "p-4 text-center", children: [_jsx(Clock, { className: "w-12 h-12 mx-auto mb-4 text-yellow-600" }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "You're on the Waitlist" }), _jsx("p", { className: "text-sm text-gray-600", children: "Thank you for your interest! You'll be notified when your access is approved." })] }));
        }
        if (user?.status === 'denied') {
            return (_jsxs("div", { className: "p-4 text-center", children: [_jsx(AlertCircle, { className: "w-12 h-12 mx-auto mb-4 text-red-600" }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "Access Denied" }), _jsx("p", { className: "text-sm text-gray-600", children: "Your access request has been reviewed and denied." })] }));
        }
        return null;
    };
    const renderCollaborationUI = () => {
        if (!user || user.status !== 'approved') {
            return null;
        }
        if (!repoUrl) {
            return (_jsxs("div", { className: "p-4 text-center", children: [_jsx(AlertCircle, { className: "w-12 h-12 mx-auto mb-4 text-gray-600" }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "No Repository Selected" }), _jsx("p", { className: "text-sm text-gray-600", children: "Open a GitHub repository to start collaborating" })] }));
        }
        return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "p-3 border-b bg-gray-50", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Circle, { className: `w-3 h-3 ${isConnected ? 'text-green-500' : 'text-gray-400'}`, fill: "currentColor" }), _jsx("span", { className: "text-sm font-medium", children: isConnected ? 'Connected' : loading ? 'Connecting...' : 'Disconnected' })] }), isConnected && (_jsx("button", { onClick: disconnect, className: "text-sm text-gray-600 hover:text-gray-900", children: "Disconnect" }))] }), repoUrl && (_jsxs("div", { className: "mt-2 text-xs text-gray-600 truncate", children: ["Room: ", repoUrl] }))] }), _jsxs("div", { className: "p-3 border-b", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Users, { className: "w-4 h-4 text-gray-600" }), _jsxs("span", { className: "text-sm font-medium", children: ["Active Peers (", peers.filter(p => p.connected).length, ")"] })] }), _jsx("div", { className: "space-y-1", children: peers.length === 0 ? (_jsx("div", { className: "text-sm text-gray-500", children: "No other users in room" })) : (peers.map(peer => (_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx(Circle, { className: `w-2 h-2 ${peer.connected ? 'text-green-500' : 'text-gray-400'}`, fill: "currentColor" }), _jsx("span", { children: peer.githubHandle })] }, peer.peerId)))) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-3", children: _jsx("div", { className: "space-y-2", children: messages.map(msg => (_jsx("div", { className: `text-sm ${msg.isLocal ? 'text-right' : 'text-left'}`, children: _jsxs("div", { className: `inline-block px-3 py-1 rounded ${msg.isLocal ? 'bg-blue-100' : 'bg-gray-100'}`, children: [_jsx("div", { className: "font-medium text-xs text-gray-600", children: msg.sender }), _jsx("div", { children: msg.message })] }) }, msg.id))) }) }), _jsx("div", { className: "p-3 border-t", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: inputMessage, onChange: (e) => setInputMessage(e.target.value), onKeyPress: (e) => e.key === 'Enter' && sendMessage(), placeholder: "Type a message...", className: "flex-1 px-3 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500", disabled: !isConnected }), _jsx("button", { onClick: sendMessage, disabled: !isConnected || !inputMessage.trim(), className: "px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50", children: "Send" })] }) })] }));
    };
    return (_jsxs("div", { className: "h-full flex flex-col bg-white", children: [_jsxs("div", { className: "p-3 border-b bg-gray-50 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Orbit Collaboration" }), onClose && (_jsx("button", { onClick: onClose, className: "text-gray-600 hover:text-gray-900", children: "\u2715" }))] }), error && (_jsx("div", { className: "p-3 bg-red-50 text-red-700 text-sm", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 mt-0.5" }), _jsx("div", { children: error })] }) })), _jsxs("div", { className: "flex-1 overflow-hidden", children: [renderAuthSection(), renderCollaborationUI()] })] }));
};
