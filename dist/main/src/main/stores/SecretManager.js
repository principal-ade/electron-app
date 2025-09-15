/**
 * SecretManager - Secure management of repository secrets and environment variables
 *
 * Features:
 * - Encrypts secrets at rest using Electron's safeStorage
 * - Just-in-time creation/destruction of .env files
 * - In-memory secret storage with automatic cleanup
 * - Repository-scoped secret isolation
 * - Audit logging without exposing sensitive values
 */
import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { getTypedStorageManagerInstance } from './initialization';
import { StaticNamespaces } from '../storage-providers/types';
const fsPromises = {
    writeFile: promisify(fs.writeFile),
    readFile: promisify(fs.readFile),
    unlink: promisify(fs.unlink),
    mkdir: promisify(fs.mkdir),
    access: promisify(fs.access),
    chmod: promisify(fs.chmod),
};
export class SecretManager {
    static instance = null;
    memoryCache = new Map();
    locks = new Map();
    activeEnvFiles = new Set();
    secretsDir;
    auditLog = true;
    cleanupInterval = null;
    initPromise = null;
    initialized = false;
    constructor() {
        this.secretsDir = path.join(app.getPath('userData'), 'secrets');
        this.ensureSecretsDirectory();
        this.startCleanupInterval();
    }
    static getInstance() {
        if (!SecretManager.instance) {
            SecretManager.instance = new SecretManager();
        }
        return SecretManager.instance;
    }
    async ensureSecretsDirectory() {
        try {
            await fsPromises.access(this.secretsDir);
        }
        catch {
            await fsPromises.mkdir(this.secretsDir, { recursive: true });
            if (process.platform !== 'win32') {
                await fsPromises.chmod(this.secretsDir, 0o700);
            }
        }
    }
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleLocks();
            this.cleanupOrphanedEnvFiles();
        }, 60000); // Run every minute
    }
    cleanupStaleLocks() {
        const now = Date.now();
        const staleTimeout = 5 * 60 * 1000; // 5 minutes
        // Convert to array to avoid iterator issues
        const entries = Array.from(this.locks.entries());
        for (const [repoId, lock] of entries) {
            if (now - lock.timestamp > staleTimeout) {
                this.logAudit('warn', `Removing stale lock for ${repoId}`, { lockId: lock.lockId });
                this.locks.delete(repoId);
            }
        }
    }
    async cleanupOrphanedEnvFiles() {
        // Convert to array to avoid iterator issues
        const envPaths = Array.from(this.activeEnvFiles);
        for (const envPath of envPaths) {
            try {
                await fsPromises.access(envPath);
                const stats = await fs.promises.stat(envPath);
                const ageMs = Date.now() - stats.mtimeMs;
                // Remove env files older than 2 minutes
                if (ageMs > 2 * 60 * 1000) {
                    await this.removeEnvFile(envPath);
                    this.logAudit('info', 'Cleaned up orphaned env file', { path: envPath });
                }
            }
            catch {
                // File doesn't exist, remove from tracking
                this.activeEnvFiles.delete(envPath);
            }
        }
    }
    /**
     * Generate a storage key for a repository
     */
    getStorageKey(repoId) {
        const hash = crypto.createHash('sha256').update(repoId).digest('hex');
        return `secrets_${hash.substring(0, 16)}`;
    }
    /**
     * Store secrets for a repository
     */
    async storeSecrets(repoId, repoPath, secrets) {
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                return {
                    success: false,
                    error: 'Encryption not available on this system'
                };
            }
            // Validate inputs
            if (!this.validateRepoId(repoId)) {
                return { success: false, error: 'Invalid repository ID' };
            }
            if (!this.validateSecrets(secrets)) {
                return { success: false, error: 'Invalid secrets format' };
            }
            // Encrypt secrets
            const secretsJson = JSON.stringify(secrets);
            const encrypted = safeStorage.encryptString(secretsJson);
            // Create metadata
            const metadata = {
                repoId,
                repoPath,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                secretCount: Object.keys(secrets).length,
            };
            // Store to disk
            const storageKey = this.getStorageKey(repoId);
            const storagePath = path.join(this.secretsDir, `${storageKey}.enc`);
            const stored = {
                encrypted,
                metadata,
            };
            await fsPromises.writeFile(storagePath, JSON.stringify({
                ...stored,
                encrypted: encrypted.toString('base64'),
            }), { mode: 0o600 });
            // Update memory cache
            this.memoryCache.set(repoId, secrets);
            // Store metadata in typed storage
            const storageManager = await getTypedStorageManagerInstance();
            await storageManager.set(storageKey, metadata, StaticNamespaces.SECRETS_METADATA);
            this.logAudit('info', `Stored ${metadata.secretCount} secrets for repository`, { repoId });
            return { success: true, metadata };
        }
        catch (error) {
            this.logAudit('error', 'Failed to store secrets', { repoId, error: error.message });
            return { success: false, error: error.message };
        }
    }
    /**
     * Retrieve secrets for a repository
     */
    async getSecrets(repoId) {
        try {
            // Check memory cache first
            if (this.memoryCache.has(repoId)) {
                return this.memoryCache.get(repoId);
            }
            // Load from disk
            const storageKey = this.getStorageKey(repoId);
            const storagePath = path.join(this.secretsDir, `${storageKey}.enc`);
            try {
                const fileContent = await fsPromises.readFile(storagePath, 'utf-8');
                const stored = JSON.parse(fileContent);
                const encrypted = Buffer.from(stored.encrypted, 'base64');
                const decrypted = safeStorage.decryptString(encrypted);
                const secrets = JSON.parse(decrypted);
                // Update cache
                this.memoryCache.set(repoId, secrets);
                return secrets;
            }
            catch {
                return null;
            }
        }
        catch (error) {
            this.logAudit('error', 'Failed to retrieve secrets', { repoId, error: error.message });
            return null;
        }
    }
    /**
     * Delete secrets for a repository
     */
    async deleteSecrets(repoId) {
        try {
            const storageKey = this.getStorageKey(repoId);
            const storagePath = path.join(this.secretsDir, `${storageKey}.enc`);
            // Remove from disk
            try {
                await fsPromises.unlink(storagePath);
            }
            catch {
                // File might not exist
            }
            // Remove from cache
            this.memoryCache.delete(repoId);
            // Remove metadata
            const storageManager = await getTypedStorageManagerInstance();
            await storageManager.delete(storageKey, StaticNamespaces.SECRETS_METADATA);
            this.logAudit('info', 'Deleted secrets for repository', { repoId });
            return { success: true };
        }
        catch (error) {
            this.logAudit('error', 'Failed to delete secrets', { repoId, error: error.message });
            return { success: false, error: error.message };
        }
    }
    /**
     * Execute a function with environment variables temporarily available
     */
    async withEnvFile(repoId, workDir, callback, options = {}) {
        const envPath = path.join(workDir, '.env');
        const lockId = crypto.randomBytes(16).toString('hex');
        // Acquire lock
        await this.acquireLock(repoId, lockId);
        try {
            // Get secrets
            const secrets = await this.getSecrets(repoId);
            if (secrets && Object.keys(secrets).length > 0) {
                // Create .env file
                await this.createEnvFile(envPath, secrets, options);
                this.activeEnvFiles.add(envPath);
            }
            // Execute callback
            const result = await callback();
            return result;
        }
        finally {
            // Always cleanup
            await this.removeEnvFile(envPath);
            this.activeEnvFiles.delete(envPath);
            this.releaseLock(repoId, lockId);
        }
    }
    /**
     * Create a temporary .env file
     */
    async createEnvFile(envPath, secrets, options = {}) {
        const mode = options.mode || 0o600;
        const encoding = options.encoding || 'utf-8';
        // Format as .env content
        const envContent = Object.entries(secrets)
            .map(([key, value]) => {
            // Escape quotes in values
            const escapedValue = value.replace(/"/g, '\\"');
            return `${key}="${escapedValue}"`;
        })
            .join('\n');
        // Write with restricted permissions
        await fsPromises.writeFile(envPath, envContent, { mode, encoding });
        this.logAudit('info', 'Created temporary .env file', { path: envPath });
    }
    /**
     * Remove an .env file
     */
    async removeEnvFile(envPath) {
        try {
            await fsPromises.unlink(envPath);
            this.logAudit('info', 'Removed temporary .env file', { path: envPath });
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                this.logAudit('warn', 'Failed to remove .env file', { path: envPath, error: error.message });
            }
        }
    }
    /**
     * Acquire a lock for a repository
     */
    async acquireLock(repoId, lockId) {
        const maxWaitTime = 10000; // 10 seconds
        const checkInterval = 100; // 100ms
        const startTime = Date.now();
        while (this.locks.has(repoId)) {
            if (Date.now() - startTime > maxWaitTime) {
                throw new Error(`Timeout acquiring lock for repository ${repoId}`);
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        this.locks.set(repoId, {
            repoId,
            lockId,
            timestamp: Date.now(),
            pid: process.pid,
        });
    }
    /**
     * Release a lock for a repository
     */
    releaseLock(repoId, lockId) {
        const lock = this.locks.get(repoId);
        if (lock && lock.lockId === lockId) {
            this.locks.delete(repoId);
        }
    }
    /**
     * Validate repository ID
     */
    validateRepoId(repoId) {
        if (!repoId || typeof repoId !== 'string') {
            return false;
        }
        // Allow alphanumeric, dash, underscore, slash (for org/repo format)
        return /^[a-zA-Z0-9\-_\/]+$/.test(repoId);
    }
    /**
     * Validate secrets object
     */
    validateSecrets(secrets) {
        if (!secrets || typeof secrets !== 'object') {
            return false;
        }
        for (const [key, value] of Object.entries(secrets)) {
            // Validate key format (environment variable name)
            if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
                return false;
            }
            // Validate value is string
            if (typeof value !== 'string') {
                return false;
            }
            // Prevent injection attacks
            if (value.includes('\0')) {
                return false;
            }
        }
        return true;
    }
    /**
     * Log audit events without exposing sensitive data
     */
    logAudit(level, message, meta = {}) {
        if (!this.auditLog)
            return;
        // Never log actual secret values
        const sanitizedMeta = { ...meta };
        delete sanitizedMeta.secrets;
        delete sanitizedMeta.value;
        const timestamp = new Date().toISOString();
        const logMessage = `[SecretManager] [${timestamp}] [${level.toUpperCase()}] ${message}`;
        console.log(logMessage, sanitizedMeta);
    }
    /**
     * Get metadata for all stored secrets
     */
    async getAllMetadata() {
        try {
            const storageManager = await getTypedStorageManagerInstance();
            const keys = await storageManager.keys(StaticNamespaces.SECRETS_METADATA);
            const metadata = [];
            for (const key of keys) {
                const result = await storageManager.get(key, StaticNamespaces.SECRETS_METADATA);
                if (result.success && result.data) {
                    metadata.push(result.data);
                }
            }
            return metadata;
        }
        catch (error) {
            this.logAudit('error', 'Failed to get metadata', { error: error.message });
            return [];
        }
    }
    /**
     * Clear all in-memory caches
     */
    clearCache() {
        this.memoryCache.clear();
        this.logAudit('info', 'Cleared in-memory cache');
    }
    /**
     * Cleanup on shutdown
     */
    async shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        // Remove any remaining env files
        const envPaths = Array.from(this.activeEnvFiles);
        for (const envPath of envPaths) {
            await this.removeEnvFile(envPath);
        }
        this.memoryCache.clear();
        this.locks.clear();
        this.activeEnvFiles.clear();
        this.logAudit('info', 'SecretManager shutdown complete');
    }
}
