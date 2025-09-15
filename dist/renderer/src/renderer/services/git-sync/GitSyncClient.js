import { EventEmitter } from 'events';
export class GitSyncClient extends EventEmitter {
    ws = null;
    config;
    status;
    reconnectTimer = null;
    pingInterval = null;
    messageQueue = [];
    isReconnecting = false;
    roomToken = null;
    constructor(config) {
        super();
        this.config = config;
        this.status = {
            connected: false,
            authenticated: false,
            repoId: this.extractRepoId(config.repoUrl),
            branch: config.branch,
            activeLocks: [],
            queuedLocks: 0,
            peers: []
        };
    }
    /**
     * Connect to the git-sync server
     */
    async connect() {
        // If in proxy mode, just emit connected event - actual connection handled by main process
        if (this.config.proxyMode) {
            this.status.connected = true;
            this.status.authenticated = true;
            this.emit('connected');
            this.emit('authenticated');
            return Promise.resolve();
        }
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }
        // First, get room token from OAuth server
        await this.getRoomToken();
        return new Promise((resolve, reject) => {
            try {
                // Properly convert HTTP URL to WebSocket URL
                let wsUrl = this.config.serverUrl;
                if (wsUrl.startsWith('https://')) {
                    wsUrl = wsUrl.replace('https://', 'wss://');
                }
                else if (wsUrl.startsWith('http://')) {
                    wsUrl = wsUrl.replace('http://', 'ws://');
                }
                // Create WebSocket - will authenticate via message after connection
                this.ws = new WebSocket(`${wsUrl}/ws`);
                this.ws.onopen = () => {
                    console.log('Connected to git-sync server');
                    this.status.connected = true;
                    this.isReconnecting = false;
                    // Authenticate immediately
                    this.authenticate();
                    // Start ping interval
                    this.startPingInterval();
                    // Process queued messages
                    this.processMessageQueue();
                    this.emit('connected');
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    }
                    catch (error) {
                        console.error('Failed to parse message:', error);
                    }
                };
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                };
                this.ws.onclose = () => {
                    console.log('Disconnected from git-sync server');
                    this.status.connected = false;
                    this.status.authenticated = false;
                    this.stopPingInterval();
                    this.emit('disconnected');
                    // Auto-reconnect if not manually disconnected
                    if (!this.isReconnecting) {
                        this.scheduleReconnect();
                    }
                };
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Get room token from OAuth server via main process
     */
    async getRoomToken() {
        try {
            const repository = this.extractRepoId(this.config.repoUrl);
            console.log(`Getting room token for repository: ${repository}`);
            // Import GitSyncService dynamically to avoid circular imports
            const { GitSyncService } = await import('../../main-process-api/GitSyncService');
            const result = await GitSyncService.getRoomToken({
                repositoryId: repository,
                branch: this.config.branch,
                isOwner: true // TODO: Determine this properly
            });
            if (!result.success) {
                throw new Error(result.error || 'Failed to get room token');
            }
            this.roomToken = {
                access_token: result.token || '',
                permissions: { canWrite: true, canRead: true }, // Default permissions
                repository,
                branch: this.config.branch,
                expiresIn: 3600 // 1 hour default
            };
            console.log(`Room token obtained for ${this.roomToken.repository} (${this.roomToken.permissions.canWrite ? 'write' : 'read'} access)`);
        }
        catch (error) {
            console.error('Failed to get room token:', error);
            throw error;
        }
    }
    /**
     * Authenticate with the server using room token
     */
    async authenticate() {
        try {
            if (!this.roomToken) {
                throw new Error('No room token available');
            }
            // Use room token JWT for authentication
            this.send({
                type: 'auth',
                token: this.roomToken.access_token, // JWT room token from OAuth server
                repoId: this.extractRepoId(this.config.repoUrl),
                agentId: this.config.agentId,
                userId: this.config.userId,
                branch: this.config.branch,
                watchingBranches: ['main', 'master', this.config.branch]
            });
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    /**
     * Register for sync events
     */
    registerForSync() {
        this.send({
            type: 'register',
            repoId: this.status.repoId,
            branch: this.config.branch,
            agentId: this.config.agentId,
            userId: this.config.userId
        });
    }
    /**
     * Acquire a lock on a resource
     */
    async acquireLock(request) {
        return new Promise((resolve) => {
            const requestId = this.generateRequestId();
            const handler = (message) => {
                if (message.type === 'lock_response' && message.requestId === requestId) {
                    this.removeListener('lock_response', handler);
                    if (message.success && message.lock) {
                        this.status.activeLocks.push(message.lock);
                    }
                    resolve({
                        success: message.success,
                        lock: message.lock,
                        error: message.error,
                        warnings: message.warnings
                    });
                }
            };
            this.on('lock_response', handler);
            this.send({
                type: 'acquire_lock',
                requestId,
                resource: request.resource,
                resourceType: request.type,
                branch: this.config.branch,
                exclusive: request.exclusive ?? true,
                duration: request.duration,
                metadata: request.metadata
            });
            // Timeout after 10 seconds
            setTimeout(() => {
                this.removeListener('lock_response', handler);
                resolve({
                    success: false,
                    error: 'Lock request timed out'
                });
            }, 10000);
        });
    }
    /**
     * Release a lock
     */
    async releaseLock(lockId) {
        return new Promise((resolve) => {
            const requestId = this.generateRequestId();
            const handler = (message) => {
                if (message.type === 'lock_released' && message.requestId === requestId) {
                    this.removeListener('lock_released', handler);
                    // Remove from active locks
                    this.status.activeLocks = this.status.activeLocks.filter(l => l.id !== lockId);
                    resolve(message.success);
                }
            };
            this.on('lock_released', handler);
            this.send({
                type: 'release_lock',
                requestId,
                lockId
            });
            // Timeout after 5 seconds
            setTimeout(() => {
                this.removeListener('lock_released', handler);
                resolve(false);
            }, 5000);
        });
    }
    /**
     * Broadcast a sync event
     */
    broadcastEvent(event) {
        this.send({
            type: 'sync_event',
            event: {
                ...event,
                agentId: this.config.agentId,
                timestamp: Date.now()
            }
        });
    }
    /**
     * Check if a merge is safe
     */
    async checkMergeSafety(toBranch, files) {
        return new Promise((resolve) => {
            const requestId = this.generateRequestId();
            const handler = (message) => {
                if (message.type === 'merge_safety_response' && message.requestId === requestId) {
                    this.removeListener('merge_safety_response', handler);
                    resolve(message);
                }
            };
            this.on('merge_safety_response', handler);
            this.send({
                type: 'check_merge_safety',
                requestId,
                fromBranch: this.config.branch,
                toBranch,
                files
            });
            // Timeout after 5 seconds
            setTimeout(() => {
                this.removeListener('merge_safety_response', handler);
                resolve({
                    safe: true,
                    blockingLocks: [],
                    warnings: []
                });
            }, 5000);
        });
    }
    /**
     * Switch to a different branch
     */
    async switchBranch(newBranch) {
        return new Promise((resolve) => {
            const requestId = this.generateRequestId();
            const handler = (message) => {
                if (message.type === 'branch_switched' && message.requestId === requestId) {
                    this.removeListener('branch_switched', handler);
                    // Update our branch
                    this.config.branch = newBranch;
                    this.status.branch = newBranch;
                    // Clear active locks
                    this.status.activeLocks = [];
                    resolve({
                        success: true,
                        released: message.released,
                        warnings: message.warnings
                    });
                }
            };
            this.on('branch_switched', handler);
            this.send({
                type: 'switch_branch',
                requestId,
                fromBranch: this.config.branch,
                toBranch: newBranch
            });
            // Timeout after 5 seconds
            setTimeout(() => {
                this.removeListener('branch_switched', handler);
                resolve({
                    success: false,
                    released: 0,
                    warnings: []
                });
            }, 5000);
        });
    }
    /**
     * Get current sync status
     */
    getStatus() {
        return { ...this.status };
    }
    /**
     * Disconnect from the server
     */
    disconnect() {
        this.isReconnecting = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.stopPingInterval();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.status.connected = false;
        this.status.authenticated = false;
        this.emit('disconnected');
    }
    /**
     * Handle incoming messages
     */
    handleMessage(message) {
        switch (message.type) {
            case 'auth_response':
            case 'auth_success':
                if (message.success || message.type === 'auth_success') {
                    this.status.authenticated = true;
                    // Handle initial peers list if provided
                    if (message.peers && Array.isArray(message.peers)) {
                        this.status.peers = message.peers;
                    }
                    this.registerForSync();
                    this.emit('authenticated');
                }
                else {
                    this.emit('error', new Error(message.error || 'Authentication failed'));
                }
                break;
            case 'register_response':
                if (message.success) {
                    this.emit('registered', message.room);
                }
                break;
            case 'sync_event':
                this.emit('sync_event', message.event);
                break;
            case 'lock_acquired':
                this.emit('lock_acquired', message.lock);
                break;
            case 'lock_released':
                const releasedLock = this.status.activeLocks.find(l => l.id === message.lockId);
                if (releasedLock) {
                    this.status.activeLocks = this.status.activeLocks.filter(l => l.id !== message.lockId);
                    this.emit('lock_released_event', releasedLock);
                }
                break;
            case 'cross_branch_warning':
                this.emit('cross_branch_warning', message.warning);
                break;
            case 'peer_joined':
                this.status.peers.push(message.peer);
                this.emit('peer_joined', message.peer);
                break;
            case 'peer_left':
                this.status.peers = this.status.peers.filter(p => p.agentId !== message.agentId);
                this.emit('peer_left', message.agentId);
                break;
            case 'lock_response':
            case 'merge_safety_response':
            case 'branch_switched':
                // These are handled by specific request handlers
                this.emit(message.type, message);
                break;
            case 'pong':
                // Keep-alive response
                break;
            case 'auth_error':
                console.error('Authentication failed:', message.message || 'Invalid token');
                this.status.isAuthenticated = false;
                this.emit('auth_error', message.message || 'Authentication failed');
                this.disconnect();
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }
    /**
     * Send a message to the server
     */
    send(message) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
        else {
            // Queue message for when we reconnect
            this.messageQueue.push(message);
        }
    }
    /**
     * Process queued messages
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }
    /**
     * Schedule reconnection
     */
    scheduleReconnect() {
        if (this.isReconnecting)
            return;
        this.isReconnecting = true;
        this.reconnectTimer = setTimeout(() => {
            console.log('Attempting to reconnect...');
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
                this.scheduleReconnect();
            });
        }, 5000);
    }
    /**
     * Start ping interval
     */
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' });
        }, 30000);
    }
    /**
     * Stop ping interval
     */
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    /**
     * Extract repository ID from URL
     */
    extractRepoId(repoUrl) {
        const match = repoUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
        return match ? match[1] : repoUrl;
    }
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
