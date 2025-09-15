import { parseGitHubUrl } from "@principal-ai/repository-abstraction";
import { PackageLayerModule } from "@principal-ai/codebase-composition";
import { createFileTreeSource, compareFileTreeSources, isTemporarySource } from '../types/file-tree-source';
import { FileTreeCacheService } from './FileTreeCacheService';
import { CloneVisibilityService } from './CloneVisibilityService';
import { loadManifestContents } from '../utils/loadManifestContents';
import { ElectronPlatformAdapters } from '../adapters';
import { GitHubWebAdapters } from '../adapters/GitHubWebAdapters';
/**
 * Service for managing file tree sources
 * Handles converting repository info to sources and managing source state
 */
export class FileTreeSourceService {
    sources = new Map();
    activeSourceId = null;
    cacheService;
    packageModule;
    constructor(cacheService) {
        this.cacheService = cacheService || new FileTreeCacheService();
        this.packageModule = new PackageLayerModule();
    }
    /**
     * Initialize sources from a repository
     * Creates only the visible clone source to optimize loading
     */
    initializeFromRepository(repository, options) {
        const sources = [];
        // Parse repository info
        const repoInfo = parseGitHubUrl(repository.remoteUrl);
        const owner = repoInfo?.owner || repository.owner;
        const repo = repoInfo?.repo || repository.name;
        if (!owner || !repo) {
            throw new Error('Repository must have owner and name');
        }
        // Only create source for the visible clone
        if (repository.localClones && repository.localClones.length > 0) {
            const visibleClonePath = CloneVisibilityService.getVisibleClonePath(repository);
            if (visibleClonePath) {
                const visibleClone = repository.localClones.find(c => c.path === visibleClonePath);
                if (visibleClone) {
                    const source = createFileTreeSource.localWorkingCopy(visibleClone.path, owner, repo, repository.remoteUrl, visibleClone.currentBranch);
                    // Ensure unique ID
                    source.id = `local-${visibleClone.path}`;
                    source.isDefault = true; // Visible clone is always default
                    sources.push(source);
                }
            }
        }
        // Optionally create source for default remote branch (deferred by default)
        if (options?.loadRemoteHead) {
            const defaultBranch = repository.metadata?.defaultBranch || 'main';
            const remoteSource = createFileTreeSource.remoteBranch(owner, repo, repository.remoteUrl, defaultBranch);
            remoteSource.isDefault = sources.length === 0; // Only default if no local clones
            sources.push(remoteSource);
        }
        // Store all sources
        sources.forEach(source => {
            this.sources.set(source.id, source);
        });
        // Set active source (the visible clone or remote if no clones)
        const defaultSource = sources.find(s => s.isDefault);
        if (defaultSource) {
            this.activeSourceId = defaultSource.id;
        }
        // Only prefetch the visible clone's tree
        this.cacheService.prefetchTrees(sources.filter(s => !s.isTemporary));
        return sources;
    }
    /**
     * Add a new source
     */
    addSource(source) {
        this.sources.set(source.id, source);
        // Prefetch if not temporary
        if (!source.isTemporary) {
            this.cacheService.prefetchTrees([source]);
        }
    }
    /**
     * Remove a source
     */
    removeSource(sourceId) {
        const source = this.sources.get(sourceId);
        if (source) {
            this.sources.delete(sourceId);
            // Invalidate cache for this source
            this.cacheService.invalidateSource(sourceId);
            // Switch to another source if active was removed
            if (this.activeSourceId === sourceId) {
                const remainingSources = this.getAllSources();
                this.activeSourceId = remainingSources[0]?.id || null;
            }
        }
    }
    /**
     * Get all sources
     */
    getAllSources() {
        return Array.from(this.sources.values()).sort(compareFileTreeSources);
    }
    /**
     * Get sources by type
     */
    getSourcesByType(type) {
        return this.getAllSources().filter(source => source.type === type);
    }
    /**
     * Get temporary sources
     */
    getTemporarySources() {
        return this.getAllSources().filter(isTemporarySource);
    }
    /**
     * Get a specific source
     */
    getSource(sourceId) {
        return this.sources.get(sourceId);
    }
    /**
     * Get active source
     */
    getActiveSource() {
        if (!this.activeSourceId)
            return null;
        return this.sources.get(this.activeSourceId) || null;
    }
    /**
     * Set active source
     */
    setActiveSource(sourceId) {
        if (this.sources.has(sourceId)) {
            this.activeSourceId = sourceId;
            // Update lastAccessed
            const source = this.sources.get(sourceId);
            if (source) {
                source.lastAccessed = Date.now();
            }
        }
    }
    /**
     * Load a source's tree (uses cache)
     */
    async loadSourceTree(sourceId) {
        const source = this.sources.get(sourceId);
        if (!source)
            return null;
        return this.cacheService.loadFileTree(source);
    }
    /**
     * Load the active source's tree
     */
    async loadActiveSourceTree() {
        const activeSource = this.getActiveSource();
        if (!activeSource)
            return null;
        return this.cacheService.loadFileTree(activeSource);
    }
    /**
     * Detect packages in a source's file tree
     * Uses the standard PackageLayerModule for consistent package detection
     */
    async detectPackagesForSource(sourceId) {
        // Check if we have cached analysis first
        const cachedAnalysis = this.cacheService.getAnalysis(sourceId);
        if (cachedAnalysis?.packageLayers) {
            return cachedAnalysis.packageLayers;
        }
        // Load the file tree
        const source = this.sources.get(sourceId);
        if (!source)
            return null;
        const treeResult = await this.cacheService.loadFileTree(source);
        if (!treeResult || !treeResult.tree)
            return null;
        // Detect packages using the standard module
        try {
            const packages = await this.detectPackages(treeResult.tree, source);
            // Cache the results in the analysis cache
            const existingAnalysis = this.cacheService.getAnalysis(sourceId) || {
                frameworkLayers: null,
                dependencyLayers: null,
                fileTypeLayers: null
            };
            this.cacheService.setAnalysis(sourceId, {
                ...existingAnalysis,
                packageLayers: packages
            });
            return packages;
        }
        catch (error) {
            console.error('Failed to detect packages:', error);
            return null;
        }
    }
    /**
     * Core package detection logic using PackageLayerModule
     */
    async detectPackages(fileTree, source) {
        // Create adapters based on source type
        const adapters = source.type === 'remote'
            ? new GitHubWebAdapters(source.owner, source.name, source.metadata?.currentBranch || source.location)
            : new ElectronPlatformAdapters();
        // Load manifest contents
        const manifestContents = await loadManifestContents({
            fileSystemTree: fileTree,
            fileSystemAdapter: adapters.fileSystem,
            packageModule: this.packageModule,
            rootPath: source.type === 'local' ? source.location : undefined,
        });
        // Discover packages
        return await this.packageModule.discoverPackages(fileTree, manifestContents);
    }
    /**
     * Get cached packages for a source without loading
     */
    getCachedPackages(sourceId) {
        const analysis = this.cacheService.getAnalysis(sourceId);
        return analysis?.packageLayers || null;
    }
    /**
     * Load multiple source trees in parallel
     */
    async loadSourceTrees(sourceIds) {
        const sources = sourceIds
            .map(id => this.sources.get(id))
            .filter((s) => s !== undefined);
        return this.cacheService.loadTrees(sources);
    }
    /**
     * Create a new branch source
     */
    createBranchSource(branchName, makeActive = false) {
        // Get any existing source to copy repository info from
        const existingSource = this.getActiveSource() || this.getAllSources()[0];
        if (!existingSource)
            return null;
        const newSource = createFileTreeSource.remoteBranch(existingSource.owner, existingSource.name, existingSource.remoteUrl, branchName);
        // Ensure unique ID
        newSource.id = `remote-${branchName}-${Date.now()}`;
        this.addSource(newSource);
        if (makeActive) {
            this.setActiveSource(newSource.id);
        }
        return newSource;
    }
    /**
     * Create a new tag source
     */
    createTagSource(tagName, makeActive = false) {
        const existingSource = this.getActiveSource() || this.getAllSources()[0];
        if (!existingSource)
            return null;
        const newSource = createFileTreeSource.remoteTag(existingSource.owner, existingSource.name, existingSource.remoteUrl, tagName);
        // Ensure unique ID
        newSource.id = `remote-tag-${tagName}-${Date.now()}`;
        this.addSource(newSource);
        if (makeActive) {
            this.setActiveSource(newSource.id);
        }
        return newSource;
    }
    /**
     * Create a new commit source
     */
    createCommitSource(commitSha, makeActive = false) {
        const existingSource = this.getActiveSource() || this.getAllSources()[0];
        if (!existingSource)
            return null;
        const newSource = createFileTreeSource.remoteCommit(existingSource.owner, existingSource.name, existingSource.remoteUrl, commitSha);
        this.addSource(newSource);
        if (makeActive) {
            this.setActiveSource(newSource.id);
        }
        return newSource;
    }
    /**
     * Create a temporary source for experimentation
     */
    createTemporarySource(baseSourceId, location, locationType) {
        const baseSource = this.sources.get(baseSourceId);
        if (!baseSource)
            return null;
        const tempSource = createFileTreeSource.temporary(baseSource, location, locationType);
        this.addSource(tempSource);
        return tempSource;
    }
    /**
     * Switch to a different clone and load its tree
     */
    async switchVisibleClone(repository, newClonePath) {
        // Update visibility preference
        CloneVisibilityService.setVisibleClonePath(repository.remoteUrl, newClonePath);
        // Find the clone
        const clone = repository.localClones.find(c => c.path === newClonePath);
        if (!clone)
            return null;
        // Parse repository info
        const repoInfo = parseGitHubUrl(repository.remoteUrl);
        const owner = repoInfo?.owner || repository.owner;
        const repo = repoInfo?.repo || repository.name;
        if (!owner || !repo)
            return null;
        // Check if source already exists
        const existingSourceId = `local-${newClonePath}`;
        let source = this.sources.get(existingSourceId);
        if (!source) {
            // Create new source for this clone
            source = createFileTreeSource.localWorkingCopy(clone.path, owner, repo, repository.remoteUrl, clone.currentBranch);
            source.id = existingSourceId;
            source.isDefault = true;
            this.addSource(source);
        }
        // Make it active
        this.setActiveSource(source.id);
        // Load its tree
        await this.loadSourceTree(source.id);
        return source;
    }
    /**
     * Clean up expired temporary sources
     */
    cleanupTemporarySources(maxAge = 30 * 60 * 1000) {
        const now = Date.now();
        const toRemove = [];
        for (const [id, source] of this.sources.entries()) {
            if (source.isTemporary && source.createdAt) {
                if (now - source.createdAt > maxAge) {
                    toRemove.push(id);
                }
            }
        }
        toRemove.forEach(id => this.removeSource(id));
        return toRemove.length;
    }
    /**
     * Refresh a source (invalidate cache and optionally reload)
     */
    async refreshSource(sourceId, reload = false) {
        const source = this.sources.get(sourceId);
        if (!source)
            return null;
        // Invalidate cache
        this.cacheService.invalidateSource(sourceId);
        // Reload if requested
        if (reload) {
            return this.cacheService.loadFileTree(source);
        }
        return null;
    }
    /**
     * Refresh all sources of a specific type
     */
    async refreshSourcesByType(type) {
        const sources = this.getSourcesByType(type);
        await Promise.all(sources.map(source => this.refreshSource(source.id)));
    }
    /**
     * Update source metadata
     */
    updateSourceMetadata(sourceId, metadata) {
        const source = this.sources.get(sourceId);
        if (source) {
            source.metadata = {
                ...source.metadata,
                ...metadata
            };
        }
    }
    /**
     * Clear all sources
     */
    clear() {
        // Invalidate all caches
        this.sources.forEach((_, id) => {
            this.cacheService.invalidateSource(id);
        });
        this.sources.clear();
        this.activeSourceId = null;
    }
    /**
     * Get statistics about sources
     */
    getStatistics() {
        const sources = this.getAllSources();
        return {
            totalSources: sources.length,
            localSources: sources.filter(s => s.type === 'local').length,
            remoteSources: sources.filter(s => s.type === 'remote').length,
            temporarySources: sources.filter(isTemporarySource).length,
            activeSourceId: this.activeSourceId,
            cacheStats: this.cacheService.getCacheStats()
        };
    }
    /**
     * Export sources for persistence
     */
    exportSources() {
        return {
            sources: this.getAllSources(),
            activeSourceId: this.activeSourceId
        };
    }
    /**
     * Import sources from persistence
     */
    importSources(data) {
        this.clear();
        data.sources.forEach(source => {
            this.sources.set(source.id, source);
        });
        if (data.activeSourceId && this.sources.has(data.activeSourceId)) {
            this.activeSourceId = data.activeSourceId;
        }
        // Prefetch non-temporary sources
        const sourcesToPrefetch = data.sources.filter(s => !s.isTemporary);
        this.cacheService.prefetchTrees(sourcesToPrefetch);
    }
}
