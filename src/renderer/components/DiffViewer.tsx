import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from 'themed-markdown';
import { DiffEditor, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { GitService } from '../main-process-api/GitService';

// Configure Monaco to use the locally bundled version
loader.config({ monaco });

interface DiffViewerProps {
  filePath: string;
  repositoryPath: string;
  gitStatus?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath,
  repositoryPath,
  gitStatus,
}) => {
  const { theme } = useTheme();
  const [originalContent, setOriginalContent] = useState<string>('');
  const [modifiedContent, setModifiedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const diffEditorRef = useRef<any>(null);

  useEffect(() => {
    const loadDiff = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load current file content (construct absolute path)
        const absolutePath = filePath.startsWith('/')
          ? filePath
          : `${repositoryPath}/${filePath}`;

        const result = await FileSystemService.readFile(absolutePath);

        // FileSystemService.readFile returns an object with content property
        const currentContent = result?.content || '';
        setModifiedContent(currentContent);

        let originalContent = '';

        if (gitStatus === 'added' || gitStatus === 'untracked') {
          // For new files, show empty original
          originalContent = '';
        } else if (gitStatus === 'deleted') {
          // For deleted files, get content from HEAD
          const result = await GitService.execCommand(repositoryPath, [
            'show',
            `HEAD:${filePath}`,
          ]);
          originalContent = result?.stdout || '';
          setModifiedContent(''); // File is deleted - override current content
        } else {
          // For modified files, get content from HEAD
          try {
            const result = await GitService.execCommand(repositoryPath, [
              'show',
              `HEAD:${filePath}`,
            ]);
            originalContent = result?.stdout || '';
          } catch (err) {
            // File might not exist in HEAD
            console.warn(`Failed to get HEAD version for ${filePath}:`, err);
            originalContent = '';
          }
        }

        setOriginalContent(originalContent);
      } catch (error) {
        console.error(`Error loading diff for ${filePath}:`, error);
        setError(
          error instanceof Error
            ? `Failed to load diff for ${filePath}: ${error.message}`
            : `Failed to load diff for ${filePath}`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadDiff();
  }, [filePath, repositoryPath, gitStatus]);

  const handleEditorDidMount = (editor: any) => {
    diffEditorRef.current = editor;

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

    // Determine Monaco theme based on app theme (same logic as FileViewer)
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
      // Default to dark theme if unable to determine
      return 'vs-dark';
    };

    const isDarkTheme = getMonacoTheme() === 'vs-dark';

    // Configure theme
    monaco.editor.defineTheme('principleTheme', {
      base: isDarkTheme ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': rgbaToHex(theme.colors.background),
        'editor.foreground': rgbaToHex(theme.colors.text),
        'editor.lineHighlightBackground': rgbaToHex(theme.colors.backgroundSecondary),
        'editorLineNumber.foreground': rgbaToHex(theme.colors.textSecondary),
        'editorGutter.background': rgbaToHex(theme.colors.backgroundSecondary),
        'diffEditor.insertedTextBackground': '#10b98133',
        'diffEditor.removedTextBackground': '#ef444433',
      },
    });

    monaco.editor.setTheme('principleTheme');
  };

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        Loading diff...
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
          color: theme.colors.error,
        }}
      >
        Error: {error}
      </div>
    );
  }

  // Determine file language
  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      md: 'markdown',
      html: 'html',
      css: 'css',
      scss: 'scss',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      go: 'go',
      rs: 'rust',
      swift: 'swift',
      kt: 'kotlin',
      rb: 'ruby',
      php: 'php',
      sh: 'shell',
      bash: 'shell',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      xml: 'xml',
      sql: 'sql',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  return (
    <DiffEditor
      height="100%"
      language={getLanguage(filePath)}
      original={originalContent}
      modified={modifiedContent}
      onMount={handleEditorDidMount}
      options={{
        readOnly: true,
        renderSideBySide: true,
        enableSplitViewResizing: true,
        originalEditable: false,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        minimap: {
          enabled: true,
        },
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        renderWhitespace: 'boundary',
        diffWordWrap: 'off',
      }}
      theme="principleTheme"
    />
  );
};
