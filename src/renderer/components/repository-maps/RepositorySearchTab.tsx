import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { FileTree } from '@principal-ai/repository-abstraction';
import { useTheme } from 'themed-markdown';
import { Code, Check, AlertCircle, GitBranch, Search } from 'lucide-react';
import { LocalSearchPanel } from '../shared/LocalSearchPanel';
import { FileTreeSource } from '../../types/file-tree-source';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { EditorId } from '../../../shared/types/editor.types';
import {
  EDITOR_LABELS,
  DEFAULT_EDITOR,
} from '../../../shared/types/editor.types';
import { ContentProvider } from '../../services/ContentProviders';
import { localSearchService } from '../../services/LocalSearchService';
import type { GitStatusWithFiles } from '../../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

interface RepositorySearchTabProps {
  // Multiple file trees support
  fileTrees: Map<string, FileTree>;
  activeFileTreeSource: FileTreeSource | null;

  // Content provider for search
  contentProvider?: ContentProvider;

  // Git modified files
  gitModifiedFiles?: string[];
  gitStatusWithFiles?: GitStatusWithFiles | null;

  // UI options
  showEditorSelector?: boolean; // Hide in explore view

  // Callbacks
  onFileSelect?: (
    filePath: string,
    lineNumbers?: number[],
    searchQuery?: string,
  ) => void;
  selectedFile?: string | null;
  onSearchResultsChange?: (results: string[]) => void; // For highlight layers
  onSearchResultHover?: (filePath: string | null) => void; // For hover highlight
  onFolderFiltersChange?: (filters: Array<{ id: string; path: string; mode: 'include' | 'exclude' }>) => void; // For folder filter highlights
}

