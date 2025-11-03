import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  BlockTypeSelect,
  DiffSourceToggleWrapper,
} from '@mdxeditor/editor';
import { ThemedMDXEditorWithProvider } from '@principal-ade/industry-themed-mdx-editor';
import { useTheme } from '@a24z/industry-theme';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { FileText } from 'lucide-react';

interface MDXEditorPanelProps {
  filePath?: string | null;
  initialContent?: string;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  variant?: 'panel' | 'tab';
}

export const MDXEditorPanel: React.FC<MDXEditorPanelProps> = ({
  filePath,
  initialContent = '# Welcome to MDXEditor\n\nStart editing your markdown content here...',
  onSave,
  readOnly = false,
  variant = 'panel',
}) => {
  const { theme } = useTheme();
  const { repositoryPath } = useRepositoryPanelContext();
  const [markdown, setMarkdown] = useState(initialContent);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Memoize plugins array for performance
  // IMPORTANT: This must be called before any conditional returns (Rules of Hooks)
  const plugins = useMemo(
    () => [
      // Core plugins
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),

      // Link and image plugins
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin({
        imageUploadHandler: async (file) => {
          // TODO: Implement image upload
          console.log('Uploading image:', file.name);
          return '/placeholder-image.png';
        },
      }),

      // Table plugin
      tablePlugin(),

      // Code block plugins
      codeBlockPlugin({ defaultCodeBlockLanguage: 'javascript' }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          javascript: 'JavaScript',
          typescript: 'TypeScript',
          tsx: 'TypeScript (JSX)',
          jsx: 'JavaScript (JSX)',
          python: 'Python',
          java: 'Java',
          go: 'Go',
          rust: 'Rust',
          cpp: 'C++',
          c: 'C',
          css: 'CSS',
          html: 'HTML',
          json: 'JSON',
          yaml: 'YAML',
          markdown: 'Markdown',
          bash: 'Bash',
          shell: 'Shell',
          sql: 'SQL',
        },
        // Note: ThemedMDXEditorWithProvider handles codeMirrorExtensions internally
      }),

      // Frontmatter plugin (for markdown files with metadata)
      frontmatterPlugin(),

      // Source diff plugin (toggle between markdown and visual)
      // Start in source mode if there are parsing errors, otherwise rich-text
      diffSourcePlugin({
        viewMode: parseError ? 'source' : 'rich-text',
      }),

      // Toolbar plugin with common controls
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <DiffSourceToggleWrapper>
              <UndoRedo />
              <BlockTypeSelect />
              <BoldItalicUnderlineToggles />
              <CodeToggle />
              <CreateLink />
              <InsertImage />
              <InsertTable />
              <InsertThematicBreak />
              <ListsToggle />
            </DiffSourceToggleWrapper>
          </>
        ),
      }),
    ],
    [parseError],
  );

  // Handle client-side only rendering (MDXEditor doesn't support SSR)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load file content if filePath is provided
  useEffect(() => {
    const loadFileContent = async () => {
      if (!filePath || !repositoryPath) {
        setMarkdown(
          initialContent ||
            '# Welcome to MDXEditor\n\nStart editing your markdown content here...',
        );
        setCurrentFilePath(null);
        return;
      }

      if (filePath === currentFilePath) {
        return; // Already loaded
      }

      // Auto-save current file before loading new one
      if (currentFilePath && isDirty) {
        try {
          const fullPath = currentFilePath.startsWith('/')
            ? currentFilePath
            : `${repositoryPath}/${currentFilePath}`;
          await FileSystemService.writeFile(fullPath, markdown);
          console.log('Auto-saved before loading new file:', fullPath);
        } catch (error) {
          console.error('Failed to auto-save before loading new file:', error);
        }
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const fullPath = filePath.startsWith('/')
          ? filePath
          : `${repositoryPath}/${filePath}`;
        const result = await FileSystemService.readFile(fullPath);

        // Extract content from the response object
        let markdownContent = '';
        if (result && typeof result === 'object' && 'content' in result) {
          markdownContent = String(result.content || '');
        } else if (typeof result === 'string') {
          markdownContent = result;
        } else {
          markdownContent = String(result || '');
        }

        setMarkdown(markdownContent);
        setCurrentFilePath(filePath);
        setParseError(null); // Clear any previous parse errors
        setIsDirty(false); // Reset dirty state for new file
      } catch (error) {
        console.error('Error loading file:', error);
        setLoadError(`Failed to load file: ${filePath}`);
        setMarkdown(
          initialContent ||
            '# Error Loading File\n\nFailed to load the requested file.',
        );
        setParseError(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadFileContent();
  }, [
    filePath,
    repositoryPath,
    initialContent,
    currentFilePath,
    isDirty,
    markdown,
  ]);

  // Auto-save on component unmount
  useEffect(() => {
    return () => {
      // Cleanup: auto-save if there are unsaved changes
      if (currentFilePath && isDirty && repositoryPath) {
        const fullPath = currentFilePath.startsWith('/')
          ? currentFilePath
          : `${repositoryPath}/${currentFilePath}`;

        // Use synchronous approach since this is cleanup
        FileSystemService.writeFile(fullPath, markdown)
          .then(() => {
            console.log('Auto-saved on unmount:', fullPath);
          })
          .catch((error) => {
            console.error('Failed to auto-save on unmount:', error);
          });
      }
    };
  }, [currentFilePath, isDirty, markdown, repositoryPath]);

  const handleChange = useCallback((value: string) => {
    setMarkdown(value);
    setParseError(null); // Clear parse errors when content changes
  }, []);

  const handleSave = useCallback(
    async (content?: string) => {
      const contentToSave = content || markdown;

      if (onSave) {
        onSave(contentToSave);
      }

      if (currentFilePath && repositoryPath) {
        try {
          const fullPath = currentFilePath.startsWith('/')
            ? currentFilePath
            : `${repositoryPath}/${currentFilePath}`;
          const result = await FileSystemService.writeFile(
            fullPath,
            contentToSave,
          );

          // Check if save was successful
          if (result && typeof result === 'object' && 'success' in result) {
            if (result.success) {
              console.log('File saved successfully:', fullPath);
              setIsDirty(false); // Reset dirty state after successful save
            } else {
              const errorMsg =
                'error' in result ? result.error : 'Unknown error';
              console.error('Error saving file:', errorMsg);
              alert(`Failed to save file: ${errorMsg}`);
            }
          } else {
            // Assume success if no explicit success field
            setIsDirty(false);
          }
        } catch (error) {
          console.error('Error saving file:', error);
          alert(`Failed to save file: ${error}`);
        }
      }
    },
    [markdown, onSave, currentFilePath, repositoryPath],
  );

  if (!isMounted) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.text,
        }}
      >
        Loading editor...
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.text,
        }}
      >
        Loading file...
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.error,
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '10px' }}>⚠️</div>
        <div>{loadError}</div>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.textSecondary,
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          No File Selected
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            maxWidth: '400px',
          }}
        >
          Select a markdown file (.md or .mdx) from the docs panel to start
          editing
        </p>
      </div>
    );
  }

  // Ensure markdown is always a string
  const safeMarkdown =
    typeof markdown === 'string' ? markdown : String(markdown || '');

  const editorContent = (
    <div
      style={{
        height: '100%',
        width: '100%',
      }}
    >
      <ThemedMDXEditorWithProvider
        key={currentFilePath || 'default'}
        markdown={safeMarkdown}
        onSave={async (content) => {
          await handleSave(content);
        }}
        onChange={handleChange}
        onDirtyChange={setIsDirty}
        readOnly={readOnly}
        filePath={currentFilePath || undefined}
        enableSaveShortcut={!readOnly}
        hideStatusBar={false}
        documentPadding={{ left: 32, right: 32, top: 0, bottom: 32 }}
        onError={(error) => {
          console.error('MDXEditor parsing error:', error);

          // Defer setState to avoid "setState during render" error
          setTimeout(() => {
            if (error && typeof error === 'object' && 'message' in error) {
              setParseError(String(error.message));
            } else {
              setParseError('Markdown parsing error');
            }
          }, 0);
        }}
        plugins={plugins}
      />
    </div>
  );

  // Show parse error notification with editor
  if (parseError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: theme.colors.warning || '#f59e0b',
            color: '#ffffff',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️</span>
          <span>
            {parseError} - Switch to source mode using the toolbar button to
            edit the raw markdown.
          </span>
        </div>
        {variant === 'tab' ? (
          editorContent
        ) : (
          <div style={{ flex: 1 }}>{editorContent}</div>
        )}
      </div>
    );
  }

  // For both tab and panel variants, just return the editor content
  // The library's built-in UI handles the status bar, save shortcuts, etc.
  return editorContent;
};

// Preview component for panel configurator
export const MDXEditorPanelPreview: React.FC = () => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '4px',
        padding: '20px',
      }}
    >
      <FileText size={32} style={{ marginBottom: '12px', opacity: 0.6 }} />
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: '4px',
        }}
      >
        MDX Editor
      </div>
      <div
        style={{
          fontSize: '12px',
          color: theme.colors.textSecondary,
          textAlign: 'center',
        }}
      >
        Rich markdown editor with live preview
      </div>
    </div>
  );
};
