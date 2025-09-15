/**
 * AlexandriaRegistryService - Service for managing Alexandria repositories
 * Uses AlexandriaOutpostManager from @a24z/core-library for local repository management
 */
import { AlexandriaOutpostManager, NodeFileSystemAdapter } from '@a24z/core-library';
export class AlexandriaRegistryService {
    static instance;
    outpostManager;
    initialized = false;
    constructor() {
        // Create filesystem adapter and outpost manager
        const fsAdapter = new NodeFileSystemAdapter();
        this.outpostManager = new AlexandriaOutpostManager(fsAdapter);
    }
    static getInstance() {
        if (!AlexandriaRegistryService.instance) {
            AlexandriaRegistryService.instance = new AlexandriaRegistryService();
        }
        return AlexandriaRegistryService.instance;
    }
    /**
     * Get all repositories with path information
     */
    async getRepositories() {
        // Use getAllEntries to get repositories with path information
        return this.outpostManager.getAllEntries();
    }
    /**
     * Get repository by name
     */
    async getRepository(name) {
        // Get all entries and find by name
        const entries = this.outpostManager.getAllEntries();
        return entries.find(e => e.name === name) || null;
    }
    /**
     * Get repository by local path
     */
    async getRepositoryByPath(path) {
        // Get all entries and find by path
        const entries = this.outpostManager.getAllEntries();
        return entries.find(e => e.path === path) || null;
    }
    /**
     * Register a new repository with local path
     */
    async registerRepository(name, path) {
        // Register and then get the entry with path
        await this.outpostManager.registerRepository(name, path);
        const entry = this.outpostManager.getAllEntries().find(e => e.name === name);
        if (!entry) {
            throw new Error(`Failed to get entry after registration for ${name}`);
        }
        return entry;
    }
    /**
     * Add a repository from a remote URL (for UI compatibility)
     * This will register it without a local path initially
     */
    async addRepository(params) {
        // If we have a local path, register it properly
        if (params.localPath) {
            return this.registerRepository(params.name, params.localPath);
        }
        // Otherwise, we need to handle remote-only repos differently
        // For now, throw an error since AlexandriaOutpostManager requires a local path
        throw new Error('Remote-only repositories are not yet supported. Please provide a local path.');
    }
    /**
     * Remove a repository by name
     */
    async removeRepository(name) {
        // AlexandriaOutpostManager doesn't have a remove method yet
        // We'll need to request this feature or implement it differently
        console.warn('Repository removal not yet implemented in AlexandriaOutpostManager');
        return false;
    }
    /**
     * Get total repository count
     */
    async getRepositoryCount() {
        return this.outpostManager.getRepositoryCount();
    }
    /**
     * Search repositories by name or description
     */
    async searchRepositories(query) {
        const all = await this.getRepositories();
        const lowerQuery = query.toLowerCase();
        return all.filter(repo => repo.name.toLowerCase().includes(lowerQuery) ||
            repo.github?.description?.toLowerCase().includes(lowerQuery) ||
            repo.github?.topics?.some(t => t.toLowerCase().includes(lowerQuery)));
    }
    /**
     * Get repositories with views
     */
    async getRepositoriesWithViews() {
        const all = await this.getRepositories();
        return all.filter(r => r.hasViews);
    }
    /**
     * Refresh repository metadata (re-scan for views)
     */
    async refreshRepository(name) {
        // Get the repository to find its path
        const repo = await this.getRepository(name);
        if (!repo)
            return null;
        // For now, just return the repo as-is
        // AlexandriaOutpostManager should handle refreshing internally
        return repo;
    }
}
