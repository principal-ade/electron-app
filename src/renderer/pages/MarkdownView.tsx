import React, { useEffect, useState, useCallback } from 'react';

import { parseMarkdownIntoPresentation } from 'themed-markdown';
import { useTheme } from 'themed-markdown';

import { FileSystemService } from '../main-process-api/FileSystemService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { MarkdownViewerTitlebar } from '../components/Titlebar';

import { MarkdownDocumentViewer } from './RepoManager/shared/MarkdownDocumentViewer';

interface MarkdownViewProps {
  filePath: string;
  fontSizeScale?: number;
  projectName?: string;
  onFontSizeIncrease?: () => void;
  onFontSizeDecrease?: () => void;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({
  filePath,
  fontSizeScale: propFontSizeScale,
  projectName,
  onFontSizeIncrease,
  onFontSizeDecrease
}) => {
  const { theme } = useTheme();
  const [content, setContent] = useState<string>(
    '# Loading...\n\nPlease wait while the file is being loaded.',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [fontSizeScale, setFontSizeScale] = useState<number>(propFontSizeScale || 1.0);

  // Update font size when prop changes
  useEffect(() => {
    if (propFontSizeScale) {
      setFontSizeScale(propFontSizeScale);
    }
  }, [propFontSizeScale]);

  // Load font size preference on mount if not provided as prop
  useEffect(() => {
    if (!propFontSizeScale) {
      const loadFontSize = async () => {
        try {
          const prefs = await UserPreferencesService.getPreferences();
          if (prefs?.markdownFontSizeScale) {
            setFontSizeScale(prefs.markdownFontSizeScale);
          }
        } catch (err) {
          console.error('Error loading font size preference:', err);
        }
      };
      loadFontSize();
    }
  }, [propFontSizeScale]);

  useEffect(() => {
    const loadFile = async () => {
      try {
        setLoading(true);
        const result = await FileSystemService.readFile(filePath);

        // Extract content from the result object
        const fileContent = result?.content;

        // Ensure content is a string
        if (typeof fileContent !== 'string') {
          throw new Error('File content is not a string');
        }

        // Ensure content is not empty
        if (!fileContent || fileContent.trim().length === 0) {
          setContent('# Empty File\n\nThis file appears to be empty.');
        } else {
          setContent(fileContent);
        }
        setError(null);
      } catch (err) {
        console.error('Error reading markdown file:', err);
        setError(
          `Failed to load file: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
        // Set a fallback content to prevent parseMarkdownChunks error
        setContent(
          '# Error Loading File\n\nAn error occurred while loading the file.',
        );
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  // File watching: reload when the underlying file changes externally.
  useEffect(() => {
    if (!filePath) return;

    let unsubscribe: (() => void) | null = null;
    let isWatching = false;
    let stopped = false;

    const setupWatcher = async () => {
      try {
        // Start watching the file in the main process
        await FileSystemService.watchFile(filePath);
        isWatching = true;

        // Subscribe to file change events
        unsubscribe = FileSystemService.onFileChange((event) => {
          // Only react to events for this file path
          try {
            if (!event || !event.path) return;
            if (event.path !== filePath) return;

            // Avoid reloading while user has unsaved changes
            if (isDirty) {
              // We still mark that the file changed externally; caller can decide
              console.info('[MarkdownView] External change detected but view is dirty; not reloading automatically.');
              return;
            }

            // Reload file content
            (async () => {
              try {
                const result = await FileSystemService.readFile(filePath);
                const fileContent = result?.content;
                if (typeof fileContent === 'string') {
                  setContent(fileContent || '# Empty File\n\nThis file appears to be empty.');
                  setError(null);
                  setIsDirty(false);
                }
              } catch (err) {
                console.warn('[MarkdownView] Failed to reload file after change:', err);
              }
            })();
          } catch (e) {
            console.error('[MarkdownView] Error handling file change event:', e);
          }
        });
      } catch (err) {
        console.warn('[MarkdownView] Failed to start watching file:', err);
      }
    };

    setupWatcher();

    return () => {
      // Stop watching and cleanup subscription
      stopped = true;
      if (isWatching) {
        FileSystemService.stopWatchingFile(filePath).catch((err) =>
          console.warn('[MarkdownView] Failed to stop watching file:', err),
        );
      }
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (e) {
          console.warn('[MarkdownView] Failed to unsubscribe file change listener:', e);
        }
      }
    };
  }, [filePath, isDirty]);


  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
  }, []);

  // Handle saving
  const handleSave = useCallback(
    async (newContent: string) => {
      try {
        const result = await FileSystemService.writeFile(filePath, newContent);
        if (result?.success) {
          setIsDirty(false);
          // Could show a toast notification here
        } else {
          throw new Error(result?.error || 'Failed to save file');
        }
      } catch (err) {
        console.error('Error saving file:', err);
        throw err; // Re-throw to let the component handle it
      }
    },
    [filePath],
  );

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MarkdownViewerTitlebar
          filePath={filePath}
          fileName={filePath.split('/').pop()}
          projectName={projectName}
          fontSizeScale={fontSizeScale}
          onFontSizeIncrease={onFontSizeIncrease}
          onFontSizeDecrease={onFontSizeDecrease}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[2],
          }}
        >
          Loading markdown file...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MarkdownViewerTitlebar
          filePath={filePath}
          fileName={filePath.split('/').pop()}
          projectName={projectName}
          fontSizeScale={fontSizeScale}
          onFontSizeIncrease={onFontSizeIncrease}
          onFontSizeDecrease={onFontSizeDecrease}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.background,
            color: theme.colors.error,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[2],
            padding: theme.space[4],
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  // Add a safeguard to ensure content is always a string
  const safeContent =
    typeof content === 'string' ? content : '# Loading...\n\nPlease wait...';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <MarkdownViewerTitlebar
        filePath={filePath}
        fileName={filePath.split('/').pop()}
        projectName={projectName}
        fontSizeScale={fontSizeScale}
        onFontSizeIncrease={onFontSizeIncrease}
        onFontSizeDecrease={onFontSizeDecrease}
      />
      <div
        style={{
          flex: 1,
          width: '100%',
          backgroundColor: theme.colors.background,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Unsaved indicator */}
        {isDirty && (
          <div
            style={{
              position: 'absolute',
              top: theme.space[3],
              left: theme.space[3],
              padding: `${theme.space[1]}px ${theme.space[2]}px`,
              backgroundColor: theme.colors.warning,
              color: theme.colors.background,
              borderRadius: theme.radii[1],
              fontSize: theme.fontSizes[0],
              zIndex: 20,
            }}
          >
            Unsaved changes
          </div>
        )}

        {/* Slide-based viewer (parse content into slides and render the shared viewer) */}
        <MarkdownDocumentViewer
        viewMode={'slides'}
        showEditor={false}
        showSegmented={true}
        content={safeContent}
        slides={
          (() => {
            try {
              const presentation = parseMarkdownIntoPresentation(safeContent);
              return (presentation?.slides || []).map((s) => s.location.content);
            } catch (e) {
              console.warn('[MarkdownView] Failed to parse presentation:', e);
              return [safeContent];
            }
          })()
        }
        currentSlide={0}
        theme={theme}
        fontSizeScale={fontSizeScale}
        onContentChange={(newContent) => {
          setContent(newContent);
          setIsDirty(true);
        }}
        onSlideNavigate={() => {
          /* No-op or could focus navigation controls if added */
        }}
        onCheckboxChange={(_slideIndex, _lineNumber, _checked) => {
          // Optionally treat checkbox toggles as edits
          setIsDirty(true);
        }}
        />
      </div>
    </div>
  );
};
