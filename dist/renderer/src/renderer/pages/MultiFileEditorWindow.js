import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { X, Clock, Activity, GitCommit, FileText, ExternalLink } from 'lucide-react';
import { WatchingFileViewer } from './LandingPage/AgentConfigurationView/WatchingFileViewer';
import { FileViewer } from '../components/FileViewer';
import { DiffViewer } from '../components/DiffViewer';
import { AgentSessionService } from '../main-process-api/AgentSessionService';
import { AgentSessionEventsService } from '../main-process-api/AgentSessionEventsService';
import { GitService } from '../main-process-api/GitService';
import { ShellService } from '../main-process-api/ShellService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { GitHubContentProvider, LocalFileSystemProvider } from '../services/ContentProviders';
export const MultiFileEditorWindow = ({ sessionId, sessionName, files, repositoryPath, isRemote = false, remoteInfo, isLocal = false, localInfo, }) => {
    const { theme } = useTheme();
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const [tabs, setTabs] = useState([]);
    const [fileActivities, setFileActivities] = useState(new Map());
    const [showDiff, setShowDiff] = useState(false);
    const [gitStatuses, setGitStatuses] = useState(new Map());
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [preferredEditor, setPreferredEditor] = useState('vscode');
    // Create a stable reference for file paths to avoid infinite loops
    const filePaths = useMemo(() => files.map(f => f.path), [files]);
    // Create content provider based on whether files are local or remote
    const contentProvider = useMemo(() => {
        if (isRemote && remoteInfo) {
            return new GitHubContentProvider(remoteInfo.owner, remoteInfo.repo, remoteInfo.branch || 'main');
        }
        else if (isLocal || localInfo) {
            return new LocalFileSystemProvider();
        }
        return null;
    }, [isRemote, remoteInfo, isLocal, localInfo]);
    // Initialize tabs from files
    useEffect(() => {
        const initialTabs = files.map(file => ({
            path: file.path,
            relativePath: file.relativePath,
            name: file.path.split('/').pop() || 'Untitled', // Just the filename
            isModified: false,
            gitStatus: undefined,
        }));
        setTabs(initialTabs);
    }, [files]);
    // Load preferred editor
    useEffect(() => {
        UserPreferencesService.getPreferences()
            .then((p) => setPreferredEditor(p.defaultEditor ?? 'vscode'))
            .catch(() => setPreferredEditor('vscode'));
    }, []);
    // Subscribe to real-time session events and load initial events
    useEffect(() => {
        let unsubscribeCLI;
        let unsubscribeProcessed;
        // Load initial events for this session
        const loadInitialEvents = async () => {
            try {
                const events = await AgentSessionService.getSessionEvents(sessionId);
                if (!events)
                    return;
                // Process events to extract file activities
                const activities = new Map();
                const tabUpdates = new Map();
                events.forEach((event) => {
                    if (event.tool && ['Read', 'Write', 'Edit', 'MultiEdit'].includes(event.tool)) {
                        let filePath;
                        // Extract file path from tool parameters
                        if (event.parameters) {
                            filePath = event.parameters.file_path || event.parameters.path;
                        }
                        if (filePath) {
                            const activity = {
                                filePath,
                                type: event.tool === 'Read' ? 'read' :
                                    (event.tool === 'Write' ? 'write' : 'edit'),
                                tool: event.tool,
                                timestamp: event.timestamp,
                            };
                            const existing = activities.get(filePath) || [];
                            existing.push(activity);
                            activities.set(filePath, existing);
                            // Track the latest activity for each file
                            tabUpdates.set(filePath, activity);
                        }
                    }
                });
                setFileActivities(activities);
                // Update tabs with latest activities
                setTabs(prevTabs => prevTabs.map(tab => {
                    const latestActivity = tabUpdates.get(tab.path);
                    if (latestActivity) {
                        return {
                            ...tab,
                            lastActivity: latestActivity,
                        };
                    }
                    return tab;
                }));
                // Session is active if we have events
                if (events.length > 0) {
                    setIsSessionActive(true);
                }
            }
            catch (error) {
                console.error('Error loading initial session events:', error);
            }
        };
        // Handle real-time events
        const handleAgentEvent = (event) => {
            // Check if this event belongs to our session
            if (event.sessionId !== sessionId && event.data?.session_id !== sessionId) {
                return;
            }
            setIsSessionActive(true);
            // Process normalized events from agent-session:processed-event
            if (event.type === 'processed' && event.normalizedEvent) {
                const normalizedEvent = event.normalizedEvent;
                if (normalizedEvent.tool && ['Read', 'Write', 'Edit', 'MultiEdit'].includes(normalizedEvent.tool)) {
                    let filePath;
                    if (normalizedEvent.parameters) {
                        filePath = normalizedEvent.parameters.file_path || normalizedEvent.parameters.path;
                    }
                    if (filePath) {
                        const activity = {
                            filePath,
                            type: normalizedEvent.tool === 'Read' ? 'read' :
                                (normalizedEvent.tool === 'Write' ? 'write' : 'edit'),
                            tool: normalizedEvent.tool,
                            timestamp: normalizedEvent.timestamp,
                        };
                        // Update file activities
                        setFileActivities(prev => {
                            const newMap = new Map(prev);
                            const existing = newMap.get(filePath) || [];
                            existing.push(activity);
                            newMap.set(filePath, existing);
                            return newMap;
                        });
                        // Update tab with last activity
                        setTabs(prevTabs => prevTabs.map(tab => {
                            if (tab.path === filePath) {
                                return {
                                    ...tab,
                                    lastActivity: activity,
                                };
                            }
                            return tab;
                        }));
                    }
                }
            }
        };
        // Load initial events
        loadInitialEvents();
        // Subscribe to real-time events
        unsubscribeCLI = AgentSessionService.onCliProviderEvent(handleAgentEvent);
        unsubscribeProcessed = AgentSessionService.onProcessedEvent(handleAgentEvent);
        // Subscribe to the HTTP bridge
        AgentSessionEventsService.subscribe().then((result) => {
            if (result.success) {
                console.log('Subscribed to agent session events on port:', result.port);
            }
        }).catch(error => {
            console.error('Failed to subscribe to agent session events:', error);
        });
        return () => {
            if (unsubscribeCLI)
                unsubscribeCLI();
            if (unsubscribeProcessed)
                unsubscribeProcessed();
        };
    }, [sessionId]);
    // Fetch git status for files (only for local repositories)
    useEffect(() => {
        // Skip git status for remote files
        if (isRemote) {
            return;
        }
        const fetchGitStatus = async () => {
            try {
                const result = await GitService.execCommand(repositoryPath, ['status', '--porcelain', ...filePaths]);
                if (result && result.stdout) {
                    const statuses = new Map();
                    const lines = result.stdout.split('\n').filter(Boolean);
                    lines.forEach(line => {
                        const status = line.substring(0, 2).trim();
                        const filePath = line.substring(3);
                        let gitStatus;
                        if (status === 'M')
                            gitStatus = 'modified';
                        else if (status === 'A')
                            gitStatus = 'added';
                        else if (status === 'D')
                            gitStatus = 'deleted';
                        else if (status === '??')
                            gitStatus = 'untracked';
                        else
                            gitStatus = 'modified'; // Default for complex statuses
                        statuses.set(filePath, gitStatus);
                    });
                    setGitStatuses(statuses);
                    // Update tabs with git status
                    setTabs(prevTabs => prevTabs.map(tab => {
                        const status = statuses.get(tab.relativePath || tab.path);
                        return {
                            ...tab,
                            gitStatus: status,
                        };
                    }));
                }
            }
            catch (error) {
                console.error('Error fetching git status:', error);
            }
        };
        // Fetch initially and set up interval
        fetchGitStatus();
        const interval = setInterval(fetchGitStatus, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, [repositoryPath, filePaths, isRemote]);
    const handleTabClose = (index) => {
        const newTabs = [...tabs];
        newTabs.splice(index, 1);
        setTabs(newTabs);
        if (newTabs.length === 0) {
            window.close();
        }
        else if (index === activeTabIndex) {
            setActiveTabIndex(Math.max(0, index - 1));
        }
        else if (index < activeTabIndex) {
            setActiveTabIndex(activeTabIndex - 1);
        }
    };
    const getActivityIndicator = (tab) => {
        const activities = fileActivities.get(tab.path) || [];
        const recentActivity = activities[activities.length - 1];
        if (!recentActivity)
            return null;
        const isRecent = Date.now() - recentActivity.timestamp < 5000; // Within last 5 seconds
        if (isRecent && isSessionActive) {
            return (_jsx("div", { className: "activity-pulse", style: {
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: recentActivity.type === 'write' ? '#ef4444' :
                        recentActivity.type === 'edit' ? '#f59e0b' : '#3b82f6',
                    animation: 'pulse 1.5s infinite',
                    marginLeft: '4px',
                }, title: `${recentActivity.type} by ${recentActivity.tool}` }));
        }
        return null;
    };
    const getGitStatusBadge = (status) => {
        if (!status)
            return null;
        const colors = {
            modified: '#f59e0b',
            added: '#10b981',
            deleted: '#ef4444',
            untracked: '#6b7280',
        };
        const labels = {
            modified: 'M',
            added: 'A',
            deleted: 'D',
            untracked: 'U',
        };
        return (_jsx("span", { style: {
                marginLeft: '4px',
                padding: '0 4px',
                borderRadius: '3px',
                backgroundColor: colors[status] + '22',
                color: colors[status],
                fontSize: '10px',
                fontWeight: 600,
            }, children: labels[status] }));
    };
    const activeTab = tabs[activeTabIndex];
    // Memoize the onModifiedChange callback to prevent infinite re-renders
    const handleModifiedChange = useCallback((isModified) => {
        setTabs(prevTabs => prevTabs.map((tab, i) => i === activeTabIndex ? { ...tab, isModified } : tab));
    }, [activeTabIndex]);
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
        }, children: [_jsxs("div", { style: {
                    padding: '8px 16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [_jsx(FileText, { size: 16 }), _jsx("span", { style: { fontWeight: 600 }, children: sessionName || `Session ${sessionId.substring(0, 8)}` }), isSessionActive && (_jsxs("span", { style: {
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: theme.colors.success + '22',
                                    color: theme.colors.success,
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }, children: [_jsx(Activity, { size: 12 }), "Active"] }))] }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsxs("button", { onClick: () => setShowDiff(!showDiff), style: {
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    backgroundColor: showDiff ? theme.colors.primary : 'transparent',
                                    color: showDiff ? '#fff' : theme.colors.text,
                                    border: `1px solid ${showDiff ? theme.colors.primary : theme.colors.border}`,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px',
                                }, children: [_jsx(GitCommit, { size: 12 }), showDiff ? 'Hide Diff' : 'Show Diff'] }), _jsxs("button", { onClick: async () => {
                                    try {
                                        // Open all files in the external editor
                                        const filePaths = tabs.map(tab => tab.path);
                                        const result = await ShellService.openInEditor({
                                            editor: preferredEditor,
                                            files: filePaths,
                                        });
                                        if (!result.success) {
                                            console.error('Failed to open files in editor:', result.error);
                                        }
                                    }
                                    catch (error) {
                                        console.error('Error opening files in editor:', error);
                                    }
                                }, style: {
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    color: theme.colors.text,
                                    border: `1px solid ${theme.colors.border}`,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px',
                                }, title: `Open all files in ${preferredEditor}`, children: [_jsx(ExternalLink, { size: 12 }), "Open in Editor"] })] })] }), _jsx("div", { style: {
                    display: 'flex',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    overflowX: 'auto',
                }, children: tabs.map((tab, index) => (_jsxs("div", { onClick: () => setActiveTabIndex(index), style: {
                        padding: '8px 12px',
                        borderRight: `1px solid ${theme.colors.border}`,
                        backgroundColor: index === activeTabIndex ? theme.colors.background : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        minWidth: 0,
                        position: 'relative',
                    }, children: [_jsx("span", { style: {
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }, children: tab.name }), getGitStatusBadge(tab.gitStatus), getActivityIndicator(tab), tab.isModified && (_jsx("span", { style: {
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: theme.colors.textSecondary,
                                marginLeft: '4px',
                            } })), _jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                handleTabClose(index);
                            }, style: {
                                marginLeft: '8px',
                                padding: '2px',
                                borderRadius: '3px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                color: theme.colors.textSecondary,
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }, children: _jsx(X, { size: 12 }) })] }, tab.path))) }), activeTab && (_jsxs("div", { style: { flex: 1, position: 'relative' }, children: [showDiff ? (
                    // Show diff view
                    _jsx(DiffViewer, { filePath: activeTab.path, repositoryPath: repositoryPath, gitStatus: activeTab.gitStatus })) : (isRemote || isLocal) && contentProvider ? (
                    // Show FileViewer with content provider for remote or local files
                    _jsx(FileViewer, { filePath: activeTab.path, displayPath: activeTab.relativePath || activeTab.path, className: "full-height", editable: false, contentLoader: async () => {
                            if (!contentProvider) {
                                console.error('[MultiFileEditor] No content provider available');
                                throw new Error('No content provider available');
                            }
                            try {
                                console.log('[MultiFileEditor] Loading file:', {
                                    path: activeTab.path,
                                    relativePath: activeTab.relativePath,
                                    isRemote,
                                    isLocal,
                                    localInfo,
                                    remoteInfo
                                });
                                // For local files, we need to pass the full path
                                const pathToLoad = isLocal && localInfo ?
                                    (activeTab.path.startsWith('/') ? activeTab.path : `${localInfo.path}/${activeTab.path}`) :
                                    activeTab.path;
                                const content = await contentProvider.readFileContent(pathToLoad);
                                if (content === null) {
                                    // File doesn't exist or couldn't be fetched
                                    throw new Error(`File not found: ${activeTab.path}\n\nThis file may have been deleted, renamed, or you may not have access to it.`);
                                }
                                return content;
                            }
                            catch (error) {
                                console.error('[MultiFileEditor] Failed to load file:', error);
                                // Re-throw with a user-friendly message
                                if (error instanceof Error) {
                                    throw error;
                                }
                                throw new Error(`Failed to load file: ${activeTab.path}`);
                            }
                        } }, activeTab.path)) : (
                    // Show WatchingFileViewer for local files without content provider (legacy mode)
                    _jsx(WatchingFileViewer, { filePath: activeTab.path, className: "full-height", editable: true, onModifiedChange: handleModifiedChange }, activeTab.path)), activeTab.lastActivity && isSessionActive && (_jsxs("div", { style: {
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            border: `1px solid ${theme.colors.border}`,
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }, children: [_jsx(Activity, { size: 12 }), _jsxs("span", { children: ["Last ", activeTab.lastActivity.type, " by ", activeTab.lastActivity.tool] }), _jsx(Clock, { size: 12 }), _jsx("span", { children: new Date(activeTab.lastActivity.timestamp).toLocaleTimeString() })] }))] })), _jsx("style", { children: `
        @keyframes pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .full-height {
          height: 100%;
        }
      ` })] }));
};
