import React, { useState, useEffect, useRef } from 'react';

import { useTheme } from '@a24z/industry-theme';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { initVimMode } from 'monaco-vim';
import { Presentation, X, Copy, Check, GitBranch, Edit, Lock } from 'lucide-react';
import { DocumentView } from 'themed-markdown';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { MonacoEditorErrorBoundary } from './MonacoEditorErrorBoundary';

// Configure Monaco to use the locally bundled version instead of CDN
loader.config({ monaco });

// The MonacoWebpackPlugin generates the worker files
// Wrap in a check to avoid accessing window at module load time
if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorkerUrl: function (moduleId: string, label: string) {
      if (label === 'json') {
        return './json.worker.js';
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return './css.worker.js';
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return './html.worker.js';
      }
      if (label === 'typescript' || label === 'javascript') {
        return './ts.worker.js';
      }
      return './editor.worker.js';
    },
  };
}

interface FileViewerProps {
  filePath: string;
  displayPath?: string; // Optional path to display in the UI (defaults to filePath)
  onClose?: () => void;
  className?: string;
  enableVimMode?: boolean; // Allow vim mode to be toggled (default: false)
  editable?: boolean; // Allow editing (default: false)
  onSave?: (content: string) => Promise<void>; // Callback when saving
  onModifiedChange?: (isModified: boolean) => void; // Callback when modified state changes
  hideInternalSaveButton?: boolean; // Hide the built-in save button
  onContentChange?: (content: string) => void; // Callback when content changes
  initialContent?: string; // Optional: provide content directly instead of loading from file
  contentLoader?: () => Promise<string | null>; // Optional: custom content loader function
  // Git-related props from FilePanel
  hasGitChanges?: boolean;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | null;
  isCheckingGit?: boolean;
  onShowDiff?: () => void;
  allowEditToggle?: boolean; // Allow toggling between read-only and editable
  onEditableChange?: (editable: boolean) => void; // Callback when editable state changes
}

