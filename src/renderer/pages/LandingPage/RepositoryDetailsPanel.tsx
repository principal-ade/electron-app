import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, GitBranch, Trash2, ExternalLink, Code, ChevronDown, Terminal, Plus } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import type { AlexandriaEntry } from '@a24z/core-library';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { WindowService } from '../../main-process-api/WindowService';
import { RemoveRepositoryDialog } from '../../components/dialogs/RemoveRepositoryDialog';
import { ShellService } from '../../main-process-api/ShellService';
import { TerminalService } from '../../main-process-api/TerminalService';
import { AddNoteModal } from '../../components/landing-page/AddNoteModal';
import { RepositoryNotesPanel } from '../../components/landing-page/RepositoryNotesPanel';

interface EnhancedAlexandriaEntry extends AlexandriaEntry {
  gitBranch?: string;
  isDirty?: boolean;
  dirtyFileCount?: number;
  mostRecentChange?: string;
}

interface GitStatus {
  staged: Array<{ path: string; lastModified?: string }>;
  unstaged: Array<{ path: string; lastModified?: string }>;
  untracked: Array<{ path: string; lastModified?: string }>;
}

interface RepositoryDetailsPanelProps {
  selectedRepository: EnhancedAlexandriaEntry | null;
  repositories: EnhancedAlexandriaEntry[];
  markdownFiles: Array<{ path: string; lastModified?: string }>;
  gitStatus: GitStatus;
  isLoadingDocs: boolean;
  isLoadingGitStatus: boolean;
  onOpenDashboard: (repo: EnhancedAlexandriaEntry) => void;
  onRepositoryRemoved?: (removedRepoName: string) => void;
}

