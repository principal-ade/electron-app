import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThemedMonacoWithProvider } from '@principal-ade/industry-themed-monaco-editor';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';

interface HeadlessFileEditorPanelProps {
  filePath: string;
  editable?: boolean;
  onSave?: (content: string) => Promise<void>;
  onModifiedChange?: (isModified: boolean) => void;
  onContentChange?: (content: string) => void;
  vimModeOverride?: boolean; // Override vim mode preference
  options?: any; // Monaco editor options
  contentLoader?: () => Promise<string | null>; // Custom content loader for remote files
}

/**
 * Headless file editor with Monaco - provides just the editor with file watching,
 * no UI chrome. Parent component provides all UI (save buttons, headers, etc).
 */
export const HeadlessFileEditorPanel: React.FC<
  HeadlessFileEditorPanelProps
> = ({
  filePath,
  editable = false,
  onSave,
  onModifiedChange,
  onContentChange,
  vimModeOverride,
  options = {},
  contentLoader,
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [editorContent, setEditorContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vimModeEnabled, setVimModeEnabled] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const isSavingRef = useRef(false);
  const latestFilePathRef = useRef<string | null>(null);

  // Load vim mode preference (unless overridden)
  useEffect(() => {
    if (vimModeOverride !== undefined) {
      setVimModeEnabled(vimModeOverride);
      return;
    }

    UserPreferencesService.getPreferences()
      .then((prefs) => {
        setVimModeEnabled(prefs.enableVimMode ?? false);
      })
      .catch(() => {
        setVimModeEnabled(false);
      });
  }, [vimModeOverride]);

  // Determine language from file extension
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

  // Load file content
  const loadFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    latestFilePathRef.current = filePath;

    try {
      let content: string | null = null;

      // Use custom content loader if provided
      if (contentLoader) {
        content = await contentLoader();
      } else {
        // Default: use FileSystemService for local files
        const result = await FileSystemService.readFile(filePath);
        content = result?.content ?? null;
      }

      if (latestFilePathRef.current !== filePath) {
        return;
      }

      if (content !== null) {
        setFileContent(content);
        setEditorContent(content);
        setIsModified(false);

        if (onContentChange) {
          onContentChange(content);
        }
        if (onModifiedChange) {
          onModifiedChange(false);
        }
      } else {
        throw new Error('Failed to read file - no content returned');
      }
    } catch (err) {
      console.error('Error loading file:', err);
      if (latestFilePathRef.current === filePath) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      }
    } finally {
      if (latestFilePathRef.current === filePath) {
        setIsLoading(false);
      }
    }
  }, [filePath, contentLoader, onContentChange, onModifiedChange]);

  // Load file on mount and when path changes
  useEffect(() => {
    loadFile();
  }, [loadFile]);

  // File watching (only for local files)
  useEffect(() => {
    // Skip file watching if using custom content loader
    if (contentLoader) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupWatching = async () => {
      try {
        await FileSystemService.watchFile(filePath);
        unsubscribe = FileSystemService.onFileChange((event) => {
          if (event.path === filePath) {
            if (isSavingRef.current) {
              return; // Don't reload while saving
            }
            console.log('File changed externally, reloading:', filePath);
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
      FileSystemService.stopWatchingFile(filePath).catch(console.error);
    };
  }, [filePath, loadFile, contentLoader]);

  // Handle editor changes
  const handleEditorChange = useCallback(
    (value?: string) => {
      const newContent = value ?? '';
      setEditorContent(newContent);

      const modified = newContent !== fileContent;
      setIsModified(modified);

      if (onContentChange) {
        onContentChange(newContent);
      }
      if (onModifiedChange) {
        onModifiedChange(modified);
      }
    },
    [fileContent, onContentChange, onModifiedChange],
  );

  // Handle save from editor (Cmd+S)
  const handleEditorSave = useCallback(
    async (value?: string) => {
      if (!onSave) return;

      const contentToSave = value ?? editorContent;
      isSavingRef.current = true;

      try {
        await onSave(contentToSave);
        // After successful save, update our tracked content
        setFileContent(contentToSave);
        setEditorContent(contentToSave);
        setIsModified(false);

        if (onModifiedChange) {
          onModifiedChange(false);
        }
      } catch (err) {
        console.error('Error saving file:', err);
        throw err;
      } finally {
        isSavingRef.current = false;
      }
    },
    [editorContent, onSave, onModifiedChange],
  );

  const language = getLanguage(filePath);

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading file...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ff4444',
        }}
      >
        Error: {error}
      </div>
    );
  }

  return (
    <ThemedMonacoWithProvider
      value={editorContent}
      language={language}
      vimMode={editable ? vimModeEnabled : false}
      options={{
        readOnly: !editable,
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
        ...options, // Allow parent to override
      }}
      height="100%"
      onChange={editable ? handleEditorChange : undefined}
      onSave={editable ? handleEditorSave : undefined}
    />
  );
};