export const FileViewer: React.FC<FileViewerProps> = ({
  filePath,
  displayPath,
  onClose,
  className = '',
  enableVimMode = false,
  editable: initialEditable = false,
  onSave,
  onModifiedChange,
  hideInternalSaveButton = false,
  onContentChange,
  initialContent,
  contentLoader,
  hasGitChanges = false,
  gitStatus = null,
  isCheckingGit = false,
  onShowDiff,
  allowEditToggle = false,
  onEditableChange,
}) => {
  const { theme } = useTheme();
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<
    'code' | 'markdown' | 'image' | 'unknown'
  >('unknown');
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPresentationView, setShowPresentationView] = useState(false);
  const [editable, setEditable] = useState(initialEditable);
  const [vimModeEnabled, setVimModeEnabled] = useState(() => {
    // Only enable vim mode if the prop allows it
    if (!enableVimMode) return false;

    // Load vim mode preference from localStorage
    try {
      const saved = localStorage.getItem('fileViewer.vimModeEnabled');
      // Default to false if no saved preference
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [copiedPath, setCopiedPath] = useState(false);
  const editorRef = useRef<any>(null);
  const statusBarRef = useRef<HTMLDivElement>(null);

  // Use displayPath for UI display, fallback to filePath
  const pathForDisplay = displayPath || filePath;
  const fileNameForDisplay = pathForDisplay.split('/').pop() || pathForDisplay;

  // Notify parent when modified state changes
  useEffect(() => {
    if (onModifiedChange) {
      onModifiedChange(isModified);
    }
  }, [isModified, onModifiedChange]);

  // Save handler
  const handleSave = async () => {
    if (!editable || !onSave || !isModified || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(fileContent);
      setOriginalContent(fileContent);
      setIsModified(false);
    } catch (err) {
      console.error('Error saving file:', err);
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy path handler
  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(filePath);
      setCopiedPath(true);
      // Reset after 2 seconds
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (error) {
      console.error('Failed to copy path:', error);
    }
  };

  // Determine file type from extension
  useEffect(() => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    // Image extensions
    const imageExtensions = [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'svg',
      'ico',
      'bmp',
    ];
    if (imageExtensions.includes(ext)) {
      setFileType('image');
      return;
    }

    // Markdown extensions
    if (ext === 'md' || ext === 'mdx') {
      setFileType('markdown');
      return;
    }

    // Default to code
    setFileType('code');
  }, [filePath]);

  // Load file content
  useEffect(() => {
    const loadFile = async () => {
      // If initial content is provided, use it directly
      if (initialContent !== undefined) {
        setFileContent(initialContent);
        setOriginalContent(initialContent);
        setIsModified(false);
        if (onContentChange) {
          onContentChange(initialContent);
        }
        setIsLoading(false);
        return;
      }

      if (fileType === 'image') {
        setIsLoading(false);
        return; // Images are loaded directly in img tag
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('Loading file:', filePath);

        let content: string | null = null;

        // Use custom content loader if provided
        if (contentLoader) {
          content = await contentLoader();
        } else {
          // Default: use FileSystemService for local files
          const result = await FileSystemService.readFile(filePath);
          console.log('Read file result:', result);
          if (result && result.content !== undefined) {
            content = result.content;
          }
        }

        if (content !== null) {
          setFileContent(content);
          setOriginalContent(content);
          setIsModified(false);
          if (onContentChange) {
            onContentChange(content);
          }
        } else {
          throw new Error('Failed to read file - no content returned');
        }
      } catch (err) {
        console.error('Error loading file:', err);
        console.error('File path was:', filePath);
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [filePath, fileType, initialContent, contentLoader]);

  // Get language from file extension for syntax highlighting
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



  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Force theme application after mount to fix coloring issue
    setTimeout(() => {
      // Re-apply the theme after editor is fully mounted
      monaco.editor.setTheme('custom-theme');

      // Force a layout update to trigger rendering
      editor.layout();

      // Force tokenization of the entire model
      const model = editor.getModel();
      if (model) {
        // Get the tokenization support for the model's language
        const languageId = model.getLanguageId();

        // Force tokenization by simulating a scroll through the entire document
        const lineCount = model.getLineCount();
        const viewportHeight = 50; // Approximate visible lines

        // Tokenize in chunks to ensure all lines are processed
        for (let i = 1; i <= lineCount; i += viewportHeight) {
          const endLine = Math.min(i + viewportHeight - 1, lineCount);
          try {
            // This forces Monaco to tokenize these lines
            monaco.editor.tokenize(
              model.getValueInRange({
                startLineNumber: i,
                startColumn: 1,
                endLineNumber: endLine,
                endColumn: model.getLineMaxColumn(endLine),
              }),
              languageId,
            );
          } catch (e) {
            // Ignore tokenization errors
          }
        }

        // Force a visual update
        editor.render(true);

        // Trigger a view update
        editor.changeViewZones((changeAccessor: any) => {
          // This forces Monaco to recalculate and re-render
        });
      }
    }, 100);

    // Initialize vim mode if enabled
    if (vimModeEnabled) {
      initializeVimMode(editor);
    }

    // Add save keyboard shortcut (Cmd+S / Ctrl+S)
    if (editable) {
      editor.addCommand(2049, () => {
        // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS
        handleSave();
      });
    }

    // Add key handler to prevent escape from closing the file when vim mode is active
    editor.onKeyDown((e: any) => {
      if (e.keyCode === 9 && vimModeEnabled) {
        // 9 is Escape key
        e.stopPropagation();
        // Don't preventDefault here as vim mode needs to handle escape
      }
    });


    // Focus the editor
    editor.focus();
  };

  const initializeVimMode = (editor: any) => {
    // Dispose existing vim instance if any
    const existingVimInstance = (editor as any)._vimInstance;
    if (existingVimInstance) {
      try {
        existingVimInstance.dispose();
      } catch (error) {
        // Suppress harmless "Canceled" errors from Monaco Editor
        if (!(error as any).message?.includes('Canceled')) {
          console.warn('Error disposing vim mode:', error);
        }
      }
    }

    // Create status bar element if it doesn't exist
    if (statusBarRef.current) {
      try {
        const vimInstance = initVimMode(editor, statusBarRef.current);
        // Store vim instance on the editor
        (editor as any)._vimInstance = vimInstance;
      } catch (error) {
        console.warn('Error initializing vim mode:', error);
      }
    }
  };

  const toggleVimMode = () => {
    const newVimModeEnabled = !vimModeEnabled;
    setVimModeEnabled(newVimModeEnabled);

    // Save to localStorage
    try {
      localStorage.setItem(
        'fileViewer.vimModeEnabled',
        newVimModeEnabled.toString(),
      );
    } catch (error) {
      console.warn('Failed to save vim mode preference:', error);
    }
  };

  // Effect to handle vim mode changes
  useEffect(() => {
    if (editorRef.current) {
      if (vimModeEnabled) {
        initializeVimMode(editorRef.current);
      } else {
        // Disable vim mode by disposing the instance
        const vimInstance = (editorRef.current as any)._vimInstance;
        if (vimInstance) {
          try {
            vimInstance.dispose();
            delete (editorRef.current as any)._vimInstance;
          } catch (error) {
            // Suppress harmless "Canceled" errors from Monaco Editor
            if (!(error as any).message?.includes('Canceled')) {
              console.warn('Error disposing vim mode:', error);
            }
          }
        }
      }
    }
  }, [vimModeEnabled]);

  // Handle escape key to prevent closing file viewer when vim mode is active
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && vimModeEnabled) {
        event.stopPropagation();
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [vimModeEnabled]);

  // Add global handler for Monaco Editor's unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check for Monaco-specific cancellation errors
      const { reason } = event;
      if (reason) {
        // Suppress Monaco cancellation errors silently
        if (
          reason.message?.includes('Canceled') ||
          reason.toString().includes('Canceled')
        ) {
          event.preventDefault();
          return;
        }

        // Handle various forms of cancellation errors
        if (
          reason.message === 'Canceled' ||
          reason.name === 'Canceled' ||
          (reason.constructor && reason.constructor.name === 'Canceled') ||
          (typeof reason === 'string' && reason === 'Canceled') ||
          (reason.toString && reason.toString() === 'Canceled: Canceled')
        ) {
          event.preventDefault();
          return;
        }

        // Also suppress errors from Monaco's internal components
        if (
          reason.stack &&
          (reason.stack.includes('WordHighlighter') ||
            reason.stack.includes('Delayer.cancel') ||
            reason.stack.includes('Delayer.dispose') ||
            reason.stack.includes('DisposableStore') ||
            reason.stack.includes('monaco-editor') ||
            reason.stack.includes('renderer.dev.js') ||
            reason.stack.includes('main.dev.js'))
        ) {
          event.preventDefault();
          return;
        }
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection,
      );
    };
  }, []);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        // Dispose vim mode first if it exists
        const vimInstance = (editorRef.current as any)._vimInstance;
        if (vimInstance) {
          try {
            vimInstance.dispose();
          } catch (error) {
            // Suppress harmless "Canceled" errors from Monaco Editor
            if (!(error as any).message?.includes('Canceled')) {
              console.warn('Error disposing vim mode on unmount:', error);
            }
          }
        }

        // Clear the editor reference but don't dispose - let @monaco-editor/react handle that
        editorRef.current = null;
      }
    };
  }, []);

  // Determine Monaco theme based on app theme
  const getMonacoTheme = () => {
    try {
      // Check if the theme is dark or light based on background color
      const bgColor = theme.colors?.background;

      // Handle various color formats
      if (bgColor && typeof bgColor === 'string') {
        const colorStr = bgColor.toLowerCase();
        // Check for dark keywords
        if (colorStr.includes('dark') || colorStr.includes('black')) {
          return 'vs-dark';
        }
        // Check hex colors
        if (colorStr.startsWith('#')) {
          const hex = colorStr.slice(1);
          if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            // Calculate luminance
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance < 0.5 ? 'vs-dark' : 'vs';
          }
        }
      }
    } catch (e) {
      console.error('Error determining theme:', e);
    }

    // Default to dark theme
    return 'vs-dark';
  };


  const renderContent = () => {
    console.log(
      'FileViewer renderContent - isLoading:',
      isLoading,
      'error:',
      error,
      'fileType:',
      fileType,
    );


    if (showPresentationView && fileType === 'markdown') {
      // Split content into slides if it contains slide separators
      const slides = fileContent.includes('---')
        ? fileContent.split(/\n---\n/).map(slide => slide.trim())
        : [fileContent];

      return (
        <div style={{ position: 'relative', height: '100%' }}>
          <DocumentView
            content={slides}
            showSegmented={false}
            theme={theme}
            onCheckboxChange={(slideIndex, lineNumber, checked) => {
              // Handle checkbox changes if needed
              console.log('Checkbox changed:', slideIndex, lineNumber, checked);
            }}
            slideIdPrefix="fileviewer-md"
            showSectionHeaders={false}
            showSeparators={false}
          />
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
              style={{
                borderColor: `${theme.colors?.primary || '#3b82f6'} transparent`,
              }}
            />
            <p style={{ color: theme.colors?.textSecondary || '#999' }}>
              Loading file...
            </p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <div className="text-center">
            <p style={{ color: theme.colors?.error || '#ff4444' }}>
              Error: {error}
            </p>
          </div>
        </div>
      );
    }

    if (fileType === 'image') {
      return (
        <div
          className="flex items-center justify-center h-full p-4"
          style={{ backgroundColor: theme.colors?.background || '#1a1a1a' }}
        >
          <img
            src={`file://${filePath}`}
            alt={fileNameForDisplay}
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              setError('Failed to load image');
            }}
          />
        </div>
      );
    }

    // Use Monaco editor for code and markdown files
    const language = getLanguage(filePath);
    console.log(
      'Rendering Monaco editor - language:',
      language,
      'content length:',
      fileContent.length,
    );

    return (
      <MonacoEditorErrorBoundary>
        <Editor
          key={filePath} // Force complete remount when file changes
          height="100%"
          language={language}
          value={fileContent}
        theme="custom-theme"
        onChange={(value) => {
          if (editable && value !== undefined) {
            setFileContent(value);
            setIsModified(value !== originalContent);
            if (onContentChange) {
              onContentChange(value);
            }
          }
        }}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
                style={{
                  borderColor: `${theme.colors?.primary || '#3b82f6'} transparent`,
                }}
              />
              <p style={{ color: theme.colors?.textSecondary || '#999' }}>
                Loading editor...
              </p>
            </div>
          </div>
        }
        onMount={handleEditorDidMount}
        beforeMount={(monaco) => {
          // Configure Monaco for Electron environment
          try {
            // Helper to convert RGBA to hex (Monaco doesn't support alpha channel)
            const rgbaToHex = (color: string): string => {
              if (!color) return color;

              // Check if it's an rgba color
              const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
              if (rgbaMatch) {
                const r = parseInt(rgbaMatch[1], 10);
                const g = parseInt(rgbaMatch[2], 10);
                const b = parseInt(rgbaMatch[3], 10);
                return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
              }

              return color;
            };

            // Define and set theme BEFORE editor mounts to ensure proper syntax highlighting
            const isDarkTheme = getMonacoTheme() === 'vs-dark';

            // Define a more complete theme to ensure syntax highlighting works
            monaco.editor.defineTheme('custom-theme', {
              base: isDarkTheme ? 'vs-dark' : 'vs',
              inherit: true,
              rules: [
                // Add some default token colors to ensure they're visible
                { token: 'comment', foreground: '608B4E' },
                { token: 'keyword', foreground: 'C586C0' },
                { token: 'string', foreground: 'CE9178' },
                { token: 'number', foreground: 'B5CEA8' },
              ],
              colors: {
                'editor.background':
                  rgbaToHex(theme.colors?.background) ||
                  (isDarkTheme ? '#1a1a1a' : '#ffffff'),
                'editor.foreground':
                  rgbaToHex(theme.colors?.text) || (isDarkTheme ? '#d4d4d4' : '#000000'),
                'editor.lineHighlightBackground': isDarkTheme
                  ? '#2a2a2a'
                  : '#f0f0f0',
                'editorLineNumber.foreground': isDarkTheme
                  ? '#858585'
                  : '#999999',
              },
            });

            // Set the theme immediately
            monaco.editor.setTheme('custom-theme');

            // Configure TypeScript diagnostics - disable all errors
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
              {
                noSemanticValidation: true, // Disable semantic validation
                noSyntaxValidation: true, // Disable syntax validation
                noSuggestionDiagnostics: true, // Disable suggestions
              },
            );

            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
              {
                noSemanticValidation: true,
                noSyntaxValidation: true,
                noSuggestionDiagnostics: true,
              },
            );

            // Set compiler options to be more permissive
            const compilerOptions = {
              target: monaco.languages.typescript.ScriptTarget.Latest,
              allowNonTsExtensions: true,
              moduleResolution:
                monaco.languages.typescript.ModuleResolutionKind.NodeJs,
              module: monaco.languages.typescript.ModuleKind.ESNext,
              noEmit: true,
              esModuleInterop: true,
              jsx: monaco.languages.typescript.JsxEmit.React,
              allowJs: true,
              checkJs: false,
              skipLibCheck: true,
              skipDefaultLibCheck: true,
              strict: false,
              noImplicitAny: false,
            };

            monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
              compilerOptions,
            );
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions(
              compilerOptions,
            );

            // Add common type definitions
            const addExtraLib = (content: string, filePath: string) => {
              try {
                monaco.languages.typescript.typescriptDefaults.addExtraLib(
                  content,
                  filePath,
                );
                monaco.languages.typescript.javascriptDefaults.addExtraLib(
                  content,
                  filePath,
                );
              } catch (e) {
                console.warn(`Failed to add extra lib ${filePath}:`, e);
              }
            };

            // Add basic DOM types
            addExtraLib(
              `
              interface Window {
                electron: any;
              }
              declare var window: Window;
            `,
              'global.d.ts',
            );
          } catch (error) {
            console.warn('Error configuring Monaco TypeScript options:', error);
          }
        }}
        onValidate={(markers) => {
          // Log validation markers for debugging
          if (markers.length > 0) {
            console.log('TypeScript validation markers:', markers);
          }
        }}
        options={{
          readOnly: !editable,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          wordWrap: fileType === 'markdown' ? 'on' : 'off',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          folding: true,
          automaticLayout: true,
          contextmenu: true,
          selectOnLineNumbers: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          // Enable IntelliSense features
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          parameterHints: { enabled: true },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          wordBasedSuggestions: 'matchingDocuments',
          // Enable semantic highlighting
          'semanticHighlighting.enabled': true,
          // IntelliSense settings
          suggest: {
            snippetsPreventQuickSuggestions: false,
            showMethods: true,
            showFunctions: true,
            showConstructors: true,
            showFields: true,
            showVariables: true,
            showClasses: true,
            showStructs: true,
            showInterfaces: true,
            showModules: true,
            showProperties: true,
            showEvents: true,
            showOperators: true,
            showUnits: true,
            showValues: true,
            showConstants: true,
            showEnums: true,
            showEnumMembers: true,
            showKeywords: true,
            showWords: true,
            showColors: true,
            showFiles: true,
            showReferences: true,
            showFolders: true,
            showTypeParameters: true,
            showSnippets: true,
          },
        }}
        />
      </MonacoEditorErrorBoundary>
    );
  };

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      style={{ backgroundColor: theme.colors?.background || '#1a1a1a' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{
          borderColor: theme.colors?.border || '#333',
          backgroundColor:
            theme.colors?.backgroundSecondary ||
            theme.colors?.background ||
            '#1a1a1a',
        }}
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="text-sm font-medium truncate"
                style={{ color: theme.colors?.text || '#fff' }}
              >
                {fileNameForDisplay}
                {isModified && (
                  <span style={{ color: theme.colors?.warning || '#ff9800' }}>
                    {' '}
                    •
                  </span>
                )}
              </div>
              {/* Editable Status Indicator */}
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: editable
                    ? theme.colors?.success + '20' || '#10b98120'
                    : theme.colors?.textSecondary + '20' || '#99999920',
                  color: editable
                    ? theme.colors?.success || '#10b981'
                    : theme.colors?.textSecondary || '#999',
                }}
                title={editable ? 'File is editable' : 'File is read-only'}
              >
                {editable ? <Edit size={10} /> : <Lock size={10} />}
                <span>{editable ? 'Editable' : 'Read-only'}</span>
              </div>
            </div>
            <div
              className="text-xs opacity-60 truncate"
              style={{ color: theme.colors?.textSecondary || '#999' }}
            >
              {pathForDisplay}
            </div>
          </div>

          {/* Copy Path Button */}
          <button
            onClick={handleCopyPath}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            title="Copy file path to clipboard"
            style={{
              color: copiedPath
                ? theme.colors?.success || '#4ade80'
                : theme.colors?.textSecondary || '#999',
            }}
          >
            {copiedPath ? <Check size={16} /> : <Copy size={16} />}
          </button>

          {/* Edit Mode Toggle */}
          {allowEditToggle && onSave && (
            <button
              onClick={() => {
                const newEditable = !editable;
                setEditable(newEditable);
                if (onEditableChange) {
                  onEditableChange(newEditable);
                }
              }}
              className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                editable
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
              title={editable ? 'Switch to read-only mode' : 'Enable editing'}
            >
              {editable ? <Lock size={12} /> : <Edit size={12} />}
              {editable ? 'Lock' : 'Edit'}
            </button>
          )}

          {/* Save Button */}
          {editable && isModified && !hideInternalSaveButton && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1 text-xs rounded transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              title="Save (Cmd+S)"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}

          {/* Git Diff Button - Only show when file has git changes */}
          {hasGitChanges && onShowDiff && (
            <button
              onClick={onShowDiff}
              className="px-3 py-1 text-xs rounded transition-colors bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1"
              title="View git diff"
            >
              <GitBranch size={12} />
              View Diff
              {gitStatus && (
                <span className="ml-1 text-xs opacity-80">
                  ({gitStatus})
                </span>
              )}
            </button>
          )}


          {/* Vim Mode Toggle */}
          {fileType === 'code' && enableVimMode && (
            <button
              onClick={toggleVimMode}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                vimModeEnabled
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-600 text-gray-300'
              }`}
              title={vimModeEnabled ? 'Disable Vim Mode' : 'Enable Vim Mode'}
            >
              VIM
            </button>
          )}

          {/* Vim Status Bar */}
          {vimModeEnabled && (
            <div
              ref={statusBarRef}
              className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 font-mono"
              style={{ minWidth: '60px' }}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Presentation View Toggle for Markdown files */}
          {fileType === 'markdown' && (
            <button
              onClick={() => {
                setShowPresentationView(!showPresentationView);
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                showPresentationView
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-600 text-gray-300'
              }`}
              title={
                showPresentationView
                  ? 'Exit Presentation View'
                  : 'Show as Presentation'
              }
            >
              <Presentation size={14} />
            </button>
          )}

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-700 transition-colors"
              title="Close"
              style={{ color: theme.colors?.textSecondary || '#999' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">{renderContent()}</div>
    </div>
  );
};