export const RepositorySearchTab: React.FC<RepositorySearchTabProps> = ({
  fileTrees,
  activeFileTreeSource,
  contentProvider,
  gitModifiedFiles,
  gitStatusWithFiles,
  showEditorSelector = true,
  onFileSelect,
  selectedFile,
  onSearchResultsChange,
  onSearchResultHover,
  onFolderFiltersChange,
}) => {

  const { theme } = useTheme();
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [defaultEditor, setDefaultEditor] = useState<EditorId>(DEFAULT_EDITOR);
  const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);
  const editorMenuRef = useRef<HTMLDivElement | null>(null);
  const editorButtonRef = useRef<HTMLButtonElement | null>(null);

  // View mode: 'search' or 'modified'
  // Default to 'modified' if we have git changes, otherwise 'search'
  const [viewMode, setViewMode] = useState<'search' | 'modified'>(
    gitModifiedFiles && gitModifiedFiles.length > 0 ? 'modified' : 'search'
  );

  // Update view mode when git status changes
  useEffect(() => {
    // Only auto-switch to search if modified files are cleared while in modified view
    if ((!gitModifiedFiles || gitModifiedFiles.length === 0) && viewMode === 'modified') {
      setViewMode('search');
    }
  }, [gitModifiedFiles, viewMode]);

  // Update search results when showing modified files
  useEffect(() => {
    if (viewMode === 'modified' && gitModifiedFiles) {
      onSearchResultsChange?.(gitModifiedFiles);
    } else if (viewMode === 'search') {
      // Clear modified files highlight when switching to search mode
      // The LocalSearchPanel will handle its own search results
    }
  }, [viewMode, gitModifiedFiles, onSearchResultsChange]);

  // Set content provider when it changes
  useEffect(() => {
    if (contentProvider) {
      localSearchService.setContentProvider(contentProvider);
    }
  }, [contentProvider]);

  // Get the first available tree ID as default
  useEffect(() => {
    if (!selectedTreeId && fileTrees.size > 0) {
      const firstTreeId = Array.from(fileTrees.keys())[0];
      setSelectedTreeId(firstTreeId);
    }
  }, [fileTrees, selectedTreeId]);

  // Load saved default editor
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();
        const editor = (prefs.defaultEditor ?? DEFAULT_EDITOR) as EditorId;
        if (isMounted) setDefaultEditor(editor);
      } catch {
        if (isMounted) setDefaultEditor(DEFAULT_EDITOR);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close editor menu on outside click or escape
  useEffect(() => {
    if (!isEditorMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedOutside =
        editorMenuRef.current &&
        !editorMenuRef.current.contains(target) &&
        editorButtonRef.current &&
        !editorButtonRef.current.contains(target);
      if (clickedOutside) setIsEditorMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditorMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isEditorMenuOpen]);

  // Get the selected file tree
  const selectedFileTree = useMemo(() => {
    if (!selectedTreeId) return null;
    return fileTrees.get(selectedTreeId);
  }, [fileTrees, selectedTreeId]);

  // Convert FileTree to FileSystemTree format for LocalSearchPanel
  const fileSystemTree = useMemo(() => {
    if (!selectedFileTree) return null;


    // Ensure allFiles and allDirectories are arrays
    const allFiles = Array.isArray(selectedFileTree.allFiles)
      ? selectedFileTree.allFiles
      : [];
    const allDirectories = Array.isArray(selectedFileTree.allDirectories)
      ? selectedFileTree.allDirectories
      : [];

    // LocalSearchPanel expects a FileSystemTree format
    return {
      sha: selectedFileTree.sha || '',
      root: selectedFileTree.root || {
        name: 'root',
        path: '/',
        relativePath: '/',
        type: 'directory' as const,
      },
      allFiles: allFiles,
      allDirectories: allDirectories,
      stats: selectedFileTree.stats || {
        totalFiles: allFiles.length,
        totalDirectories: allDirectories.length,
        totalSize: 0,
        maxDepth: 0,
        buildingTypeDistribution: {},
      },
      metadata: selectedFileTree.metadata || {},
      // Legacy properties that LocalSearchPanel might use
      files: allFiles,
      directories: {},
    };
  }, [selectedFileTree, activeFileTreeSource]);

  const handleFileSelect = useCallback(
    (filePath: string, lineNumbers?: number[], searchQuery?: string) => {
      onFileSelect?.(filePath, lineNumbers, searchQuery);
    },
    [onFileSelect],
  );

  const handleOpenInEditor = useCallback(
    async (filePath: string) => {
      try {
        // Use the shell API to open the file in the selected editor
        const result = await window.mainProcess?.shell?.openInEditor({
          editor: defaultEditor,
          dir: filePath, // Note: current API opens directories, we'll need to update for files
        });

        if (!result?.success) {
          console.error('Failed to open file in editor:', result?.error);
        }
      } catch (error) {
        console.error('Error opening file in editor:', error);
      }
    },
    [defaultEditor],
  );

  const handleSearchResultsChange = useCallback(
    (results: any[]) => {
      // Convert LocalSearchResult[] to relative paths
      // Use relativePath property which should be relative to the repository root
      const paths = results.map((r) => {
        // Use relativePath if available, otherwise try to extract from path
        if (r.relativePath) {
          return r.relativePath;
        }
        // Fallback: if path contains the base directory, extract relative part
        const path = r.path;
        // Remove leading slash if present
        return path.startsWith('/') ? path.slice(1) : path;
      });
      onSearchResultsChange?.(paths);
    },
    [onSearchResultsChange],
  );

  if (!fileSystemTree || !activeFileTreeSource) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        No file tree available for search
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* View Mode Toggle */}
      {gitModifiedFiles && gitModifiedFiles.length > 0 && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <button
            onClick={() => setViewMode('modified')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor:
                viewMode === 'modified'
                  ? `${theme.colors.primary}22`
                  : theme.colors.backgroundTertiary,
              border:
                viewMode === 'modified'
                  ? `1px solid ${theme.colors.primary}`
                  : `1px solid ${theme.colors.border}`,
              color:
                viewMode === 'modified'
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
              fontSize: '12px',
              fontWeight: viewMode === 'modified' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <GitBranch size={12} />
            Modified Files ({gitModifiedFiles.length})
          </button>
          <button
            onClick={() => setViewMode('search')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor:
                viewMode === 'search'
                  ? `${theme.colors.primary}22`
                  : theme.colors.backgroundTertiary,
              border:
                viewMode === 'search'
                  ? `1px solid ${theme.colors.primary}`
                  : `1px solid ${theme.colors.border}`,
              color:
                viewMode === 'search'
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
              fontSize: '12px',
              fontWeight: viewMode === 'search' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Search size={12} />
            Search
          </button>
        </div>
      )}

      {/* Content based on view mode */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'modified' && gitModifiedFiles ? (
          // Modified files list
          <div
            style={{
              height: '100%',
              overflow: 'auto',
              padding: '12px',
            }}
          >
            {gitModifiedFiles.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: theme.colors.textSecondary,
                  fontSize: '14px',
                }}
              >
                No modified files
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {gitModifiedFiles.map((filePath) => {
                  const fileName = filePath.split('/').pop() || filePath;
                  const isSelected = selectedFile === filePath;

                  // Determine file status
                  let statusColor = theme.colors.text;
                  let statusLabel = 'M';
                  if (gitStatusWithFiles?.createdFiles.includes(filePath)) {
                    statusColor = '#10b981';
                    statusLabel = 'A';
                  } else if (gitStatusWithFiles?.deletedFiles.includes(filePath)) {
                    statusColor = '#ef4444';
                    statusLabel = 'D';
                  } else if (gitStatusWithFiles?.modifiedFiles.includes(filePath)) {
                    statusColor = '#f59e0b';
                    statusLabel = 'M';
                  }

                  return (
                    <div
                      key={filePath}
                      onClick={() => handleFileSelect(filePath)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: isSelected
                          ? `${theme.colors.primary}15`
                          : 'transparent',
                        border: isSelected
                          ? `1px solid ${theme.colors.primary}30`
                          : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        ':hover': {
                          backgroundColor: theme.colors.backgroundTertiary,
                        },
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundTertiary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected
                          ? `${theme.colors.primary}15`
                          : 'transparent';
                      }}
                    >
                      <span
                        style={{
                          color: statusColor,
                          fontWeight: 600,
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          width: '14px',
                          textAlign: 'center',
                        }}
                      >
                        {statusLabel}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            color: theme.colors.text,
                            fontWeight: isSelected ? 500 : 400,
                            marginBottom: '2px',
                          }}
                        >
                          {fileName}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {filePath}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Search panel
          <LocalSearchPanel
            fileSystemTree={fileSystemTree}
            baseDirectory={activeFileTreeSource.location}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onOpenInEditor={showEditorSelector ? handleOpenInEditor : undefined}
            selectedEditor={EDITOR_LABELS[defaultEditor]}
            onDirectoryFiltersChange={onFolderFiltersChange}
            headerExtra={
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Content search availability indicator */}
                {contentProvider && !contentProvider.canProvideContent() && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    backgroundColor: `${theme.colors.warning || '#f59e0b'}15`,
                    border: `1px solid ${theme.colors.warning || '#f59e0b'}40`,
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: theme.colors.warning || '#f59e0b',
                  }}
                >
                  <AlertCircle size={12} />
                  <span>
                    File name search only (content search not available)
                  </span>
                </div>
              )}

              {/* Tree selector when multiple trees available */}
              {fileTrees.size > 1 && (
                <div
                  style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      fontWeight: 500,
                    }}
                  >
                    Search in:
                  </span>
                  {Array.from(fileTrees.entries()).map(([id, tree]) => {
                    const isSelected = id === selectedTreeId;
                    const label = id.includes('HEAD')
                      ? 'HEAD Commit'
                      : 'Working Directory';

                    return (
                      <button
                        key={id}
                        onClick={() => setSelectedTreeId(id)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          backgroundColor: isSelected
                            ? `${theme.colors.primary}22`
                            : theme.colors.backgroundTertiary,
                          border: isSelected
                            ? `1px solid ${theme.colors.primary}`
                            : `1px solid ${theme.colors.border}`,
                          color: isSelected
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* IDE Selector - only show if enabled */}
              {showEditorSelector && (
                <div style={{ position: 'relative' }}>
                  <button
                    ref={editorButtonRef}
                    onClick={() => setIsEditorMenuOpen((v) => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      backgroundColor: theme.colors.backgroundTertiary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      color: theme.colors.text,
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                    title="Default editor for opening local files"
                  >
                    <Code size={12} />
                    {EDITOR_LABELS[defaultEditor]}
                  </button>

                  {isEditorMenuOpen && (
                    <div
                      ref={editorMenuRef}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 8px)',
                        minWidth: '180px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '8px',
                        boxShadow:
                          theme.shadows?.[0] || '0 2px 8px rgba(0,0,0,0.1)',
                        padding: '6px',
                        zIndex: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: '4px 6px',
                          fontSize: '11px',
                          color: theme.colors.textSecondary,
                          borderBottom: `1px solid ${theme.colors.border}`,
                          marginBottom: '4px',
                        }}
                      >
                        Open files in
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {Object.entries(EDITOR_LABELS).map(([id, label]) => {
                          const isActive = id === defaultEditor;
                          return (
                            <button
                              key={id}
                              onClick={async () => {
                                const value = id as EditorId;
                                setDefaultEditor(value);
                                await UserPreferencesService.updatePreferences({
                                  defaultEditor: value,
                                });
                                setIsEditorMenuOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                                padding: '6px 8px',
                                background: isActive
                                  ? `${theme.colors.primary}15`
                                  : 'transparent',
                                color: theme.colors.text,
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '12px',
                              }}
                            >
                              <span>{label}</span>
                              {isActive && (
                                <Check size={12} color={theme.colors.primary} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          }
            onSearchResultsChange={handleSearchResultsChange}
            onSearchResultHover={onSearchResultHover}
          />
        )}
      </div>
    </div>
  );
};
