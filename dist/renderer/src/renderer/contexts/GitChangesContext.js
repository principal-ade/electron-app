import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { GitService } from '../main-process-api/GitService';
import { GitWatcherService } from '../main-process-api/GitWatcherService';
import { loadLocalGitCommitTree } from '../utils/loadFileSystemTree';
const GitChangesContext = createContext(null);
export const useGitChanges = () => {
    const context = useContext(GitChangesContext);
    if (!context) {
        throw new Error('useGitChanges must be used within GitChangesProvider');
    }
    return context;
};
export const GitChangesProvider = ({ children }) => {
    const [gitStates, setGitStates] = useState(new Map());
    const gitStatesRef = useRef(new Map());
    // Cache duration constants
    const STATUS_CACHE_DURATION = 30 * 1000; // 30 seconds for status
    const HEAD_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for HEAD tree
    // Update ref when state changes
    useEffect(() => {
        gitStatesRef.current = gitStates;
    }, [gitStates]);
    /**
     * Check if repository has any commits
     */
    const checkHasCommits = useCallback(async (source) => {
        if (source.type !== 'local') {
            return false;
        }
        try {
            // Try to get HEAD commit SHA
            const result = await GitService.execCommand(source.location, ['rev-parse', 'HEAD']);
            const commitSha = result.stdout?.trim();
            return !!commitSha;
        }
        catch (error) {
            // If rev-parse HEAD fails, likely no commits
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('unknown revision') || errorMessage.includes('ambiguous argument')) {
                console.log(`[GitChangesProvider] Repository has no commits yet`);
                return false;
            }
            // Other errors are real errors
            throw error;
        }
    }, []);
    /**
     * Check git status for a source (with caching)
     */
    const checkGitStatus = useCallback(async (source) => {
        // Only works for local sources
        if (source.type !== 'local') {
            return null;
        }
        const existingState = gitStatesRef.current.get(source.id);
        // Check cache
        if (existingState?.gitStatus && existingState.lastStatusCheck) {
            const age = Date.now() - existingState.lastStatusCheck;
            if (age < STATUS_CACHE_DURATION) {
                console.log(`[GitChangesProvider] Using cached git status for ${source.id}`);
                return existingState.gitStatus;
            }
        }
        try {
            console.log(`[GitChangesProvider] Checking git status for ${source.location}`);
            // First check if repo has any commits
            let hasNoCommits = false;
            try {
                const hasCommits = await checkHasCommits(source);
                hasNoCommits = !hasCommits;
            }
            catch (error) {
                console.warn(`[GitChangesProvider] Could not check for commits:`, error);
            }
            const status = await GitService.getDetailedChanges(source.location);
            const hasChanges = status.created.length > 0 ||
                status.modified.length > 0 ||
                status.deleted.length > 0;
            // Update state with status
            setGitStates(prev => {
                const newStates = new Map(prev);
                const existing = newStates.get(source.id) || {
                    sourceId: source.id,
                    sourcePath: source.location,
                    hasChanges: false,
                    enabled: false,
                    loading: false
                };
                newStates.set(source.id, {
                    ...existing,
                    hasChanges,
                    hasNoCommits,
                    gitStatus: status,
                    lastStatusCheck: Date.now()
                });
                return newStates;
            });
            return status;
        }
        catch (error) {
            console.error(`[GitChangesProvider] Failed to check git status:`, error);
            return null;
        }
    }, [STATUS_CACHE_DURATION, checkHasCommits]);
    /**
     * Load HEAD tree for a source
     */
    const loadHeadTree = useCallback(async (source) => {
        if (source.type !== 'local') {
            return null;
        }
        try {
            // Get HEAD commit SHA
            const result = await GitService.execCommand(source.location, ['rev-parse', 'HEAD']);
            const commitSha = result.stdout?.trim();
            if (!commitSha) {
                throw new Error('No HEAD commit found');
            }
            console.log(`[GitChangesProvider] Loading HEAD tree for ${source.id} at ${commitSha.substring(0, 7)}`);
            // Load the HEAD tree
            const headResult = await loadLocalGitCommitTree({
                localPath: source.location,
                owner: source.owner,
                repo: source.name,
                commitSha: commitSha
            });
            return headResult.fileTree;
        }
        catch (error) {
            console.error(`[GitChangesProvider] Failed to load HEAD tree:`, error);
            throw error;
        }
    }, []);
    /**
     * Toggle git changes for a source
     */
    const toggleGitChanges = useCallback(async (source, enabled) => {
        if (source.type !== 'local') {
            return;
        }
        const sourceId = source.id;
        const existingState = gitStatesRef.current.get(sourceId);
        // If enabling and HEAD not loaded, check for commits first
        if (enabled && !existingState?.headTree && !existingState?.hasNoCommits) {
            // Set loading state
            setGitStates(prev => {
                const newStates = new Map(prev);
                newStates.set(sourceId, {
                    sourceId,
                    sourcePath: source.location,
                    hasChanges: existingState?.hasChanges || false,
                    gitStatus: existingState?.gitStatus,
                    lastStatusCheck: existingState?.lastStatusCheck || 0,
                    enabled: true,
                    loading: true
                });
                return newStates;
            });
            try {
                // First check if repo has any commits
                const hasCommits = await checkHasCommits(source);
                if (!hasCommits) {
                    // No commits yet - mark as such but still enable to show all files as "new"
                    setGitStates(prev => {
                        const newStates = new Map(prev);
                        const existing = newStates.get(sourceId);
                        newStates.set(sourceId, {
                            ...existing,
                            hasNoCommits: true,
                            loading: false,
                            enabled: true,
                            error: undefined
                        });
                        return newStates;
                    });
                    return;
                }
                // Load HEAD tree
                const headTree = await loadHeadTree(source);
                // Get HEAD commit SHA
                const result = await GitService.execCommand(source.location, ['rev-parse', 'HEAD']);
                const commitSha = result.stdout?.trim();
                // Update state with loaded HEAD
                setGitStates(prev => {
                    const newStates = new Map(prev);
                    const existing = newStates.get(sourceId);
                    newStates.set(sourceId, {
                        ...existing,
                        headTree: headTree || undefined,
                        headCommitSha: commitSha,
                        headLoadedAt: Date.now(),
                        hasNoCommits: false,
                        loading: false,
                        enabled: true,
                        error: undefined
                    });
                    return newStates;
                });
            }
            catch (error) {
                // Update state with error
                setGitStates(prev => {
                    const newStates = new Map(prev);
                    const existing = newStates.get(sourceId);
                    newStates.set(sourceId, {
                        ...existing,
                        loading: false,
                        enabled: false,
                        error: error instanceof Error ? error.message : 'Failed to load HEAD'
                    });
                    return newStates;
                });
            }
        }
        else {
            // Just toggle the enabled state
            setGitStates(prev => {
                const newStates = new Map(prev);
                const existing = newStates.get(sourceId);
                if (existing) {
                    newStates.set(sourceId, {
                        ...existing,
                        enabled
                    });
                }
                return newStates;
            });
        }
    }, [checkHasCommits, loadHeadTree]);
    /**
     * Get git state for a source
     */
    const getGitState = useCallback((sourceId) => {
        return gitStates.get(sourceId);
    }, [gitStates]);
    /**
     * Generate highlight layers for git changes
     */
    const getGitHighlightLayers = useCallback((sourceId, workingTree) => {
        const state = gitStates.get(sourceId);
        if (!state?.enabled) {
            return [];
        }
        const layers = [];
        // Special case: no commits yet - show all files as new
        if (state.hasNoCommits && workingTree) {
            const allFiles = [];
            // Collect all file paths from the working tree
            const collectFiles = (tree, path = '') => {
                if (tree.files) {
                    tree.files.forEach((file) => {
                        if (file.path) {
                            allFiles.push(file.path);
                        }
                    });
                }
                if (tree.children) {
                    Object.entries(tree.children).forEach(([name, child]) => {
                        if (child && typeof child === 'object') {
                            collectFiles(child, path ? `${path}/${name}` : name);
                        }
                    });
                }
            };
            collectFiles(workingTree);
            if (allFiles.length > 0) {
                layers.push({
                    id: `git-all-new-${sourceId}`,
                    name: `All files are new (${allFiles.length})`,
                    enabled: true,
                    color: '#10b981',
                    priority: 25,
                    opacity: 0.7,
                    items: allFiles.map(path => ({
                        path,
                        type: 'file',
                        renderStrategy: 'fill'
                    }))
                });
            }
            return layers;
        }
        // Normal case: has commits and git status
        if (!state.gitStatus) {
            return [];
        }
        const { gitStatus } = state;
        // Created files - Green
        if (gitStatus.created.length > 0) {
            layers.push({
                id: `git-created-${sourceId}`,
                name: `Added (${gitStatus.created.length})`,
                enabled: true,
                color: '#10b981',
                priority: 25,
                opacity: 0.7,
                items: gitStatus.created.map(path => ({
                    path,
                    type: 'file',
                    renderStrategy: 'fill'
                }))
            });
        }
        // Modified files - Orange
        if (gitStatus.modified.length > 0) {
            layers.push({
                id: `git-modified-${sourceId}`,
                name: `Modified (${gitStatus.modified.length})`,
                enabled: true,
                color: '#f59e0b',
                priority: 24,
                opacity: 0.7,
                items: gitStatus.modified.map(path => ({
                    path,
                    type: 'file',
                    renderStrategy: 'fill'
                }))
            });
        }
        // Deleted files - Red (only if we have HEAD tree to show them)
        if (gitStatus.deleted.length > 0 && state.headTree) {
            layers.push({
                id: `git-deleted-${sourceId}`,
                name: `Deleted (${gitStatus.deleted.length})`,
                enabled: true,
                color: '#ef4444',
                priority: 23,
                opacity: 0.7,
                items: gitStatus.deleted.map(path => ({
                    path,
                    type: 'file',
                    renderStrategy: 'fill'
                }))
            });
        }
        // Renamed files - Purple
        if (gitStatus.renamed && gitStatus.renamed.length > 0) {
            const renamedItems = [];
            gitStatus.renamed.forEach(rename => {
                renamedItems.push({ path: rename.from, type: 'file' });
                renamedItems.push({ path: rename.to, type: 'file' });
            });
            layers.push({
                id: `git-renamed-${sourceId}`,
                name: `Renamed (${gitStatus.renamed.length})`,
                enabled: true,
                color: '#8b5cf6',
                priority: 22,
                opacity: 0.7,
                items: renamedItems.map(item => ({
                    ...item,
                    renderStrategy: 'fill'
                }))
            });
        }
        return layers;
    }, [gitStates]);
    /**
     * Refresh git status for a source
     */
    const refreshGitStatus = useCallback(async (sourceId) => {
        const state = gitStatesRef.current.get(sourceId);
        if (!state)
            return;
        // Create a temporary source object for the check
        const source = {
            id: sourceId,
            type: 'local',
            location: state.sourcePath,
            owner: '',
            name: '',
            remoteUrl: '',
            locationType: 'working',
            label: ''
        };
        await checkGitStatus(source);
    }, [checkGitStatus]);
    /**
     * Clear cached data for a source
     */
    const clearGitCache = useCallback((sourceId) => {
        setGitStates(prev => {
            const newStates = new Map(prev);
            newStates.delete(sourceId);
            return newStates;
        });
    }, []);
    /**
     * Initialize git state for a local source (auto-loads HEAD tree)
     * This is called when a local source is first displayed
     */
    const initializeLocalSource = useCallback(async (source) => {
        if (source.type !== 'local') {
            return;
        }
        const sourceId = source.id;
        const existingState = gitStatesRef.current.get(sourceId);
        // If already initialized with HEAD tree, skip
        if (existingState?.headTree || existingState?.hasNoCommits) {
            console.log(`[GitChangesProvider] Source ${sourceId} already initialized`);
            return;
        }
        console.log(`[GitChangesProvider] Initializing local source ${sourceId}`);
        // Enable git changes which will load HEAD tree
        await toggleGitChanges(source, true);
    }, [toggleGitChanges]);
    /**
     * Toggle visibility of git changes (doesn't reload HEAD)
     * This is what the toolbar button should use
     */
    const setGitChangesVisible = useCallback((sourceId, visible) => {
        setGitStates(prev => {
            const newStates = new Map(prev);
            const existing = newStates.get(sourceId);
            if (existing) {
                newStates.set(sourceId, {
                    ...existing,
                    enabled: visible
                });
            }
            return newStates;
        });
    }, []);
    /**
     * Listen for git status updates from GitWatcher
     */
    useEffect(() => {
        const handleGitStatusUpdate = (status) => {
            // Find matching source by path and refresh
            gitStatesRef.current.forEach((state, sourceId) => {
                if (state.sourcePath === status.repoPath) {
                    refreshGitStatus(sourceId);
                }
            });
        };
        const unsubscribe = GitWatcherService.onStatusUpdate(handleGitStatusUpdate);
        return () => {
            unsubscribe();
        };
    }, [refreshGitStatus]);
    const value = {
        gitStates,
        checkGitStatus,
        toggleGitChanges,
        getGitState,
        getGitHighlightLayers,
        refreshGitStatus,
        clearGitCache,
        initializeLocalSource,
        setGitChangesVisible
    };
    return (_jsx(GitChangesContext.Provider, { value: value, children: children }));
};
