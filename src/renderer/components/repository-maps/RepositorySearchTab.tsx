import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { FileTree } from '@principal-ai/repository-abstraction';
import { useTheme } from '@principal-ade/industry-theme';
import { Code, Check, AlertCircle, Search } from 'lucide-react';
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

interface RepositorySearchTabProps {
  // Multiple file trees support
  fileTrees: Map<string, FileTree>;
  activeFileTreeSource: FileTreeSource | null;

  // Content provider for search
  contentProvider?: ContentProvider;

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
  onFolderFiltersChange?: (
    filters: Array<{ id: string; path: string; mode: 'include' | 'exclude' }>,
  ) => void; // For folder filter highlights
}

export const RepositorySearchTab: React.FC<RepositorySearchTabProps> = ({
  fileTrees,
  activeFileTreeSource,
  contentProvider,
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
      {/* Search panel */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
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
      </div>
    </div>
  );
};

export const RepositorySearchTabPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 8px',
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '4px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <Search size={12} style={{ color: theme.colors.textSecondary }} />
        <span style={{ color: theme.colors.textSecondary }}>
          Search files...
        </span>
      </div>
      <div
        style={{
          fontSize: '11px',
          color: theme.colors.textSecondary,
        }}
      >
        3 results
      </div>
    </div>
  );
};
