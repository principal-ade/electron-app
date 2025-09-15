import React, { useEffect, useState, useCallback } from 'react';

import { IndustryEditableMarkdownSlide } from 'themed-markdown';
import { useTheme } from 'themed-markdown';

import { ShellService } from '../main-process-api/ShellService';

import { FileSystemService } from '../main-process-api/FileSystemService';

interface MarkdownViewProps {
  filePath: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ filePath }) => {
  const { theme } = useTheme();
  const [content, setContent] = useState<string>('# Loading...\n\nPlease wait while the file is being loaded.');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

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
        setError(`Failed to load file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        // Set a fallback content to prevent parseMarkdownChunks error
        setContent('# Error Loading File\n\nAn error occurred while loading the file.');
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
  }, []);

  // Handle saving
  const handleSave = useCallback(async (newContent: string) => {
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
  }, [filePath]);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[2]
      }}>
        Loading markdown file...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        color: theme.colors.error,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[2],
        padding: theme.space[4]
      }}>
        {error}
      </div>
    );
  }


  // Add a safeguard to ensure content is always a string
  const safeContent = typeof content === 'string' ? content : '# Loading...\n\nPlease wait...';

  return (
    <div style={{
      height: '100vh',
      width: '100%',
      backgroundColor: theme.colors.background,
      position: 'relative'
    }}>
      {/* Unsaved indicator */}
      {isDirty && (
        <div style={{
          position: 'absolute',
          top: theme.space[3],
          left: theme.space[3],
          padding: `${theme.space[1]}px ${theme.space[2]}px`,
          backgroundColor: theme.colors.warning,
          color: theme.colors.background,
          borderRadius: theme.radii[1],
          fontSize: theme.fontSizes[0],
          zIndex: 20,
        }}>
          Unsaved changes
        </div>
      )}
      <IndustryEditableMarkdownSlide
        content={safeContent}
        slideIdPrefix="markdown"
        slideIndex={0}
        isVisible={true}
        enableMermaidPopout={true}
        enableHtmlPopout={true}
        onLinkClick={(href) => {
          // Handle link clicks - could open in browser or handle internally
          if (href.startsWith('http://') || href.startsWith('https://')) {
            ShellService.openExternal(href);
          }
        }}
        // Editing props
        onContentChange={handleContentChange}
        onSave={handleSave}
        autoSaveDelay={2000} // 2 seconds
        editable={true}
        showEditButton={true}
        theme={theme}
      />
    </div>
  );
};
