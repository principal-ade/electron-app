import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { ThemedMonacoWithProvider } from '@principal-ade/industry-themed-monaco-editor';
import { FileSystemService } from '../../../../main-process-api/FileSystemService';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import { FileText, X } from 'lucide-react';

interface FilePreviewPanelProps {
  filePath: string | null;
  repositoryPath: string;
  onClose?: () => void;
}

export const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({
  filePath,
  repositoryPath,
  onClose,
}) => {
  const { theme } = useTheme();
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vimModeEnabled, setVimModeEnabled] = useState(false);
  const latestFilePathRef = useRef<string | null>(null);

  const getAbsolutePath = useCallback(
    (path: string) => (path.startsWith('/') ? path : `${repositoryPath}/${path}`),
    [repositoryPath],
  );

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
      return;
    }

    const absolutePath = getAbsolutePath(filePath);
    latestFilePathRef.current = absolutePath;

    setIsLoading(true);
    setError(null);

    try {
      const result = await FileSystemService.readFile(absolutePath);

      if (latestFilePathRef.current !== absolutePath) {
        return;
      }

      if (result && result.content !== undefined) {
        setFileContent(result.content);
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
  }, [filePath, getAbsolutePath]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  useEffect(() => {
    if (!filePath) {
      return;
    }

    const absolutePath = getAbsolutePath(filePath);
    let unsubscribe: (() => void) | undefined;

    const setupWatching = async () => {
      try {
        await FileSystemService.watchFile(absolutePath);
        unsubscribe = FileSystemService.onFileChange((event) => {
          if (event.path === absolutePath) {
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
  }, [filePath, getAbsolutePath, loadFile]);

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

  const fileName = filePath.split('/').pop() || filePath;
  const language = getLanguage(filePath);

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

      {/* Editor */}
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
            value={fileContent}
            language={language}
            vimMode={vimModeEnabled}
            options={{
              readOnly: true,
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
          />
        )}
      </div>
    </div>
  );
};