export const RepositoryDetailsPanel: React.FC<RepositoryDetailsPanelProps> = ({
  selectedRepository,
  repositories,
  markdownFiles,
  gitStatus,
  isLoadingDocs,
  isLoadingGitStatus,
  onOpenDashboard,
  onRepositoryRemoved,
}) => {
  const { theme } = useTheme();
  const [isCommitExpanded, setIsCommitExpanded] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showIdeDropdown, setShowIdeDropdown] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const ideDropdownRef = useRef<HTMLDivElement>(null);
  
  // Track terminal windows by repository path
  const [terminalWindows, setTerminalWindows] = useState<Map<string, number>>(new Map());

  const handleRemoveClick = () => {
    setShowRemoveDialog(true);
  };

  const handleRemoveConfirm = async (deleteLocal: boolean) => {
    if (!selectedRepository) return;

    try {
      const success = await AlexandriaService.removeRepository(
        selectedRepository.name,
        deleteLocal
      );

      if (success) {
        setShowRemoveDialog(false);
        // Notify parent component to update state immediately
        if (onRepositoryRemoved) {
          onRepositoryRemoved(selectedRepository.name);
        }
      } else {
        console.error('Failed to remove repository');
      }
    } catch (err) {
      console.error('Error removing repository:', err);
    }
  };

  const handleRemoveCancel = () => {
    setShowRemoveDialog(false);
  };

  const handleOpenInIDE = useCallback(async (editor: 'vscode' | 'cursor' | 'webstorm' | 'sublime' | 'intellij') => {
    if (!selectedRepository?.path) return;
    
    try {
      const result = await ShellService.openInEditor({
        editor,
        dir: selectedRepository.path
      });
      
      if (!result.success) {
        console.error('Failed to open in IDE:', result.error);
        // You could show a toast notification here
      }
    } catch (error) {
      console.error('Error opening in IDE:', error);
    }
    
    setShowIdeDropdown(false);
  }, [selectedRepository]);

  const handleOpenInDefaultIDE = useCallback(async () => {
    if (!selectedRepository?.path) return;
    
    try {
      const result = await ShellService.openInDefaultEditor(selectedRepository.path);
      if (!result.success) {
        console.error('Failed to open in default IDE:', result.error);
        // You could show a toast notification here
      }
    } catch (error) {
      console.error('Error opening in default IDE:', error);
    }
    
    setShowIdeDropdown(false);
  }, [selectedRepository]);

  const handleOpenTerminal = useCallback(async () => {
    if (!selectedRepository?.path) return;
    
    try {
      // Check if we already have a terminal window for this repository
      const existingWindowId = terminalWindows.get(selectedRepository.path);
      
      if (existingWindowId) {
        // Try to focus the existing terminal window
        try {
          await TerminalService.focusWindow(existingWindowId);
          console.log(`[RepositoryDetailsPanel] Focused existing terminal window ${existingWindowId} for ${selectedRepository.path}`);
          return;
        } catch (focusError) {
          console.warn('Failed to focus existing terminal window, will create new one:', focusError);
          // Remove the invalid window ID from our tracking
          setTerminalWindows(prev => {
            const newMap = new Map(prev);
            newMap.delete(selectedRepository.path);
            return newMap;
          });
        }
      }
      
      // Create or get existing terminal for this directory
      const terminalId = await TerminalService.getOrCreate(selectedRepository.path);
      
      // Pop out the terminal to a new window
      const { windowId } = await TerminalService.popOut(terminalId);
      
      // Track the new terminal window for this repository
      setTerminalWindows(prev => new Map(prev).set(selectedRepository.path, windowId));
      
      console.log(`[RepositoryDetailsPanel] Created new terminal window ${windowId} for ${selectedRepository.path}`);
    } catch (error) {
      console.error('Error opening terminal:', error);
      // You could show a toast notification here
    }
  }, [selectedRepository, terminalWindows]);

  // Handle click outside IDE dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ideDropdownRef.current &&
        !ideDropdownRef.current.contains(event.target as Node)
      ) {
        setShowIdeDropdown(false);
      }
    };

    if (showIdeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIdeDropdown]);

  // Listen for terminal window close events to clean up tracking
  useEffect(() => {
    const handleTerminalWindowClose = (data: { terminalId?: string; agentSessionId?: string; windowId: number }) => {
      // Find and remove the closed window from our tracking
      setTerminalWindows(prev => {
        const newMap = new Map(prev);
        for (const [path, windowId] of newMap.entries()) {
          if (windowId === data.windowId) {
            newMap.delete(path);
            console.log(`[RepositoryDetailsPanel] Cleaned up closed terminal window ${windowId} for ${path}`);
            break;
          }
        }
        return newMap;
      });
    };

    const unsubscribe = TerminalService.onWindowClose(handleTerminalWindowClose);
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Handle file click to open in multi-file editor window
  const handleFileClick = useCallback(
    async (filePath: string) => {
      if (!selectedRepository) return;

      try {
        // Get the absolute file path
        const absolutePath = `${selectedRepository.path}/${filePath}`;

        // Prepare file info for the multi-file editor
        const files = [
          {
            path: absolutePath,
            relativePath: filePath,
            lastModified: Date.now(),
          },
        ];

        // Parse owner and repo from repository name or github info
        let owner = 'local';
        let repo = selectedRepository.name;

        if (selectedRepository.github?.owner) {
          owner = selectedRepository.github.owner;
        }
        if (selectedRepository.github?.name) {
          repo = selectedRepository.github.name;
        }

        // Open the local files editor window
        await WindowService.openLocalFiles({
          windowId: `view-${owner}-${repo}-${Date.now()}`,
          windowTitle: `View ${filePath}`,
          files,
        });
      } catch (error) {
        console.error(
          '[RepositoryDetailsPanel] Error opening file:',
          error,
        );
      }
    },
    [selectedRepository],
  );

  // Format relative time
  const getRelativeTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 30) return `${Math.floor(days / 30)} months ago`;
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  return (
    <div
      style={{
        height: '100%',
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {selectedRepository ? (
        <>
          {/* Repository Header */}
          <div
            style={{
              padding: '20px',
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundLight,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[5], // 24px
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '4px',
                  }}
                >
                  {selectedRepository.name}
                </h2>
                <div
                  style={{
                    fontSize: theme.fontSizes[0], // 12px
                    color: theme.colors.textSecondary,
                    fontFamily: 'monospace',
                    marginTop: '4px',
                    marginBottom: selectedRepository.github?.description ? '8px' : '0',
                  }}
                >
                  {selectedRepository.path}
                </div>
                {selectedRepository.github?.description && (
                  <p
                    style={{
                      margin: '0',
                      fontSize: theme.fontSizes[1], // 14px
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {selectedRepository.github.description}
                  </p>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <button
                  onClick={() => setShowAddNoteModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: theme.colors.primary,
                    border: `1px solid ${theme.colors.primary}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Add a note to this repository"
                >
                  <Plus size={14} />
                  Add Note
                </button>
                <button
                  onClick={() => onOpenDashboard(selectedRepository)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background,
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <ExternalLink size={14} />
                  Open Dashboard
                </button>
                {/* IDE Dropdown */}
                <div ref={ideDropdownRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowIdeDropdown(!showIdeDropdown)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      color: theme.colors.text,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                    title="Open in external IDE"
                  >
                    <Code size={14} />
                    Open in IDE
                    <ChevronDown size={12} />
                  </button>

                  {/* IDE Dropdown Menu */}
                  {showIdeDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        minWidth: '180px',
                        zIndex: 1000,
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={handleOpenInDefaultIDE}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          color: theme.colors.text,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500,
                          textAlign: 'left',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Code size={16} />
                        Default (VS Code)
                      </button>

                      <div
                        style={{
                          height: '1px',
                          backgroundColor: theme.colors.border,
                        }}
                      />

                      <button
                        onClick={() => handleOpenInIDE('vscode')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          color: theme.colors.text,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500,
                          textAlign: 'left',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Code size={16} />
                        VS Code
                      </button>

                      <button
                        onClick={() => handleOpenInIDE('cursor')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          color: theme.colors.text,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500,
                          textAlign: 'left',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Code size={16} />
                        Cursor
                      </button>

                      <button
                        onClick={() => handleOpenInIDE('webstorm')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          color: theme.colors.text,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500,
                          textAlign: 'left',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Code size={16} />
                        WebStorm
                      </button>

                      <button
                        onClick={() => handleOpenInIDE('sublime')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          color: theme.colors.text,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500,
                          textAlign: 'left',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Code size={16} />
                        Sublime Text
                      </button>

                      <button
                        onClick={() => handleOpenInIDE('intellij')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'transparent',
                          color: theme.colors.text,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500,
                          textAlign: 'left',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Code size={16} />
                        IntelliJ IDEA
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleOpenTerminal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                  title={
                    selectedRepository?.path && terminalWindows.has(selectedRepository.path)
                      ? "Focus existing terminal window"
                      : "Open terminal in repository directory"
                  }
                >
                  <Terminal size={14} />
                  {selectedRepository?.path && terminalWindows.has(selectedRepository.path)
                    ? "Focus Terminal"
                    : "Terminal"
                  }
                </button>

                <button
                  onClick={handleRemoveClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    color: theme.colors.error || '#ef4444',
                    border: `1px solid ${theme.colors.error || '#ef4444'}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${theme.colors.error || '#ef4444'}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Remove repository from Alexandria"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          </div>

          {/* Repository Info */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              {/* Stats Cards */}
              {selectedRepository.github?.stars && (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Stars
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme.colors.text,
                      fontWeight: 500,
                    }}
                  >
                    {selectedRepository.github.stars}
                  </div>
                </div>
              )}

              {selectedRepository.github?.primaryLanguage && (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Language
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme.colors.text,
                      fontWeight: 500,
                    }}
                  >
                    {selectedRepository.github.primaryLanguage}
                  </div>
                </div>
              )}
            </div>

            {/* Topics */}
            {selectedRepository?.github?.topics && selectedRepository.github.topics.length > 0 && (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginBottom: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Topics
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  {selectedRepository?.github?.topics.map((topic) => (
                    <span
                      key={topic}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: `${theme.colors.primary}20`,
                        color: theme.colors.primary,
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 500,
                      }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Git Changes and Repository Content Side-by-Side */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginTop: '24px',
              }}
            >
              {/* Git Changes List or Last Commit */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                  height: 'fit-content',
                }}
              >
                {/* Show Git Changes if there are any */}
                {(gitStatus.staged.length > 0 || gitStatus.unstaged.length > 0 || gitStatus.untracked.length > 0) ? (
                  <>
                    <div
                      style={{
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        marginBottom: '12px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <GitBranch size={12} />
                        Git Changes
                      </span>
                      <span style={{ fontSize: theme.fontSizes[0], fontWeight: 'normal' }}>
                        {isLoadingGitStatus ? 'Loading...' :
                          `${gitStatus.staged.length + gitStatus.unstaged.length + gitStatus.untracked.length} changes`
                        }
                      </span>
                    </div>
                    <div
                      style={{
                        maxHeight: '300px',
                        overflow: 'auto',
                      }}
                    >
                      {isLoadingGitStatus ? (
                        <div
                          style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: theme.colors.textSecondary,
                            fontSize: '12px',
                          }}
                        >
                          Loading git status...
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          {/* Staged Files */}
                          {gitStatus.staged.length > 0 && (
                            <>
                              <div
                                style={{
                                  fontSize: '10px',
                                  color: theme.colors.textSecondary,
                                  fontWeight: 600,
                                  marginTop: '4px',
                                }}
                              >
                                STAGED ({gitStatus.staged.length})
                              </div>
                              {gitStatus.staged.map((file) => {
                                const filename = file.path.split('/').pop() || file.path;
                                const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                                return (
                                  <div
                                    key={`staged-${file.path}`}
                                    style={{
                                      padding: '10px',
                                      backgroundColor: `${theme.colors.success}10`,
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        `${theme.colors.success}20`;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        `${theme.colors.success}10`;
                                    }}
                                    onClick={() => handleFileClick(file.path)}
                                    title={file.path}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '2px',
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: theme.fontSizes[1], // 14px
                                          color: theme.colors.success,
                                          fontWeight: 500,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          flex: 1,
                                        }}
                                      >
                                        ✓ {filename}
                                      </div>
                                      {file.lastModified && (
                                        <div
                                          style={{
                                            fontSize: theme.fontSizes[0], // 12px
                                            color: theme.colors.success,
                                            opacity: 0.7,
                                            whiteSpace: 'nowrap',
                                            marginLeft: '8px',
                                          }}
                                        >
                                          {getRelativeTime(file.lastModified)}
                                        </div>
                                      )}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: theme.fontSizes[0], // 12px
                                        color: theme.colors.success,
                                        opacity: 0.6,
                                        fontFamily: 'monospace',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {directory === 'root' ? 'root' : `${directory}/`}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}

                          {/* Unstaged Files */}
                          {gitStatus.unstaged.length > 0 && (
                            <>
                              <div
                                style={{
                                  fontSize: '10px',
                                  color: theme.colors.textSecondary,
                                  fontWeight: 600,
                                  marginTop: '4px',
                                }}
                              >
                                MODIFIED ({gitStatus.unstaged.length})
                              </div>
                              {gitStatus.unstaged.map((file) => {
                                const filename = file.path.split('/').pop() || file.path;
                                const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                                return (
                                  <div
                                    key={`unstaged-${file.path}`}
                                    style={{
                                      padding: '10px',
                                      backgroundColor: `${theme.colors.warning}10`,
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        `${theme.colors.warning}20`;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        `${theme.colors.warning}10`;
                                    }}
                                    onClick={() => handleFileClick(file.path)}
                                    title={file.path}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '2px',
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: theme.fontSizes[1], // 14px
                                          color: theme.colors.warning,
                                          fontWeight: 500,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          flex: 1,
                                        }}
                                      >
                                        ✎ {filename}
                                      </div>
                                      {file.lastModified && (
                                        <div
                                          style={{
                                            fontSize: theme.fontSizes[0], // 12px
                                            color: theme.colors.warning,
                                            opacity: 0.7,
                                            whiteSpace: 'nowrap',
                                            marginLeft: '8px',
                                          }}
                                        >
                                          {getRelativeTime(file.lastModified)}
                                        </div>
                                      )}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: theme.fontSizes[0], // 12px
                                        color: theme.colors.warning,
                                        opacity: 0.6,
                                        fontFamily: 'monospace',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {directory === 'root' ? 'root' : `${directory}/`}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}

                          {/* Untracked Files */}
                          {gitStatus.untracked.length > 0 && (
                            <>
                              <div
                                style={{
                                  fontSize: '10px',
                                  color: theme.colors.textSecondary,
                                  fontWeight: 600,
                                  marginTop: '4px',
                                }}
                              >
                                UNTRACKED ({gitStatus.untracked.length})
                              </div>
                              {gitStatus.untracked.map((file) => {
                                const filename = file.path.split('/').pop() || file.path;
                                const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                                return (
                                  <div
                                    key={`untracked-${file.path}`}
                                    style={{
                                      padding: '10px',
                                      backgroundColor: theme.colors.background,
                                      border: `1px dashed ${theme.colors.border}`,
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        theme.colors.backgroundTertiary;
                                      e.currentTarget.style.color = theme.colors.text;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        theme.colors.background;
                                      e.currentTarget.style.color = theme.colors.textSecondary;
                                    }}
                                    onClick={() => handleFileClick(file.path)}
                                    title={file.path}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '2px',
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: theme.fontSizes[1], // 14px
                                          color: 'inherit',
                                          fontWeight: 500,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          flex: 1,
                                        }}
                                      >
                                        ? {filename}
                                      </div>
                                      {file.lastModified && (
                                        <div
                                          style={{
                                            fontSize: theme.fontSizes[0], // 12px
                                            opacity: 0.7,
                                            whiteSpace: 'nowrap',
                                            marginLeft: '8px',
                                          }}
                                        >
                                          {getRelativeTime(file.lastModified)}
                                        </div>
                                      )}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: theme.fontSizes[0], // 12px
                                        opacity: 0.6,
                                        fontFamily: 'monospace',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {directory === 'root' ? 'root' : `${directory}/`}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Show Last Commit when there are no changes */
                  (selectedRepository.github as any)?.lastCommitMessage ? (() => {
                    const commitMessage = (selectedRepository.github as any).lastCommitMessage;
                    const lines = commitMessage.split('\n');
                    const firstLine = lines[0];
                    const hasMoreContent = lines.length > 1 && lines.slice(1).some((line: string) => line.trim());

                    return (
                      <>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            marginBottom: '12px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <GitBranch size={12} />
                            Last Commit
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              padding: '12px',
                              backgroundColor: theme.colors.background,
                              borderRadius: '6px',
                              border: `1px solid ${theme.colors.border}`,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                marginBottom: '8px',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: theme.fontSizes[1], // 14px
                                  color: theme.colors.text,
                                  fontWeight: 500,
                                  flex: 1,
                                  marginRight: '8px',
                                  lineHeight: '1.4',
                                }}
                              >
                                {firstLine}
                              </div>
                              {hasMoreContent && (
                                <button
                                  onClick={() => setIsCommitExpanded(!isCommitExpanded)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    backgroundColor: 'transparent',
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '4px',
                                    color: theme.colors.textSecondary,
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                    e.currentTarget.style.color = theme.colors.primary;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = theme.colors.border;
                                    e.currentTarget.style.color = theme.colors.textSecondary;
                                  }}
                                >
                                  <ChevronRight
                                    size={10}
                                    style={{
                                      transform: isCommitExpanded ? 'rotate(90deg)' : 'rotate(0)',
                                      transition: 'transform 0.2s',
                                    }}
                                  />
                                  {isCommitExpanded ? 'Hide' : 'Show'}
                                </button>
                              )}
                            </div>

                            {/* Full Commit Message (when expanded) */}
                            {hasMoreContent && isCommitExpanded && (
                              <div
                                style={{
                                  padding: '8px',
                                  backgroundColor: theme.colors.backgroundSecondary,
                                  borderRadius: '4px',
                                  marginBottom: '8px',
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: theme.colors.textSecondary,
                                    lineHeight: '1.4',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {lines.slice(1).join('\n').trim()}
                                </div>
                              </div>
                            )}

                            {/* Commit Metadata */}
                            <div
                              style={{
                                fontSize: '10px',
                                color: theme.colors.textSecondary,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flexWrap: 'wrap',
                              }}
                            >
                              {(selectedRepository.github as any).lastCommitAuthor && (
                                <span>{(selectedRepository.github as any).lastCommitAuthor}</span>
                              )}
                              {(selectedRepository.github as any).lastCommitAuthor && (selectedRepository.github as any).lastCommitHash && (
                                <span>•</span>
                              )}
                              {(selectedRepository.github as any).lastCommitHash && (
                                <span style={{ fontFamily: 'monospace', fontSize: '9px' }}>
                                  {(selectedRepository.github as any).lastCommitHash.substring(0, 8)}
                                </span>
                              )}
                              {((selectedRepository.github as any).lastCommitAuthor || (selectedRepository.github as any).lastCommitHash) && (
                                <span>•</span>
                              )}
                              <span>{getRelativeTime(selectedRepository.github?.lastCommit)}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })() : (
                    <div
                      style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        fontSize: '12px',
                      }}
                    >
                      No changes - working tree clean
                    </div>
                  )
                )}
              </div>

              {/* Right Column Container - Markdown and Notes */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  height: 'fit-content',
                }}
              >
              {/* Markdown Files List */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    marginBottom: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Markdown Documents</span>
                  <span style={{ fontSize: theme.fontSizes[0], fontWeight: 'normal' }}>
                    {isLoadingDocs ? 'Loading...' : `${markdownFiles.length} files`}
                  </span>
                </div>
                <div
                  style={{
                    maxHeight: '300px',
                    overflow: 'auto',
                  }}
                >
                  {isLoadingDocs ? (
                    <div
                      style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        fontSize: '12px',
                      }}
                    >
                      Loading documents...
                    </div>
                  ) : markdownFiles.length === 0 ? (
                    <div
                      style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        fontSize: '12px',
                      }}
                    >
                      No markdown documents found
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {markdownFiles.map((file) => {
                        const filename = file.path.split('/').pop() || file.path;
                        const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                        return (
                          <div
                            key={file.path}
                            style={{
                              padding: '10px',
                              backgroundColor: theme.colors.background,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.backgroundTertiary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                theme.colors.background;
                            }}
                            onClick={() => handleFileClick(file.path)}
                            title={file.path}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '2px',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: theme.fontSizes[1], // 14px
                                  color: theme.colors.text,
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                }}
                              >
                                {filename}
                              </div>
                              {file.lastModified && (
                                <div
                                  style={{
                                    fontSize: theme.fontSizes[0], // 12px
                                    color: theme.colors.textSecondary,
                                    whiteSpace: 'nowrap',
                                    marginLeft: '8px',
                                  }}
                                >
                                  {getRelativeTime(file.lastModified)}
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: theme.fontSizes[0], // 12px
                                color: theme.colors.textSecondary,
                                fontFamily: 'monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {directory === 'root' ? 'root' : `${directory}/`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Repository Notes Panel */}
              <RepositoryNotesPanel
                repositoryPath={selectedRepository.path}
                isLoading={false}
              />
            </div>
          </div>
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.textSecondary,
            fontSize: '14px',
          }}
        >
          {repositories.length === 0
            ? 'Add a repository to get started'
            : 'Select a repository to view details'}
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNoteModal && selectedRepository && (
        <AddNoteModal
          isOpen={showAddNoteModal}
          onClose={() => setShowAddNoteModal(false)}
          onNoteAdded={() => {
            // The RepositoryNotesPanel will automatically refresh when it detects the modal closed
            // We could also trigger a refresh here if needed
          }}
          repositoryPath={selectedRepository.path}
        />
      )}

      {/* Remove Repository Dialog */}
      {showRemoveDialog && selectedRepository && (
        <RemoveRepositoryDialog
          repository={selectedRepository}
          onConfirm={handleRemoveConfirm}
          onCancel={handleRemoveCancel}
        />
      )}
    </div>
  );
};
