import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import {
  X,
  GitBranch,
  Clock,
  Activity,
  GitCommit,
  Eye,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { EditorTitlebar } from '../components/Titlebar';
import { FilePanel } from '../components/FilePanel';
import { AgentSessionService } from '../main-process-api/AgentSessionService';
import { AgentSessionEventsService } from '../main-process-api/AgentSessionEventsService';
import { GitService } from '../main-process-api/GitService';
import { ShellService } from '../main-process-api/ShellService';
import { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
// Type alias for backward compatibility
type NormalizedAgentSessionEvent = RepoNormalizedUniversalAgentSessionEvent;
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { EditorId } from '../../shared/types/editor.types';
import {
  GitHubContentProvider,
  LocalFileSystemProvider,
} from '../services/ContentProviders';

interface FileInfo {
  path: string;
  relativePath?: string;
}

// Props for local file editor
interface LocalEditorProps {
  editorType: 'local';
  windowId: string;
  windowTitle?: string;
  files: FileInfo[];
}

// Props for remote file editor
interface RemoteEditorProps {
  editorType: 'remote';
  windowId: string;
  windowTitle?: string;
  files: Array<{ path: string }>;
  owner: string;
  repo: string;
  branch?: string;
}

// Union type for the component props
type MultiFileEditorWindowProps = LocalEditorProps | RemoteEditorProps;

interface FileTab {
  path: string;
  relativePath?: string;
  name: string;
  isModified: boolean;
  lastActivity?: {
    type: 'read' | 'write' | 'edit';
    timestamp: number;
    tool: string;
  };
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked';
}

interface SessionActivity {
  filePath: string;
  type: 'read' | 'write' | 'edit';
  tool: string;
  timestamp: number;
}

export const MultiFileEditorWindow: React.FC<MultiFileEditorWindowProps> = (
  props,
) => {
  const { theme } = useTheme();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [fileActivities, setFileActivities] = useState<
    Map<string, SessionActivity[]>
  >(new Map());
  const [gitStatuses, setGitStatuses] = useState<Map<string, string>>(
    new Map(),
  );
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [preferredEditor, setPreferredEditor] = useState<EditorId>('vscode');

  // Extract common props
  const { windowId, windowTitle, files, editorType } = props;

  // Determine if this is a remote editor
  const isRemoteEditor = editorType === 'remote';

  // Create a stable reference for file paths to avoid infinite loops
  // Use JSON.stringify to create a stable dependency that only changes when paths actually change
  const filePathsString = useMemo(() => JSON.stringify(files.map(f => f.path)), [files]);
  const filePaths = useMemo(() => JSON.parse(filePathsString), [filePathsString]);

  // For local files, find the actual git repository root
  const [repositoryPath, setRepositoryPath] = useState<string>('');

  useEffect(() => {
    const findGitRoot = async () => {
      if (editorType === 'local' && files.length > 0) {
        try {
          // Use the first file's directory to find the git root
          const firstFilePath = files[0].path;
          const lastSlash = firstFilePath.lastIndexOf('/');
          const startDir = lastSlash > 0 ? firstFilePath.substring(0, lastSlash) : '/';

          // Try to find the git root
          const result = await GitService.execCommand(startDir, ['rev-parse', '--show-toplevel']);
          if (result.stdout) {
            setRepositoryPath(result.stdout.trim());
          } else {
            // Fallback to the directory if not a git repo
            setRepositoryPath(startDir);
          }
        } catch (error) {
          console.log('Not a git repository, using file directory');
          const firstFilePath = files[0].path;
          const lastSlash = firstFilePath.lastIndexOf('/');
          setRepositoryPath(lastSlash > 0 ? firstFilePath.substring(0, lastSlash) : '/');
        }
      }
    };

    findGitRoot();
  }, [editorType, files]);

  // Create content provider based on editor type
  const contentProvider = useMemo(() => {
    if (editorType === 'remote' && props.editorType === 'remote') {
      return new GitHubContentProvider(
        props.owner,
        props.repo,
        props.branch || 'main',
      );
    } else {
      return new LocalFileSystemProvider();
    }
  }, [editorType, props]);

  // Initialize tabs from files - only on mount or when file paths actually change
  useEffect(() => {
    setTabs(prevTabs => {
      // If we already have tabs and the file paths haven't changed, keep existing state
      const existingPaths = prevTabs.map(t => t.path).sort().join(',');
      const newPaths = files.map(f => f.path).sort().join(',');

      if (prevTabs.length > 0 && existingPaths === newPaths) {
        return prevTabs;
      }

      // Otherwise create new tabs
      return files.map((file) => ({
        path: file.path,
        relativePath: 'relativePath' in file ? file.relativePath : file.path,
        name: file.path.split('/').pop() || 'Untitled',
        isModified: false,
        gitStatus: undefined,
      }));
    });
  }, [filePathsString]); // Use stable string dependency

  // Load preferred editor
  useEffect(() => {
    UserPreferencesService.getPreferences()
      .then((p) =>
        setPreferredEditor((p.defaultEditor as EditorId) ?? 'vscode'),
      )
      .catch(() => setPreferredEditor('vscode'));
  }, []);

  // Subscribe to real-time session events and load initial events
  // NOTE: This is disabled for now as we're not tracking agent sessions
  useEffect(() => {
    // Agent session tracking disabled - not needed for file editing
    /*
    let unsubscribeCLI: (() => void) | undefined;
    let unsubscribeProcessed: (() => void) | undefined;

    // Load initial events for this session
    const loadInitialEvents = async () => {
      try {
        const events = await AgentSessionService.getSessionEvents(sessionId);

        if (!events) return;

        // Process events to extract file activities
        const activities = new Map<string, SessionActivity[]>();
        const tabUpdates = new Map<string, SessionActivity>();

        events.forEach((event: NormalizedAgentSessionEvent) => {
          if (
            event.toolName &&
            ['Read', 'Write', 'Edit', 'MultiEdit'].includes(event.toolName)
          ) {
            let filePath: string | undefined;

            // Extract file path from tool input
            if (event.toolInput && typeof event.toolInput === 'object') {
              const input = event.toolInput as any;
              filePath = input.file_path || input.path;
            }

            if (filePath) {
              const activity: SessionActivity = {
                filePath,
                type:
                  event.toolName === 'Read'
                    ? 'read'
                    : event.toolName === 'Write'
                      ? 'write'
                      : 'edit',
                tool: event.toolName,
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
        setTabs((prevTabs) =>
          prevTabs.map((tab) => {
            const latestActivity = tabUpdates.get(tab.path);
            if (latestActivity) {
              return {
                ...tab,
                lastActivity: latestActivity,
              };
            }
            return tab;
          }),
        );

        // Session is active if we have events
        if (events.length > 0) {
          setIsSessionActive(true);
        }
      } catch (error) {
        console.error('Error loading initial session events:', error);
      }
    };

    // Handle real-time events
    const handleAgentEvent = (event: any) => {
      // Check if this event belongs to our session
      if (
        event.sessionId !== sessionId &&
        event.data?.session_id !== sessionId
      ) {
        return;
      }

      setIsSessionActive(true);

      // Process normalized events from agent-session:processed-event
      if (event.type === 'processed' && event.normalizedEvent) {
        const normalizedEvent = event.normalizedEvent;

        if (
          normalizedEvent.tool &&
          ['Read', 'Write', 'Edit', 'MultiEdit'].includes(normalizedEvent.tool)
        ) {
          let filePath: string | undefined;

          if (normalizedEvent.parameters) {
            filePath =
              normalizedEvent.parameters.file_path ||
              normalizedEvent.parameters.path;
          }

          if (filePath) {
            const activity: SessionActivity = {
              filePath,
              type:
                normalizedEvent.tool === 'Read'
                  ? 'read'
                  : normalizedEvent.tool === 'Write'
                    ? 'write'
                    : 'edit',
              tool: normalizedEvent.tool,
              timestamp: normalizedEvent.timestamp,
            };

            // Update file activities
            setFileActivities((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(filePath) || [];
              existing.push(activity);
              newMap.set(filePath, existing);
              return newMap;
            });

            // Update tab with last activity
            setTabs((prevTabs) =>
              prevTabs.map((tab) => {
                if (tab.path === filePath) {
                  return {
                    ...tab,
                    lastActivity: activity,
                  };
                }
                return tab;
              }),
            );
          }
        }
      }
    };

    // Load initial events
    loadInitialEvents();

    // Subscribe to real-time events
    unsubscribeCLI = AgentSessionService.onCliProviderEvent(handleAgentEvent);
    unsubscribeProcessed =
      AgentSessionService.onProcessedEvent(handleAgentEvent);

    // Subscribe to the HTTP bridge
    AgentSessionEventsService.subscribe()
      .then((result) => {
        if (result.success) {
          console.log(
            'Subscribed to agent session events on port:',
            result.port,
          );
        }
      })
      .catch((error) => {
        console.error('Failed to subscribe to agent session events:', error);
      });

    return () => {
      if (unsubscribeCLI) unsubscribeCLI();
      if (unsubscribeProcessed) unsubscribeProcessed();
    };
    */
  }, []);

  // Fetch git status for files (only for local repositories)
  useEffect(() => {
    // Skip git status for remote files
    if (editorType === 'remote') {
      return;
    }

    const fetchGitStatus = async () => {
      try {
        const result = await GitService.execCommand(repositoryPath, [
          'status',
          '--porcelain',
          ...filePaths,
        ]);

        if (result && result.stdout) {
          const statuses = new Map<string, string>();
          const lines = result.stdout.split('\n').filter(Boolean);

          lines.forEach((line) => {
            const status = line.substring(0, 2).trim();
            const filePath = line.substring(3);

            let gitStatus: string;
            if (status === 'M') gitStatus = 'modified';
            else if (status === 'A') gitStatus = 'added';
            else if (status === 'D') gitStatus = 'deleted';
            else if (status === '??') gitStatus = 'untracked';
            else gitStatus = 'modified'; // Default for complex statuses

            statuses.set(filePath, gitStatus);
          });

          setGitStatuses(statuses);

          // Update tabs with git status
          setTabs((prevTabs) =>
            prevTabs.map((tab) => {
              const status = statuses.get(tab.relativePath || tab.path);
              return {
                ...tab,
                gitStatus: status as any,
              };
            }),
          );
        }
      } catch (error) {
        console.error('Error fetching git status:', error);
      }
    };

    // Fetch initially and set up interval
    fetchGitStatus();
    const interval = setInterval(fetchGitStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [repositoryPath, filePathsString, editorType]); // Use stable string dependency

  const handleTabClose = (index: number) => {
    const newTabs = [...tabs];
    newTabs.splice(index, 1);
    setTabs(newTabs);

    if (newTabs.length === 0) {
      window.close();
    } else if (index === activeTabIndex) {
      setActiveTabIndex(Math.max(0, index - 1));
    } else if (index < activeTabIndex) {
      setActiveTabIndex(activeTabIndex - 1);
    }
  };

  const getActivityIndicator = (tab: FileTab) => {
    const activities = fileActivities.get(tab.path) || [];
    const recentActivity = activities[activities.length - 1];

    if (!recentActivity) return null;

    const isRecent = Date.now() - recentActivity.timestamp < 5000; // Within last 5 seconds

    if (isRecent && isSessionActive) {
      return (
        <div
          className="activity-pulse"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor:
              recentActivity.type === 'write'
                ? '#ef4444'
                : recentActivity.type === 'edit'
                  ? '#f59e0b'
                  : '#3b82f6',
            animation: 'pulse 1.5s infinite',
            marginLeft: '4px',
          }}
          title={`${recentActivity.type} by ${recentActivity.tool}`}
        />
      );
    }

    return null;
  };

  const getGitStatusBadge = (status?: string) => {
    if (!status) return null;

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

    return (
      <span
        style={{
          marginLeft: '4px',
          padding: '0 4px',
          borderRadius: '3px',
          backgroundColor: colors[status as keyof typeof colors] + '22',
          color: colors[status as keyof typeof colors],
          fontSize: '10px',
          fontWeight: 600,
        }}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const activeTab = tabs[activeTabIndex];

  // Memoize the onModifiedChange callback to prevent infinite re-renders
  const handleModifiedChange = useCallback(
    (isModified: boolean) => {
      setTabs((prevTabs) =>
        prevTabs.map((tab, i) =>
          i === activeTabIndex ? { ...tab, isModified } : tab,
        ),
      );
    },
    [activeTabIndex],
  );

  // Memoize the content loader function to prevent re-renders
  const loadFileContent = useCallback(async () => {
    if (!contentProvider || !activeTab) {
      console.error('[MultiFileEditor] No content provider or active tab available');
      throw new Error('No content provider available');
    }
    try {
      // Path is already correct - absolute for local, relative for remote
      const content = await contentProvider.readFileContent(activeTab.path);
      if (content === null) {
        // File doesn't exist or couldn't be fetched
        throw new Error(
          `File not found: ${activeTab.path}\n\nThis file may have been deleted, renamed, or you may not have access to it.`,
        );
      }
      return content;
    } catch (error) {
      console.error('[MultiFileEditor] Failed to load file:', error);
      // Re-throw with a user-friendly message
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to load file: ${activeTab?.path || 'unknown'}`);
    }
  }, [contentProvider, activeTab?.path]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        overflow: 'hidden',
      }}
    >
      {/* Titlebar */}
      <EditorTitlebar
        fileName={activeTab && files.length > 0 ? files[activeTab]?.path?.split('/').pop() : undefined}
        filePath={activeTab && files.length > 0 ? files[activeTab]?.path : undefined}
        isRemote={isRemoteEditor}
        repository={isRemoteEditor && props.editorType === 'remote' ? `${props.owner}/${props.repo}` : undefined}
        onOpenInGitHub={isRemoteEditor && activeTab !== null && props.editorType === 'remote' ? () => {
          const file = files[activeTab];
          if (file) {
            window.open(`https://github.com/${props.owner}/${props.repo}/blob/${props.branch || 'main'}/${file.path}`, '_blank');
          }
        } : undefined}
      />

      {/* Header */}
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={16} />
          <span style={{ fontWeight: 600 }}>
            {windowTitle || 'File Editor'}
          </span>
          {isSessionActive && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: theme.colors.success + '22',
                color: theme.colors.success,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Activity size={12} />
              Active
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>

          <button
            onClick={async () => {
              try {
                // Open all files in the external editor
                const filePaths = tabs.map((tab) => tab.path);
                const result = await ShellService.openInEditor({
                  editor: preferredEditor,
                  files: filePaths,
                });

                if (!result.success) {
                  console.error(
                    'Failed to open files in editor:',
                    result.error,
                  );
                }
              } catch (error) {
                console.error('Error opening files in editor:', error);
              }
            }}
            style={{
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
            }}
            title={`Open all files in ${preferredEditor}`}
          >
            <ExternalLink size={12} />
            Open in Editor
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.border}`,
          overflowX: 'auto',
        }}
      >
        {tabs.map((tab, index) => (
          <div
            key={tab.path}
            onClick={() => setActiveTabIndex(index)}
            style={{
              padding: '8px 12px',
              borderRight: `1px solid ${theme.colors.border}`,
              backgroundColor:
                index === activeTabIndex
                  ? theme.colors.background
                  : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              minWidth: 0,
              position: 'relative',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tab.name}
            </span>
            {getGitStatusBadge(tab.gitStatus)}
            {getActivityIndicator(tab)}
            {tab.isModified && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.textSecondary,
                  marginLeft: '4px',
                }}
              />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleTabClose(index);
              }}
              style={{
                marginLeft: '8px',
                padding: '2px',
                borderRadius: '3px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: theme.colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      {activeTab && (
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {/* Use FilePanel which handles both normal view and diff view */}
          <FilePanel
            key={activeTab.path}
            filePath={activeTab.path}
            displayPath={activeTab.relativePath || activeTab.path}
            repositoryPath={editorType === 'local' ? repositoryPath : undefined}
            className="full-height"
            editable={!isRemoteEditor} // Editable for local files, read-only for remote
            enableVimMode={true}
            onModifiedChange={handleModifiedChange}
            contentLoader={isRemoteEditor ? loadFileContent : undefined}
            onSave={!isRemoteEditor ? async (content: string) => {
              // Save to local file system
              const { FileSystemService } = await import('../main-process-api/FileSystemService');
              await FileSystemService.writeFile(activeTab.path, content);
            } : undefined}
          />

          {/* Activity overlay */}
          {activeTab.lastActivity && isSessionActive && (
            <div
              style={{
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
              }}
            >
              <Activity size={12} />
              <span>
                Last {activeTab.lastActivity.type} by{' '}
                {activeTab.lastActivity.tool}
              </span>
              <Clock size={12} />
              <span>
                {new Date(
                  activeTab.lastActivity.timestamp,
                ).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Style for pulse animation */}
      <style>{`
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
      `}</style>
    </div>
  );
};
