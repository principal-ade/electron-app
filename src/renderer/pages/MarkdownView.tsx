import React, { useEffect, useState, useCallback } from 'react';

import { parseMarkdownIntoPresentation } from 'themed-markdown';
import { useTheme } from '@principal-ade/industry-theme';

import { FileSystemService } from '../main-process-api/FileSystemService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { MarkdownViewerTitlebar } from '../components/Titlebar';
import { FileDeleteConfirmDialog } from '../components/FileDeleteConfirmDialog';

import { MarkdownDocumentViewer } from '../components/MarkdownDocumentViewer';
import { useFileWatch } from '../hooks/useFileWatch';

interface MarkdownViewProps {
  filePath: string;
  projectName?: string;
  initialViewMode?: 'single' | 'book';
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({
  filePath,
  projectName,
  initialViewMode,
}) => {
  const { theme } = useTheme();
  const [content, setContent] = useState<string>(
    '# Loading...\n\nPlease wait while the file is being loaded.',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [fontSizeScale, setFontSizeScale] = useState<number>(1.0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'book'>(
    initialViewMode || 'book',
  );

  // Load font size and view mode preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();
        if (prefs?.markdownFontSizeScale) {
          setFontSizeScale(prefs.markdownFontSizeScale);
        }
        // Only use saved preference if no initialViewMode was provided
        if (!initialViewMode && prefs?.markdownViewMode) {
          setViewMode(prefs.markdownViewMode as 'single' | 'book');
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      }
    };
    loadPreferences();
  }, [initialViewMode]);

  // Handle font size increase
  const handleFontSizeIncrease = useCallback(async () => {
    const newScale = Math.min(fontSizeScale + 0.1, 3.0);
    setFontSizeScale(newScale);
    try {
      await UserPreferencesService.updatePreferences({
        markdownFontSizeScale: newScale,
      });
    } catch (err) {
      console.error('Error saving font size preference:', err);
    }
  }, [fontSizeScale]);

  // Handle font size decrease
  const handleFontSizeDecrease = useCallback(async () => {
    const newScale = Math.max(fontSizeScale - 0.1, 0.5);
    setFontSizeScale(newScale);
    try {
      await UserPreferencesService.updatePreferences({
        markdownFontSizeScale: newScale,
      });
    } catch (err) {
      console.error('Error saving font size preference:', err);
    }
  }, [fontSizeScale]);

  // Handle view mode change
  const handleViewModeChange = useCallback(async (mode: 'single' | 'book') => {
    setViewMode(mode);
    try {
      await UserPreferencesService.updatePreferences({
        markdownViewMode: mode,
      });
    } catch (err) {
      console.error('Error saving view mode preference:', err);
    }
  }, []);

  // Load file content
  const loadFile = useCallback(async () => {
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
      setIsDirty(false); // Reset dirty flag on successful reload
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
  }, [filePath]);

  // Load file on mount and when path changes
  useEffect(() => {
    loadFile();
  }, [loadFile]);

  // File watching: reload when the underlying file changes externally
  useFileWatch(filePath, loadFile, {
    skipReloadWhen: () => isDirty, // Don't reload if user has unsaved changes
  });

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      // First, stop watching the file
      await FileSystemService.stopWatchingFile(filePath);

      // Delete the file
      const result = await FileSystemService.deleteFile(filePath);

      if (result?.success) {
        // Close the window after successful deletion
        window.close();
      } else {
        throw new Error(result?.error || 'Failed to delete file');
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(
        `Failed to delete file: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      setShowDeleteConfirm(false);
    }
  }, [filePath]);

  if (loading) {
    return (
      <div
        style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <MarkdownViewerTitlebar
          filePath={filePath}
          fileName={filePath.split('/').pop()}
          projectName={projectName}
          fontSizeScale={fontSizeScale}
          viewMode={viewMode}
          onFontSizeIncrease={handleFontSizeIncrease}
          onFontSizeDecrease={handleFontSizeDecrease}
          onDelete={() => setShowDeleteConfirm(true)}
          onViewModeChange={handleViewModeChange}
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
      <div
        style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <MarkdownViewerTitlebar
          filePath={filePath}
          fileName={filePath.split('/').pop()}
          projectName={projectName}
          fontSizeScale={fontSizeScale}
          viewMode={viewMode}
          onFontSizeIncrease={handleFontSizeIncrease}
          onFontSizeDecrease={handleFontSizeDecrease}
          onDelete={() => setShowDeleteConfirm(true)}
          onViewModeChange={handleViewModeChange}
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
        onFontSizeIncrease={handleFontSizeIncrease}
        onFontSizeDecrease={handleFontSizeDecrease}
        onDelete={() => setShowDeleteConfirm(true)}
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

        {/* Slide-based viewer with book view support */}
        <MarkdownDocumentViewer
          viewMode={'book'} // Always use book mode wrapper which handles single/book internally
          showEditor={false}
          showSegmented={true}
          content={safeContent}
          slides={(() => {
            try {
              const presentation = parseMarkdownIntoPresentation(safeContent);
              return (presentation?.slides || []).map(
                (s) => s.location.content,
              );
            } catch (e) {
              console.warn('[MarkdownView] Failed to parse presentation:', e);
              return [safeContent];
            }
          })()}
          currentSlide={0}
          theme={theme}
          fontSizeScale={fontSizeScale}
          bookViewMode={viewMode} // Pass the actual view mode for the book component
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

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <FileDeleteConfirmDialog
            filePath={filePath}
            fileName={filePath.split('/').pop()}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </div>
    </div>
  );
};
