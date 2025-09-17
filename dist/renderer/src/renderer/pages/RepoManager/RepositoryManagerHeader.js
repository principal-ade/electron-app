import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { FolderOpen, GitBranch, ArrowUp, ArrowDown, FastForward, GitFork, Wifi, ChevronDown, Check, HelpCircle, LogIn, LogOut, Loader2, Database, Key, FolderGit } from 'lucide-react';
import { useAuthState } from '../../hooks/useAuthState';
import { RepositoryService } from '../../main-process-api/RepositoryService';
import { GitService } from '../../main-process-api/GitService';
import { GitWatcherService } from '../../main-process-api/GitWatcherService';
import { RepositoryAvatar } from '../../components/repository-maps/RepositoryAvatar';
import { BadgeInfoModal } from './shared/BadgeInfoModal';
import { LicenseBadge } from '../../components/common/LicenseBadge';
import { SyncStatusIndicator } from '../../components/repository-maps/SyncStatusIndicator';
import { gitSyncConnectionManager } from '../../services/git-sync/GitSyncConnectionManager';
import { hasA24zDirectory, getA24zNoteCount } from '../../utils/a24zUtils';
import { A24zMemoryInfoModal } from './shared/A24zMemoryInfoModal';
import { RepositorySwitcherModal } from './shared/RepositorySwitcherModal';
import { SecretsModal } from './shared/SecretsModal';
import { ModeSelector } from './shared/ModeSelector';
import { SourceSelectionService } from '../../services/SourceSelectionService';
import { WindowService } from '../../main-process-api/WindowService';
import { ProcessingPipelineModal } from './shared/ProcessingPipelineModal';
import { CloneManagementModal } from '../../components/repository-maps/CloneManagementModal';
// CSS animations
const animations = `
  @keyframes pulse-sync {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  .spinning {
    animation: spin 1s linear infinite;
  }
`;
export const RepositoryManagerHeader = ({ repository, ghOwner, ghRepo, mode = 'explore', onModeChange, onSourceSelect, selectedSource, fileTreeStats, packageLayers, filterLayers, }) => {
    const { theme } = useTheme();
    const [customAvatarUrls, setCustomAvatarUrls] = useState({});
    const headerRef = useRef(null);
    const [cloneBranchStatuses, setCloneBranchStatuses] = useState({});
    const [_fastForwarding, setFastForwarding] = useState(null); // Used for fast-forward UI state
    const [isBadgeInfoModalOpen, setIsBadgeInfoModalOpen] = useState(false);
    // const [showCollaboration, setShowCollaboration] = useState(false); // TODO: Re-enable for collaboration
    const [_showTurnBasedSync, setShowTurnBasedSync] = useState(false); // TODO: Re-enable for turn-based sync
    const [cloneSyncStatuses, setCloneSyncStatuses] = useState({});
    const [a24zInfo, setA24zInfo] = useState(null);
    const [showA24zInfoModal, setShowA24zInfoModal] = useState(false);
    const [showRepositorySwitcher, setShowRepositorySwitcher] = useState(false);
    const [showSourceSelector, setShowSourceSelector] = useState(false);
    const [showSourceHelpModal, setShowSourceHelpModal] = useState(false);
    const [showProcessingDetailsModal, setShowProcessingDetailsModal] = useState(false);
    const [showSecretsModal, setShowSecretsModal] = useState(false);
    const [showCloneManagement, setShowCloneManagement] = useState(false);
    const [availableSources, setAvailableSources] = useState([]);
    // Debug logging for showCloneManagement state
    useEffect(() => {
        console.log('RepositoryManagerHeader: showCloneManagement state changed to:', showCloneManagement);
    }, [showCloneManagement]);
    // Use the centralized auth state hook
    const { isAuthenticated, user: authUser, login, logout, isLoggingIn, loginError, clearLoginError } = useAuthState();
    // Listen for auth request events
    useEffect(() => {
        const handleOpenTurnBasedSync = () => {
            setShowTurnBasedSync(true);
        };
        window.addEventListener('open-turn-based-sync', handleOpenTurnBasedSync);
        return () => {
            window.removeEventListener('open-turn-based-sync', handleOpenTurnBasedSync);
        };
    }, []);
    // Get license info from repository metadata
    const licenseInfo = useMemo(() => {
        return repository?.metadata?.license || null;
    }, [repository?.metadata?.license]);
    // Initialize available sources and selected source
    useEffect(() => {
        const sources = SourceSelectionService.getAvailableSources(repository);
        setAvailableSources(sources);
        // If no selected source provided, use the default
        if (!selectedSource && sources.length > 0) {
            const defaultSource = SourceSelectionService.getSelectedSource(repository);
            if (defaultSource) {
                onSourceSelect?.(defaultSource);
            }
        }
    }, [repository, selectedSource, onSourceSelect]);
    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (_e) => {
            if (showSourceSelector) {
                setShowSourceSelector(false);
            }
        };
        if (showSourceSelector) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showSourceSelector]);
    // Check for a24z directory when we have a selected local source
    useEffect(() => {
        const checkA24z = async () => {
            if (selectedSource?.type === 'local') {
                const hasA24z = await hasA24zDirectory(selectedSource.location);
                const noteCount = hasA24z ? await getA24zNoteCount(selectedSource.location) : 0;
                setA24zInfo({ hasA24z, noteCount });
            }
            else {
                setA24zInfo(null);
            }
        };
        checkA24z();
    }, [selectedSource]);
    // Monitor connection status changes
    useEffect(() => {
        // Listen to connection status changes from GitSyncConnectionManager
        const handleConnectionStatusChange = (connectionKey, status) => {
            // Extract clone path from connection key (format: "owner/repo:branch")
            const [repoId, branch] = connectionKey.split(':');
            // Find matching clone by checking if it's for this repo
            if (repository?.localClones) {
                repository.localClones.forEach(clone => {
                    // Check if this status update is for this clone
                    const cloneRepoId = repository.owner && repository.name
                        ? `${repository.owner}/${repository.name}`
                        : `${authUser?.login}/${repository.name}`;
                    if (repoId === cloneRepoId && (cloneBranchStatuses[clone.path]?.branch === branch || branch === 'main')) {
                        setCloneSyncStatuses(prev => ({
                            ...prev,
                            [clone.path]: status
                        }));
                    }
                });
            }
        };
        gitSyncConnectionManager.on('connection-status-changed', handleConnectionStatusChange);
        // Get initial connection statuses
        const connections = gitSyncConnectionManager.getActiveConnections();
        const statuses = {};
        connections.forEach((info, key) => {
            const [repoId, branch] = key.split(':');
            if (repository?.localClones) {
                repository.localClones.forEach(clone => {
                    const cloneRepoId = repository.owner && repository.name
                        ? `${repository.owner}/${repository.name}`
                        : `${authUser?.login}/${repository.name}`;
                    if (repoId === cloneRepoId && (cloneBranchStatuses[clone.path]?.branch === branch || branch === 'main')) {
                        statuses[clone.path] = info.status;
                    }
                });
            }
        });
        setCloneSyncStatuses(statuses);
        return () => {
            gitSyncConnectionManager.off('connection-status-changed', handleConnectionStatusChange);
        };
    }, [repository, authUser, cloneBranchStatuses]);
    // Handle fast-forward merge
    const _handleFastForward = async (clonePath) => {
        setFastForwarding(clonePath);
        try {
            const result = await GitService.fastForwardMerge(clonePath);
            if (result.success) {
                // Refresh branch status after successful merge
                const status = await GitService.getBranchStatus(clonePath);
                setCloneBranchStatuses(prev => ({
                    ...prev,
                    [clonePath]: status
                }));
                console.info('[RepositoryManagerHeader] Fast-forward successful:', result.message);
            }
            else {
                console.error('[RepositoryManagerHeader] Fast-forward failed:', result.message);
                alert(`Fast-forward failed: ${result.message}`);
            }
        }
        catch (error) {
            console.error('[RepositoryManagerHeader] Fast-forward error:', error);
            alert('Failed to perform fast-forward merge');
        }
        finally {
            setFastForwarding(null);
        }
    };
    // Watch git status for local clones using GitWatcher for real-time updates
    useEffect(() => {
        // Only watch git status if we have a local source selected
        if (!repository?.localClones || selectedSource?.type !== 'local') {
            return;
        }
        const cleanupFns = [];
        // Start watching each local clone
        repository?.localClones?.forEach(async (clone) => {
            // Start watching
            const result = await GitWatcherService.watchRepository(clone.path);
            if (result.success) {
                // Get initial status and convert to GitBranchStatus format
                const status = await GitWatcherService.getStatus(clone.path);
                if (status) {
                    // Convert GitStatus to GitBranchStatus format
                    // Note: GitWatcher returns 0 for ahead/behind when there's no upstream or when in sync
                    // We'll assume hasUpstream is true if we got a valid status (GitWatcher handles the checks)
                    const branchStatus = {
                        branch: status.branch,
                        hasUpstream: true, // GitWatcher only returns ahead/behind if there's an upstream
                        ahead: status.ahead,
                        behind: status.behind,
                        hasUncommittedChanges: status.isDirty,
                        canFastForward: status.behind > 0 && status.ahead === 0 && !status.isDirty
                    };
                    setCloneBranchStatuses(prev => ({
                        ...prev,
                        [clone.path]: branchStatus
                    }));
                }
            }
        });
        // Listen for status updates
        const unsubscribe = GitWatcherService.onStatusUpdate((status) => {
            // Check if this status is for one of our clones
            const isOurClone = repository?.localClones?.some(c => c.path === status.repoPath);
            if (isOurClone) {
                // Convert GitStatus to GitBranchStatus format
                const branchStatus = {
                    branch: status.branch,
                    hasUpstream: true, // GitWatcher only returns ahead/behind if there's an upstream
                    ahead: status.ahead,
                    behind: status.behind,
                    hasUncommittedChanges: status.isDirty,
                    canFastForward: status.behind > 0 && status.ahead === 0 && !status.isDirty
                };
                setCloneBranchStatuses(prev => ({
                    ...prev,
                    [status.repoPath]: branchStatus
                }));
            }
        });
        cleanupFns.push(unsubscribe);
        // Cleanup on unmount
        return () => {
            cleanupFns.forEach(fn => fn());
            // Stop watching all clones
            repository?.localClones?.forEach(clone => {
                GitWatcherService.unwatchRepository(clone.path);
            });
        };
    }, [repository?.localClones, selectedSource]);
    // Load custom avatar URLs
    useEffect(() => {
        const loadAvatarUrls = async () => {
            const urls = {};
            // Load repository avatar
            if (repository?.customAvatarPath) {
                const url = await RepositoryService.getAvatarUrl(repository.customAvatarPath);
                if (url)
                    urls.repo = url;
            }
            // Load clone avatars
            if (repository?.localClones) {
                for (const clone of repository.localClones) {
                    if (clone.customAvatarPath) {
                        const url = await RepositoryService.getAvatarUrl(clone.customAvatarPath);
                        if (url)
                            urls[clone.path] = url;
                    }
                }
            }
            setCustomAvatarUrls(urls);
        };
        loadAvatarUrls();
    }, [repository]);
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: animations }), _jsxs("div", { ref: headerRef, style: {
                    display: 'flex',
                    alignItems: 'stretch', // Changed from 'center' to 'stretch' for equal heights
                    gap: '16px',
                    padding: '0 20px 12px 20px', // Match the 20px horizontal padding from the main container
                    position: 'relative' // Add relative positioning for absolute children
                }, children: [_jsx("div", { style: {
                            position: 'absolute',
                            top: '0',
                            right: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: '8px',
                            zIndex: 10,
                        }, children: _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                            }, children: [licenseInfo && (_jsx(LicenseBadge, { license: licenseInfo, size: "medium", interactive: true, onClick: () => {
                                        if (ghOwner && ghRepo) {
                                            window.open(`https://github.com/${ghOwner}/${ghRepo}/blob/${repository?.metadata?.defaultBranch || 'main'}/LICENSE`, '_blank');
                                        }
                                    } })), isAuthenticated && authUser ? (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '4px 8px 4px 4px',
                                        backgroundColor: theme.colors.backgroundSecondary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '20px',
                                        fontSize: '13px',
                                    }, children: [authUser?.avatarUrl ? (_jsx("img", { src: authUser.avatarUrl, alt: authUser.login, style: {
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                            } })) : (_jsx("div", { style: {
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                backgroundColor: theme.colors.primary,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: theme.colors.background,
                                                fontWeight: 600,
                                                fontSize: '12px',
                                            }, children: authUser.login[0].toUpperCase() })), _jsx("span", { style: { fontWeight: 500, color: theme.colors.text }, children: authUser.login }), _jsx("button", { onClick: async () => {
                                                try {
                                                    await logout();
                                                    // Clear any active sync connections
                                                    gitSyncConnectionManager.disconnectAll();
                                                    console.info('Logged out successfully');
                                                }
                                                catch (error) {
                                                    console.error('Logout failed:', error);
                                                }
                                            }, style: {
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '2px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: theme.colors.textSecondary,
                                                transition: 'color 0.2s',
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.color = theme.colors.error || '#ef4444';
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.color = theme.colors.textSecondary;
                                            }, title: "Logout", children: _jsx(LogOut, { size: 14 }) })] })) : (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [loginError && (_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 8px',
                                                backgroundColor: theme.colors.error ? `${theme.colors.error}20` : '#ef444420',
                                                border: `1px solid ${theme.colors.error || '#ef4444'}40`,
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                color: theme.colors.error || '#ef4444',
                                            }, children: [_jsx("span", { children: loginError === 'Authentication already in progress' ? 'Login in progress...' : loginError }), loginError !== 'Authentication already in progress' && (_jsx("button", { onClick: () => clearLoginError(), style: {
                                                        backgroundColor: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '0',
                                                        color: theme.colors.error || '#ef4444',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                    }, title: "Dismiss", children: "\u00D7" }))] })), _jsx("button", { onClick: async () => {
                                                try {
                                                    // Force retry if there was an error
                                                    const forceRetry = loginError === 'Authentication already in progress';
                                                    await login(forceRetry);
                                                    console.info('Login initiated');
                                                }
                                                catch (error) {
                                                    console.error('Login error:', error);
                                                    // Error is handled in the hook and displayed via loginError state
                                                }
                                            }, style: {
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                backgroundColor: isLoggingIn ? theme.colors.backgroundTertiary : theme.colors.primary,
                                                color: isLoggingIn ? theme.colors.textSecondary : theme.colors.background,
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                cursor: isLoggingIn ? 'wait' : 'pointer',
                                                transition: 'all 0.2s',
                                                opacity: isLoggingIn ? 0.7 : 1,
                                            }, onMouseEnter: (e) => {
                                                if (!isLoggingIn)
                                                    e.currentTarget.style.opacity = '0.9';
                                            }, onMouseLeave: (e) => {
                                                if (!isLoggingIn)
                                                    e.currentTarget.style.opacity = '1';
                                            }, title: isLoggingIn ? 'Authenticating...' : (loginError === 'Authentication already in progress' ? 'Click to retry' : 'Login with GitHub'), disabled: isLoggingIn && loginError !== 'Authentication already in progress', children: isLoggingIn ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 14, className: "spinning" }), _jsx("span", { children: "Logging in..." })] })) : (_jsxs(_Fragment, { children: [_jsx(LogIn, { size: 14 }), _jsx("span", { children: loginError === 'Authentication already in progress' ? 'Retry Login' : 'Login' })] })) })] }))] }) }), _jsx("div", { style: { flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }, children: _jsxs("div", { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }, children: [repository?.metadata?.isFork && repository?.metadata?.parentRepo && (_jsxs("button", { onClick: () => {
                                        setIsBadgeInfoModalOpen(true);
                                    }, style: {
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 10px',
                                        backgroundColor: '#f59e0b15',
                                        border: '1px solid #f59e0b40',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        color: '#f59e0b',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor = '#f59e0b25';
                                        e.currentTarget.style.borderColor = '#f59e0b60';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = '#f59e0b15';
                                        e.currentTarget.style.borderColor = '#f59e0b40';
                                    }, title: "Click to see fork sync status", children: [_jsx(GitFork, { size: 12 }), _jsxs("span", { children: ["Fork of ", repository?.metadata?.parentRepo?.owner, "/", repository?.metadata?.parentRepo?.name] })] })), selectedSource && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0' }, children: [(() => {
                                            const sourceName = SourceSelectionService.getSourceDisplayName(selectedSource);
                                            const sourceType = SourceSelectionService.getSourceTypeDisplayName(selectedSource);
                                            // Only get branch status for local sources
                                            const branchStatus = selectedSource.type === 'local' ? cloneBranchStatuses[selectedSource.location] : null;
                                            const syncStatus = selectedSource.type === 'local' ? cloneSyncStatuses[selectedSource.location] : null;
                                            // Determine sync state and colors
                                            const isBehind = (branchStatus?.behind ?? 0) > 0;
                                            const isAhead = (branchStatus?.ahead ?? 0) > 0;
                                            const hasDiverged = isBehind && isAhead;
                                            // Get sync settings for local sources
                                            let cloneSettings = null;
                                            let isSyncEnabled = false;
                                            let isSyncConnected = false;
                                            let peersInRoom = 0;
                                            if (selectedSource.type === 'local') {
                                                const key = `clone-sync-settings-${repository?.remoteUrl}`;
                                                const stored = localStorage.getItem(key);
                                                if (stored) {
                                                    try {
                                                        const settings = JSON.parse(stored);
                                                        cloneSettings = settings.find((s) => s.path === selectedSource.location);
                                                    }
                                                    catch (_e) {
                                                        // ignore
                                                    }
                                                }
                                                isSyncEnabled = cloneSettings && cloneSettings.mode !== 'off';
                                                isSyncConnected = isSyncEnabled && (syncStatus?.connected === true) && (syncStatus?.authenticated === true);
                                                peersInRoom = syncStatus?.peers?.length || 0;
                                            }
                                            // Colors based on source type and sync state
                                            let borderColor = theme.colors.primary;
                                            let backgroundColor = theme.colors.primary + '22';
                                            let textColor = theme.colors.primary;
                                            if (selectedSource.type === 'remote') {
                                                // Remote sources get standard styling
                                                borderColor = theme.colors.border;
                                                backgroundColor = theme.colors.backgroundTertiary;
                                                textColor = theme.colors.textSecondary;
                                            }
                                            else if (branchStatus?.hasUpstream) {
                                                // Local sources with upstream - color based on sync state
                                                if (hasDiverged) {
                                                    borderColor = '#ff9800';
                                                    backgroundColor = '#ff980022';
                                                    textColor = '#ff9800';
                                                }
                                                else if (isBehind) {
                                                    borderColor = '#ffc107';
                                                    backgroundColor = '#ffc10722';
                                                    textColor = '#ffc107';
                                                }
                                                else if (isAhead) {
                                                    borderColor = theme.colors.success || '#4caf50';
                                                    backgroundColor = (theme.colors.success || '#4caf50') + '22';
                                                    textColor = theme.colors.success || '#4caf50';
                                                }
                                            }
                                            // Override with sync connection status
                                            if (isSyncConnected) {
                                                borderColor = theme.colors.success || '#4caf50';
                                                backgroundColor = `${theme.colors.success || '#4caf50'}15`;
                                            }
                                            return (_jsxs("div", { style: { position: 'relative', display: 'inline-block' }, children: [_jsxs("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            setShowSourceSelector(!showSourceSelector);
                                                        }, style: {
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '4px 10px',
                                                            backgroundColor,
                                                            border: `1px solid ${borderColor}`,
                                                            borderRadius: '6px',
                                                            fontSize: '13px',
                                                            fontWeight: 500,
                                                            color: textColor,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                        }, title: `${sourceName} (${sourceType}) - Click to switch sources`, children: [selectedSource.type === 'local' ? (customAvatarUrls[selectedSource.location] ? (_jsx(RepositoryAvatar, { repository: repository, localClone: repository.localClones?.find(c => c.path === selectedSource.location), customAvatarUrl: customAvatarUrls[selectedSource.location], size: 12, type: "clone" })) : (_jsx(FolderOpen, { size: 12 }))) : (_jsx(GitBranch, { size: 12 })), sourceName, branchStatus?.branch && (_jsxs("span", { style: {
                                                                    fontSize: '11px',
                                                                    opacity: 0.8,
                                                                    color: branchStatus.hasUncommittedChanges ? '#f59e0b' : 'inherit'
                                                                }, children: ["(", branchStatus.branch, ")", branchStatus.hasUncommittedChanges && ' ●'] })), isSyncConnected && (_jsxs("div", { style: {
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px',
                                                                    marginLeft: '4px',
                                                                    padding: '2px 4px',
                                                                    backgroundColor: `${theme.colors.success}20`,
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    color: theme.colors.success,
                                                                }, children: [_jsx(Wifi, { size: 10, style: { animation: 'pulse-sync 2s ease-in-out infinite' } }), peersInRoom > 0 && `${peersInRoom + 1}`] })), branchStatus?.hasUpstream === true && (_jsxs(_Fragment, { children: [branchStatus.ahead !== undefined && branchStatus.ahead > 0 && (_jsxs("span", { style: {
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '2px',
                                                                            fontSize: '11px',
                                                                            color: theme.colors.success || '#4caf50'
                                                                        }, children: [_jsx(ArrowUp, { size: 10 }), branchStatus.ahead] })), branchStatus.behind !== undefined && branchStatus.behind > 0 && (_jsxs("span", { style: {
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '2px',
                                                                            fontSize: '11px',
                                                                            color: '#ff9800'
                                                                        }, children: [_jsx(ArrowDown, { size: 10 }), branchStatus.behind] }))] })), availableSources.length > 1 && (_jsx(ChevronDown, { size: 14, style: { marginLeft: '4px', opacity: 0.7 } }))] }), showSourceSelector && availableSources.length > 1 && (_jsx("div", { style: {
                                                            position: 'absolute',
                                                            top: '100%',
                                                            left: 0,
                                                            marginTop: '4px',
                                                            backgroundColor: theme.colors.background,
                                                            border: `1px solid ${theme.colors.border}`,
                                                            borderRadius: '8px',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                            zIndex: 1000,
                                                            minWidth: '200px',
                                                            maxWidth: '400px',
                                                            overflow: 'hidden',
                                                        }, children: availableSources.map((source) => {
                                                            const displayName = SourceSelectionService.getSourceDisplayName(source);
                                                            const sourceTypeName = SourceSelectionService.getSourceTypeDisplayName(source);
                                                            const isCurrentSource = selectedSource?.id === source.id;
                                                            const sourceBranchStatus = source.type === 'local' ? cloneBranchStatuses[source.location] : null;
                                                            return (_jsxs("button", { onClick: () => {
                                                                    if (!isCurrentSource) {
                                                                        // Update selection and trigger parent's onSourceSelect
                                                                        SourceSelectionService.setSelectedSource(repository.remoteUrl, source.id);
                                                                        onSourceSelect?.(source);
                                                                    }
                                                                    setShowSourceSelector(false);
                                                                }, style: {
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    width: '100%',
                                                                    padding: '8px 12px',
                                                                    backgroundColor: isCurrentSource ? theme.colors.backgroundSecondary : 'transparent',
                                                                    border: 'none',
                                                                    cursor: isCurrentSource ? 'default' : 'pointer',
                                                                    fontSize: '13px',
                                                                    color: theme.colors.text,
                                                                    transition: 'background-color 0.2s',
                                                                }, onMouseEnter: (e) => {
                                                                    if (!isCurrentSource) {
                                                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                                                    }
                                                                }, onMouseLeave: (e) => {
                                                                    if (!isCurrentSource) {
                                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                                    }
                                                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [source.type === 'local' ? (customAvatarUrls[source.location] ? (_jsx(RepositoryAvatar, { repository: repository, localClone: repository.localClones?.find(c => c.path === source.location), customAvatarUrl: customAvatarUrls[source.location], size: 16, type: "clone" })) : (_jsx(FolderOpen, { size: 16 }))) : (_jsx(GitBranch, { size: 16 })), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }, children: [_jsx("span", { children: displayName }), _jsx("span", { style: { fontSize: '11px', opacity: 0.6, color: theme.colors.textTertiary }, children: sourceTypeName })] }), sourceBranchStatus?.branch && source.type === 'local' && (_jsxs("span", { style: { fontSize: '11px', opacity: 0.6 }, children: ["(", sourceBranchStatus.branch, ")"] }))] }), isCurrentSource && (_jsx(Check, { size: 14, color: theme.colors.primary }))] }, source.id));
                                                        }) }))] }));
                                        })(), _jsx("button", { onClick: (e) => {
                                                e.stopPropagation();
                                                console.log('Clone management button clicked, setting showCloneManagement to true');
                                                setShowCloneManagement(true);
                                            }, style: {
                                                marginLeft: '8px',
                                                padding: '4px',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '4px',
                                                transition: 'background-color 0.2s',
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }, title: "Manage repository clones", children: _jsx(FolderGit, { size: 14, color: theme.colors.textSecondary }) }), selectedSource?.type === 'local' && (_jsx("button", { onClick: (e) => {
                                                e.stopPropagation();
                                                setShowSecretsModal(true);
                                            }, style: {
                                                marginLeft: '8px',
                                                padding: '4px',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '4px',
                                                transition: 'background-color 0.2s',
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }, title: "Manage environment secrets", children: _jsx(Key, { size: 14, color: theme.colors.textSecondary }) })), _jsx("button", { onClick: (e) => {
                                                e.stopPropagation();
                                                setShowProcessingDetailsModal(true);
                                            }, style: {
                                                marginLeft: '8px',
                                                padding: '4px',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '4px',
                                                transition: 'background-color 0.2s',
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }, title: "Show processing pipeline", children: _jsx(Database, { size: 14, color: theme.colors.textSecondary }) }), _jsx("button", { onClick: (e) => {
                                                e.stopPropagation();
                                                setShowSourceHelpModal(true);
                                            }, style: {
                                                marginLeft: '8px',
                                                padding: '4px',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '4px',
                                                transition: 'background-color 0.2s',
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }, title: "What do these indicators mean?", children: _jsx(HelpCircle, { size: 14, color: theme.colors.textSecondary }) })] }))] }) }), _jsx("div", { style: {
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }, children: mode && (_jsx(ModeSelector, { mode: mode, onModeChange: onModeChange, hasLocalClones: !!repository?.localClones?.length, disabled: !onModeChange })) }), _jsx("div", { style: { flex: '1 1 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '12px', paddingBottom: '4px' }, children: isAuthenticated && selectedSource?.type === 'local' && (_jsx(SyncStatusIndicator, { repoPath: selectedSource.location || '', clonePath: selectedSource.location, branchName: cloneBranchStatuses[selectedSource.location]?.branch || 'main', repository: repository, isAuthenticated: isAuthenticated, currentUser: authUser?.login || undefined, compact: true })) }), _jsx(BadgeInfoModal, { isOpen: isBadgeInfoModalOpen, onClose: () => setIsBadgeInfoModalOpen(false), repository: repository, selectedClonePath: selectedSource?.type === 'local' ? selectedSource.location : undefined, cloneBranchStatuses: cloneBranchStatuses, setCloneBranchStatuses: setCloneBranchStatuses }), _jsx(A24zMemoryInfoModal, { isOpen: showA24zInfoModal, onClose: () => setShowA24zInfoModal(false), noteCount: a24zInfo?.noteCount }), _jsx(RepositorySwitcherModal, { isOpen: showRepositorySwitcher, onClose: () => setShowRepositorySwitcher(false), currentRepository: repository, onSelectRepository: (selectedRepo, selectedMode, _openInNewWindow) => {
                            // Open in new window using existing IPC handler
                            // Note: openInNewWindow parameter is for future use when we implement current window switching
                            WindowService.openRepositoryMaps({
                                repository: selectedRepo,
                                mode: selectedMode
                            });
                        } }), showSourceHelpModal && _jsx(SourceBadgeHelpModal, { isOpen: showSourceHelpModal, onClose: () => setShowSourceHelpModal(false) }), _jsx(ProcessingPipelineModal, { isOpen: showProcessingDetailsModal, onClose: () => setShowProcessingDetailsModal(false), selectedSource: selectedSource, fileTreeStats: fileTreeStats, packageLayers: packageLayers, filterLayers: filterLayers }), _jsx(SecretsModal, { isOpen: showSecretsModal, onClose: () => setShowSecretsModal(false), repository: repository, selectedSource: selectedSource }), console.log('About to render CloneManagementModal with:', { showCloneManagement, repository: repository?.name }), showCloneManagement && (_jsxs(_Fragment, { children: [console.log('showCloneManagement is true, rendering modal'), _jsx(CloneManagementModal, { repository: repository, isOpen: showCloneManagement, onClose: () => {
                                    console.log('CloneManagementModal onClose called');
                                    setShowCloneManagement(false);
                                }, onCloneAdded: (clonePath) => {
                                    console.log('Clone added:', clonePath);
                                    // Refresh the available sources
                                    const sources = SourceSelectionService.getAvailableSources(repository);
                                    setAvailableSources(sources);
                                }, onCloneRemoved: (clonePath) => {
                                    console.log('Clone removed:', clonePath);
                                    // Refresh the available sources
                                    const sources = SourceSelectionService.getAvailableSources(repository);
                                    setAvailableSources(sources);
                                } })] }))] })] }));
};
// Source Badge Help Modal Component
const SourceBadgeHelpModal = ({ isOpen, onClose }) => {
    const { theme } = useTheme();
    if (!isOpen)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
        }, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.background,
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                border: `1px solid ${theme.colors.border}`,
            }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }, children: [_jsx("h2", { style: { margin: 0, fontSize: '18px', fontWeight: 600, color: theme.colors.text }, children: "Source Badge Indicators" }), _jsx("button", { onClick: onClose, style: {
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                fontSize: '20px',
                                padding: '4px',
                            }, children: "\u00D7" })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '16px' }, children: [_jsxs("div", { children: [_jsx("h3", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text, marginBottom: '12px' }, children: "Source Types" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '12px' }, children: [_jsx(FolderOpen, { size: 18, color: theme.colors.primary }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500, color: theme.colors.text, fontSize: '13px' }, children: "Local Clone" }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginTop: '2px' }, children: "A local copy of the repository on your machine. Shows real-time git status and enables development features." })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: '12px' }, children: [_jsx(GitBranch, { size: 18, color: theme.colors.primary }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500, color: theme.colors.text, fontSize: '13px' }, children: "Remote Source" }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary, marginTop: '2px' }, children: "A branch, tag, or commit from the remote repository. Read-only access via GitHub API." })] })] })] })] }), _jsxs("div", { children: [_jsx("h3", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text, marginBottom: '12px' }, children: "Git Status Indicators (Local Sources Only)" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("span", { style: {
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        backgroundColor: '#f59e0b22',
                                                        color: '#f59e0b',
                                                        fontSize: '11px',
                                                        fontWeight: 600
                                                    }, children: "main \u25CF" }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Branch name with orange dot (\u25CF) indicates uncommitted changes" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(ArrowUp, { size: 14, color: theme.colors.success || '#4caf50' }), _jsx("span", { style: { fontSize: '11px', color: theme.colors.success || '#4caf50' }, children: "3" })] }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Number of commits ahead of remote (ready to push)" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(ArrowDown, { size: 14, color: '#ff9800' }), _jsx("span", { style: { fontSize: '11px', color: '#ff9800' }, children: "2" })] }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Number of commits behind remote (available to pull)" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(FastForward, { size: 14, color: '#ff9800' }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Fast-forward available - click to merge remote changes" })] })] })] }), _jsxs("div", { children: [_jsx("h3", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text, marginBottom: '12px' }, children: "Sync Indicators (Local Sources Only)" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(Wifi, { size: 14, color: theme.colors.success || '#4caf50' }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Connected to sync network (real-time collaboration active)" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(Wifi, { size: 14, color: theme.colors.success || '#4caf50' }), _jsx("span", { style: { fontSize: '11px', color: theme.colors.success || '#4caf50' }, children: "3" })] }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Number of peers in the sync room (including you)" })] })] })] }), _jsxs("div", { children: [_jsx("h3", { style: { fontSize: '14px', fontWeight: 600, color: theme.colors.text, marginBottom: '12px' }, children: "Badge Border Colors" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '10px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                        width: '40px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: `2px solid ${theme.colors.primary}`,
                                                        backgroundColor: theme.colors.primary + '22'
                                                    } }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Default - No special status" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                        width: '40px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: `2px solid #f59e0b`,
                                                        backgroundColor: '#f59e0b22'
                                                    } }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Orange - Has uncommitted changes" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                        width: '40px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: `2px solid #ff9800`,
                                                        backgroundColor: '#ff980022'
                                                    } }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Orange/Warning - Behind remote (needs pull)" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx("div", { style: {
                                                        width: '40px',
                                                        height: '20px',
                                                        borderRadius: '4px',
                                                        border: `2px solid ${theme.colors.success || '#4caf50'}`,
                                                        backgroundColor: `${theme.colors.success || '#4caf50'}22`
                                                    } }), _jsx("div", { style: { fontSize: '12px', color: theme.colors.textSecondary }, children: "Green - Sync connected or ahead of remote" })] })] })] })] })] }) }));
};
