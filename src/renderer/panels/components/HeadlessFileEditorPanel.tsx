import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
} from 'react';
import { ThemedMonacoWithProvider } from '@principal-ade/industry-themed-monaco-editor';
import type { editor, IRange } from 'monaco-editor';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { useFileWatch } from '../../hooks/useFileWatch';
import { clearFileDraft, getFileDraft, updateFileDraft } from '../fileDrafts';

export interface HeadlessFileEditorPanelHandle {
  revealRange: () => void;
  discardChanges: () => Promise<void>;
}

interface HeadlessFileEditorPanelProps {
  ref?: React.Ref<HeadlessFileEditorPanelHandle>;
  filePath: string;
  editable?: boolean;
  onSave?: (content: string) => Promise<void>;
  onModifiedChange?: (isModified: boolean) => void;
  onContentChange?: (content: string) => void;
  vimModeOverride?: boolean; // Override vim mode preference
  options?: editor.IStandaloneEditorConstructionOptions; // Monaco editor options
  contentLoader?: () => Promise<string | null>; // Custom content loader for remote files
  /** Select and center this span after loading or when it changes. Lines and columns are 1-based; the end is exclusive. */
  range?: IRange;
  rangeRevision?: number;
  /** Retain unsaved local edits across tab closes. */
  preserveUnsavedChanges?: boolean;
}

/**
 * Headless file editor with Monaco - provides just the editor with file watching,
 * no UI chrome. Parent component provides all UI (save buttons, headers, etc).
 */
export const HeadlessFileEditorPanel: React.FC<
  HeadlessFileEditorPanelProps
> = ({
  ref,
  filePath,
  editable = false,
  onSave,
  onModifiedChange,
  onContentChange,
  vimModeOverride,
  options = {},
  contentLoader,
  range,
  rangeRevision,
  preserveUnsavedChanges = false,
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [editorContent, setEditorContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [vimModeEnabled, setVimModeEnabled] = useState(false);
  const isSavingRef = useRef(false);
  const latestFilePathRef = useRef<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const latestContentRef = useRef('');
  const baselineContentRef = useRef('');
  const { startLineNumber, startColumn, endLineNumber, endColumn } =
    range ?? {};

  const revealRange = useCallback(
    (instance: editor.IStandaloneCodeEditor) => {
      if (
        startLineNumber === undefined ||
        startColumn === undefined ||
        endLineNumber === undefined ||
        endColumn === undefined
      ) {
        return;
      }
      const selection = instance.getModel()?.validateRange({
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn,
      });
      if (!selection) return;
      instance.setSelection(selection);
      instance.revealRangeInCenter(selection);
    },
    [startLineNumber, startColumn, endLineNumber, endColumn],
  );

  const handleEditorMount = useCallback(
    (instance: editor.IStandaloneCodeEditor) => {
      editorRef.current = instance;
      // Measure the flex body before centering; automatic layout may run later.
      instance.layout();
      revealRange(instance);
    },
    [revealRange],
  );

  useEffect(() => {
    if (isLoading || error) {
      editorRef.current = null;
    } else if (editorRef.current) {
      revealRange(editorRef.current);
    }
  }, [isLoading, error, revealRange, rangeRevision]);

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
  const loadFile = useCallback(
    async (discardDraft = false) => {
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
          if (discardDraft) clearFileDraft(filePath);
          const draft = preserveUnsavedChanges
            ? getFileDraft(filePath)
            : undefined;
          const initialContent = draft?.content ?? content;
          setFileContent(draft?.originalContent ?? content);
          baselineContentRef.current = draft?.originalContent ?? content;
          setEditorContent(initialContent);
          latestContentRef.current = initialContent;
          setSaveError(null);

          if (onContentChange) {
            onContentChange(initialContent);
          }
          if (onModifiedChange) {
            onModifiedChange(
              initialContent !== (draft?.originalContent ?? content),
            );
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
    },
    [
      filePath,
      contentLoader,
      onContentChange,
      onModifiedChange,
      preserveUnsavedChanges,
    ],
  );

  // Load file on mount and when path changes
  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const skipReloadWhen = useCallback(
    () =>
      isSavingRef.current ||
      latestContentRef.current !== baselineContentRef.current,
    [],
  );

  // File watching (only for local files, not remote with custom content loader)
  useFileWatch(filePath, loadFile, {
    enabled: !contentLoader, // Skip file watching if using custom content loader
    skipReloadWhen,
  });

  // Handle editor changes
  const handleEditorChange = useCallback(
    (value?: string) => {
      const newContent = value ?? '';
      setEditorContent(newContent);
      latestContentRef.current = newContent;
      if (preserveUnsavedChanges)
        updateFileDraft(filePath, fileContent, newContent);

      const modified = newContent !== fileContent;

      if (onContentChange) {
        onContentChange(newContent);
      }
      if (onModifiedChange) {
        onModifiedChange(modified);
      }
    },
    [
      fileContent,
      onContentChange,
      onModifiedChange,
      filePath,
      preserveUnsavedChanges,
    ],
  );

  // Handle save from editor (Cmd+S)
  const handleEditorSave = useCallback(
    async (value?: string) => {
      if (!onSave || isSavingRef.current || isLoading || error) return;

      const contentToSave = value ?? latestContentRef.current;
      isSavingRef.current = true;
      setSaveError(null);

      try {
        await onSave(contentToSave);
        // After successful save, update our tracked content
        setFileContent(contentToSave);
        baselineContentRef.current = contentToSave;
        // Typing may continue while the write is in flight.
        const latestContent = latestContentRef.current;
        setEditorContent(latestContent);
        if (preserveUnsavedChanges)
          updateFileDraft(filePath, contentToSave, latestContent);

        if (onModifiedChange) {
          onModifiedChange(latestContent !== contentToSave);
        }
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : 'Failed to save file',
        );
        throw err;
      } finally {
        isSavingRef.current = false;
      }
    },
    [
      onSave,
      onModifiedChange,
      filePath,
      preserveUnsavedChanges,
      isLoading,
      error,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      revealRange: () => {
        if (isLoading || error || !editorRef.current) return;
        revealRange(editorRef.current);
        editorRef.current.focus();
      },
      discardChanges: async () => {
        if (!isSavingRef.current) await loadFile(true);
      },
    }),
    [isLoading, error, revealRange, loadFile],
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {saveError && (
        <div role="alert" style={{ padding: 12, color: '#ff4444' }}>
          {saveError}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ThemedMonacoWithProvider
          initialValue={fileContent}
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
          onMount={handleEditorMount}
          onChange={editable ? handleEditorChange : undefined}
          onSave={editable ? handleEditorSave : undefined}
        />
      </div>
    </div>
  );
};
