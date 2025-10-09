import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Plus, Info } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { ExcalidrawWrapper } from '../../components/shared/ExcalidrawWrapper';
import { PanelEmptyState } from './PanelEmptyState';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { AlexandriaDrawingService } from '../../main-process-api/AlexandriaDrawingService';
import type { FileTreeSource } from '../../types/file-tree-source';
import type { ExcalidrawDiagramData } from '../../../shared/main-process-api-interfaces/ExcalidrawAPI';

interface ExcalidrawPanelProps {
  // File path
  filePath: string | null;

  // Source and content provider (like MarkdownRenderingPanel)
  source?: FileTreeSource | null;
  contentProvider?: {
    readFileContent: (path: string) => Promise<string | null>;
  };

  // Close handler
  onClose?: () => void;
}

export const ExcalidrawPanel: React.FC<ExcalidrawPanelProps> = ({
  filePath,
  source,
  contentProvider,
  onClose,
}) => {
  const { theme } = useTheme();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [docContent, setDocContent] = useState<ExcalidrawDiagramData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestFilePathRef = useRef<string | null>(null);

  const isLocalFile = source?.type === 'local';
  const sourceLocation = source?.type === 'local' ? source.location : null;

  // Load document content when filePath changes
  useEffect(() => {
    const loadFile = async () => {
      if (!filePath) {
        latestFilePathRef.current = null;
        setDocContent(null);
        setError(null);
        return;
      }

      // Determine if this is a Memory Palace drawing ID (doesn't start with /)
      // Memory Palace drawings are passed as drawing IDs like "drawing-123.excalidraw"
      const isMemoryPalaceDrawing = !filePath.startsWith('/') && !filePath.startsWith('.');

      // Construct absolute path inline for regular files
      const absolutePath = isLocalFile && sourceLocation && !isMemoryPalaceDrawing
        ? (filePath.startsWith('/') ? filePath : `${sourceLocation}/${filePath}`)
        : filePath;

      latestFilePathRef.current = absolutePath;

      setIsLoading(true);
      setError(null);

      try {
        let data: ExcalidrawDiagramData | null = null;

        // For Memory Palace drawings, use AlexandriaDrawingService
        if (isMemoryPalaceDrawing && isLocalFile && sourceLocation) {
          data = await AlexandriaDrawingService.loadDiagram(filePath, sourceLocation);
          if (!data) {
            throw new Error('Failed to load drawing from Memory Palace');
          }
        }
        // For local file system sources, read from filesystem
        else if (isLocalFile) {
          const result = await FileSystemService.readFile(absolutePath);
          const content = result?.content ?? null;
          if (content !== null) {
            try {
              data = JSON.parse(content) as ExcalidrawDiagramData;
            } catch (parseErr) {
              throw new Error('Invalid Excalidraw file format');
            }
          } else {
            throw new Error('Failed to read file');
          }
        }
        // For remote sources, use content provider if available
        else if (contentProvider) {
          const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
          const content = await contentProvider.readFileContent(relativePath);
          if (content !== null) {
            try {
              data = JSON.parse(content) as ExcalidrawDiagramData;
            } catch (parseErr) {
              throw new Error('Invalid Excalidraw file format');
            }
          } else {
            throw new Error('Failed to read file');
          }
        }

        if (latestFilePathRef.current !== absolutePath) {
          return;
        }

        if (data !== null) {
          setDocContent(data);
          setError(null);
        } else {
          throw new Error('Failed to load diagram');
        }
      } catch (err) {
        console.error('Error loading Excalidraw file:', err);
        if (latestFilePathRef.current === absolutePath) {
          setError(err instanceof Error ? err.message : 'Failed to load file');
          setDocContent(null);
        }
      } finally {
        if (latestFilePathRef.current === absolutePath) {
          setIsLoading(false);
        }
      }
    };

    loadFile();
  }, [filePath, isLocalFile, sourceLocation, contentProvider]);

  const handleCreateNew = () => {
    setIsCreatingNew(true);
  };

  const handleCloseNewDrawing = () => {
    setIsCreatingNew(false);
  };

  // Show new drawing editor if user clicked create
  if (isCreatingNew) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: theme.colors.background,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Info banner about where drawings are saved */}
        {sourceLocation && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: `${theme.colors.primary}15`,
              borderBottom: `1px solid ${theme.colors.primary}30`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            <Info size={14} color={theme.colors.primary} />
            <span>
              Drawings are auto-saved to <strong>Memory Palace</strong> in your repository
            </span>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ExcalidrawWrapper
            onChange={() => {}}
            onClose={handleCloseNewDrawing}
            projectPath={sourceLocation ?? undefined}
            useAlexandriaStorage={!!sourceLocation}
            showSaveButton={true}
            showNewDiagramButton={true}
            showNameEditor={true}
          />
        </div>
      </div>
    );
  }

  if (!filePath || !docContent) {
    const description = sourceLocation
      ? "Select an Excalidraw diagram file from the docs tab to view it here, or create a new one. New drawings will be saved to your repository's Memory Palace."
      : "Select an Excalidraw diagram file from the docs tab to view it here, or create a new one. New drawings will be saved to your app data.";

    return (
      <PanelEmptyState
        icon={Pencil}
        title="No diagram selected"
        description={description}
        actions={[
          {
            label: 'Create New Drawing',
            icon: Plus,
            onClick: handleCreateNew,
          },
        ]}
      />
    );
  }

  // Show error state
  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ marginBottom: '8px', color: theme.colors.error }}>
            Failed to load diagram
          </div>
          <div style={{ fontSize: '12px' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Excalidraw header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Pencil size={16} color={theme.colors.primary} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              {filePath.split('/').pop()}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: theme.colors.textSecondary,
              }}
            >
              {filePath}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: theme.colors.textSecondary,
              borderRadius: '4px',
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Excalidraw content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}
          >
            Loading diagram...
          </div>
        ) : (
          <ExcalidrawWrapper
            key={filePath} // Force remount when switching drawings
            diagramId={filePath ?? undefined} // Pass the drawing ID/path
            diagramName={filePath ? filePath.split('/').pop()?.replace('.excalidraw', '') : undefined}
            initialData={docContent}
            onChange={() => {}}
            projectPath={sourceLocation ?? undefined}
            useAlexandriaStorage={!!sourceLocation}
            showSaveButton={true} // Enable save button for editing
            showNewDiagramButton={false} // Disable new diagram button in view mode
            showNameEditor={true} // Enable name editing
          />
        )}
      </div>
    </div>
  );
};
