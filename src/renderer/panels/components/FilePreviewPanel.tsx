import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { ThemedMonacoWithProvider } from '@principal-ade/industry-themed-monaco-editor';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { FileText, X } from 'lucide-react';
import type { FileTreeSource } from '../../types/file-tree-source';

interface FilePreviewPanelProps {
  filePath: string | null;
  source?: FileTreeSource | null; // The file tree source (local or remote)
  contentProvider?: {
    readFileContent: (path: string) => Promise<string | null>;
  };
  onClose?: () => void;
  readOnly?: boolean; // Force read-only mode
}

export const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({
  filePath,
  source,
  contentProvider,
  onClose,
  readOnly: forceReadOnly = false,
}) => {
  const { theme } = useTheme();
  const [fileContent, setFileContent] = useState<string>('');
  const [editorContent, setEditorContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vimModeEnabled, setVimModeEnabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latestFilePathRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    isDirtyRef.current = false;
    setIsDirty(false);
    setIsSaving(false);
    isSavingRef.current = false;
    setSaveError(null);
  }, [filePath]);

  const getAbsolutePath = useCallback(
    (path: string) => {
      // For local sources, construct absolute path
      if (source?.type === 'local') {
        return path.startsWith('/') ? path : `${source.location}/${path}`;
      }
      // For remote sources or no source, return as-is
      return path;
    },
    [source],
  );

  // Determine if this is a local file that supports editing
  const isLocalFile = source?.type === 'local';
  const isEditable = isLocalFile && !forceReadOnly;

  // Get language from file extension
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      kt: 'kotlin',
      swift: 'swift',
      json: 'json',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      ini: 'ini',
      cfg: 'ini',
      conf: 'ini',
      md: 'markdown',
      mdx: 'markdown',
    };
    return languageMap[ext] || 'plaintext';
  };

  // Load vim mode preference
  useEffect(() => {
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        setVimModeEnabled(prefs.enableVimMode ?? false);
      })
      .catch(() => {
        setVimModeEnabled(false);
      });
  }, []);

  const loadFile = useCallback(async () => {
    if (!filePath) {
      latestFilePathRef.current = null;
      setFileContent('');
      setEditorContent('');
      setIsDirty(false);
      setIsSaving(false);
      setSaveError(null);
      return;
    }

    const absolutePath = getAbsolutePath(filePath);
    latestFilePathRef.current = absolutePath;

    setIsLoading(true);
    setError(null);

    try {
      let content: string | null = null;

      // For local sources, read from filesystem
      if (isLocalFile) {
        const result = await FileSystemService.readFile(absolutePath);
        content = result?.content ?? null;
      }
      // For remote sources, use content provider if available
      else if (contentProvider) {
        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        content = await contentProvider.readFileContent(relativePath);
      }

      if (latestFilePathRef.current !== absolutePath) {
        return;
      }

      if (content !== null) {
        setFileContent(content);
        setSaveError(null);
        if (!isDirtyRef.current) {
          setEditorContent(content);
          setIsDirty(false);
        }
      } else {
        throw new Error('Failed to read file');
      }
    } catch (err) {
      console.error('Error loading file:', err);
      if (latestFilePathRef.current === absolutePath) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
        setFileContent('');
      }
    } finally {
      if (latestFilePathRef.current === absolutePath) {
        setIsLoading(false);
      }
    }
  }, [filePath, getAbsolutePath, isLocalFile, contentProvider]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const handleEditorChange = useCallback(
    (value?: string) => {
      const nextValue = value ?? '';
      setEditorContent(nextValue);
      setIsDirty(nextValue !== fileContent);
      if (saveError) {
        setSaveError(null);
      }
    },
    [fileContent, saveError],
  );

  const handleEditorSave = useCallback(
    async (value?: string) => {
      if (!filePath) {
        return;
      }

      const absolutePath = getAbsolutePath(filePath);
      const contentToSave = value ?? editorContent;

      if (!isDirty && contentToSave === fileContent) {
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      setSaveError(null);

      try {
        await FileSystemService.writeFile(absolutePath, contentToSave);

        if (latestFilePathRef.current === absolutePath) {
          setFileContent(contentToSave);
          setEditorContent(contentToSave);
          setIsDirty(false);
        }
      } catch (err) {
        if (latestFilePathRef.current === absolutePath) {
          setSaveError(err instanceof Error ? err.message : 'Failed to save file');
        }
      } finally {
        if (latestFilePathRef.current === absolutePath) {
          setIsSaving(false);
        }
        isSavingRef.current = false;
      }
    },
    [editorContent, fileContent, filePath, getAbsolutePath, isDirty],
  );

  // File watching - only for local files
  useEffect(() => {
    if (!filePath || !isLocalFile) {
      return;
    }

    const absolutePath = getAbsolutePath(filePath);
    let unsubscribe: (() => void) | undefined;

    const setupWatching = async () => {
      try {
        await FileSystemService.watchFile(absolutePath);
        unsubscribe = FileSystemService.onFileChange((event) => {
          if (event.path === absolutePath) {
            if (isSavingRef.current) {
              return;
            }
            loadFile();
          }
        });
      } catch (watchError) {
        console.error('Error setting up file watching:', watchError);
      }
    };

    setupWatching();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      FileSystemService.stopWatchingFile(absolutePath).catch((stopError) => {
        console.error('Error stopping file watching:', stopError);
      });
    };
  }, [filePath, isLocalFile, getAbsolutePath, loadFile]);

  const fileName = filePath?.split('/').pop() || filePath || '';
  const language = filePath ? getLanguage(filePath) : 'plaintext';

  if (!filePath) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: theme.colors.textSecondary,
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <div style={{
          fontSize: theme.fontSizes[3],
          fontWeight: 600,
          marginBottom: '12px',
          color: theme.colors.text,
        }}>
          File Preview
        </div>
        <div style={{ fontSize: theme.fontSizes[1] }}>
          Select a file from the git changes or repository map to preview
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <FileText size={16} style={{ color: theme.colors.primary, flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: theme.fontSizes[2],
                fontWeight: 600,
                color: theme.colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {fileName}
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={filePath}
            >
              {filePath}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {isEditable && (
            <>
              {saveError ? (
                <span style={{ color: theme.colors.error, fontSize: theme.fontSizes[0] }}>
                  Save failed: {saveError}
                </span>
              ) : isSaving ? (
                <span style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[0] }}>
                  Saving...
                </span>
              ) : isDirty ? (
                <span style={{ color: theme.colors.primary, fontSize: theme.fontSizes[0] }}>
                  Unsaved changes
                </span>
              ) : (
                <span style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[0] }}>
                  Saved
                </span>
              )}
              <button
                onClick={() => void handleEditorSave()}
                disabled={!isDirty || isSaving}
                style={{
                  backgroundColor: theme.colors.primary,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: theme.fontSizes[0],
                  cursor: !isDirty || isSaving ? 'not-allowed' : 'pointer',
                  opacity: !isDirty || isSaving ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                Save
              </button>
            </>
          )}
          {onClose && filePath && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {isLoading ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            Loading file...
          </div>
        ) : error ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.error,
              padding: '20px',
              textAlign: 'center',
            }}
          >
            Error: {error}
          </div>
        ) : (
          <ThemedMonacoWithProvider
            value={editorContent}
            language={language}
            vimMode={isEditable ? vimModeEnabled : false}
            options={{
              readOnly: !isEditable,
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              fontSize: 13,
              automaticLayout: true,
              folding: true,
              renderWhitespace: 'selection',
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                useShadows: false,
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
            }}
            height="100%"
            onChange={isEditable ? handleEditorChange : undefined}
            onSave={isEditable ? handleEditorSave : undefined}
          />
        )}
      </div>
    </div>
  );
};