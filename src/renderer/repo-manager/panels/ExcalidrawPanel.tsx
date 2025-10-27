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

  // When this value changes, start the create new flow
  createNewTrigger?: number;

  // Source and content provider (like MarkdownRenderingPanel)
  source?: FileTreeSource | null;
  contentProvider?: {
    readFileContent: (path: string) => Promise<string | null>;
  };

  // Close handler
  onClose?: () => void;

  // Called when a new diagram is created/saved with its ID
  onDiagramCreated?: (diagramId: string) => void;
}

export const ExcalidrawPanel: React.FC<ExcalidrawPanelProps> = ({
  filePath,
  createNewTrigger,
  source,
  contentProvider,
  onClose,
  onDiagramCreated,
}) => {
  const { theme } = useTheme();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [docContent, setDocContent] = useState<ExcalidrawDiagramData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestFilePathRef = useRef<string | null>(null);
  const lastCreateNewTriggerRef = useRef<number | undefined>(undefined);
  const [newDiagramName, setNewDiagramName] = useState<string>('New Diagram');
  // Track the actual diagram name from metadata
  const [loadedDiagramName, setLoadedDiagramName] = useState<string | null>(null);
  // Counter to force remount when creating multiple new diagrams
  const [newDiagramKey, setNewDiagramKey] = useState(0);
  // Name editing state for existing diagrams
  const [isEditingLoadedName, setIsEditingLoadedName] = useState(false);
  const [editingLoadedName, setEditingLoadedName] = useState<string>('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Ref to trigger save in ExcalidrawWrapper
  const wrapperSaveRef = useRef<(() => Promise<void>) | null>(null);

  const isLocalFile = source?.type === 'local';
  const sourceLocation = source?.type === 'local' ? source.location : null;

  // Load document content when filePath changes
  useEffect(() => {
    const loadFile = async () => {
      if (!filePath) {
        latestFilePathRef.current = null;
        setDocContent(null);
        setError(null);
        setLoadedDiagramName(null);
        return;
      }

      // Determine if this is a Memory Palace drawing ID (doesn't start with /)
      // Memory Palace drawings are passed as drawing IDs like "drawing-123.excalidraw"
      const isMemoryPalaceDrawing =
        !filePath.startsWith('/') && !filePath.startsWith('.');

      // Construct absolute path inline for regular files
      const absolutePath =
        isLocalFile && sourceLocation && !isMemoryPalaceDrawing
          ? filePath.startsWith('/')
            ? filePath
            : `${sourceLocation}/${filePath}`
          : filePath;

      latestFilePathRef.current = absolutePath;

      setIsLoading(true);
      setError(null);

      try {
        let data: ExcalidrawDiagramData | null = null;

        // For Memory Palace drawings, use AlexandriaDrawingService
        if (isMemoryPalaceDrawing && isLocalFile && sourceLocation) {
          data = await AlexandriaDrawingService.loadDiagram(
            filePath,
            sourceLocation,
          );
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
          const relativePath = filePath.startsWith('/')
            ? filePath.substring(1)
            : filePath;
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

          // Extract the diagram name from metadata, fallback to filename
          const diagramName = data.appState?.name ||
                             filePath.split('/').pop()?.replace('.excalidraw', '') ||
                             'Untitled Diagram';
          setLoadedDiagramName(diagramName);
        } else {
          throw new Error('Failed to load diagram');
        }
      } catch (err) {
        console.error('Error loading Excalidraw file:', err);
        if (latestFilePathRef.current === absolutePath) {
          setError(err instanceof Error ? err.message : 'Failed to load file');
          setDocContent(null);
          setLoadedDiagramName(null);
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
    setNewDiagramName('New Diagram'); // Reset name when creating new
    setNewDiagramKey(prev => prev + 1); // Increment key to force remount
  };

  const handleCloseNewDrawing = () => {
    setIsCreatingNew(false);
    setNewDiagramName('New Diagram'); // Reset name when closing
  };

  const handleDiagramSaved = (diagramId: string) => {
    // Notify parent component about the newly created diagram
    if (onDiagramCreated) {
      onDiagramCreated(diagramId);
    }
  };

  const handleStartEditingLoadedName = () => {
    if (loadedDiagramName) {
      setEditingLoadedName(loadedDiagramName);
      setIsEditingLoadedName(true);
      // Focus input after state update
      setTimeout(() => {
        nameInputRef.current?.select();
      }, 0);
    }
  };

  const handleSaveLoadedName = async () => {
    const newName = editingLoadedName.trim() || loadedDiagramName || 'Untitled Diagram';
    setLoadedDiagramName(newName);
    setIsEditingLoadedName(false);

    // Wait a moment for the state to propagate to ExcalidrawWrapper
    // then trigger a save to persist the new name
    setTimeout(async () => {
      if (wrapperSaveRef.current) {
        await wrapperSaveRef.current();
      }
    }, 100);
  };

  const handleCancelEditLoadedName = () => {
    setIsEditingLoadedName(false);
    setEditingLoadedName(loadedDiagramName || '');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveLoadedName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEditLoadedName();
    }
  };

  useEffect(() => {
    if (createNewTrigger === undefined) {
      return;
    }

    if (createNewTrigger !== lastCreateNewTriggerRef.current) {
      lastCreateNewTriggerRef.current = createNewTrigger;

      if (createNewTrigger > 0) {
        setIsCreatingNew(true);
        setNewDiagramKey(prev => prev + 1); // Increment key to force remount
      }
    }
  }, [createNewTrigger]);

  useEffect(() => {
    if (filePath) {
      setIsCreatingNew(false);
    }
  }, [filePath]);

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
                {newDiagramName}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                }}
              >
                {sourceLocation
                  ? 'Auto-saved to Memory Palace'
                  : 'Auto-saved to app data'}
              </span>
            </div>
          </div>

          {onClose && (
            <button
              onClick={handleCloseNewDrawing}
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
          <ExcalidrawWrapper
            key={`new-diagram-${newDiagramKey}`} // Force remount for each new diagram
            onChange={() => {}}
            onClose={handleCloseNewDrawing}
            onSave={handleDiagramSaved}
            projectPath={sourceLocation ?? undefined}
            useAlexandriaStorage={!!sourceLocation}
            showSaveButton={true}
            showNewDiagramButton={true}
            showNameEditor={false}
            onDiagramNameChange={setNewDiagramName}
          />
        </div>
      </div>
    );
  }

  if (!filePath || !docContent) {
    const description = sourceLocation
      ? "Select an Excalidraw diagram file from the docs tab to view it here, or create a new one. New drawings will be saved to your repository's Memory Palace."
      : 'Select an Excalidraw diagram file from the docs tab to view it here, or create a new one. New drawings will be saved to your app data.';

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
            {isEditingLoadedName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editingLoadedName}
                onChange={(e) => setEditingLoadedName(e.target.value)}
                onBlur={handleSaveLoadedName}
                onKeyDown={handleNameKeyDown}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  background: theme.colors.background,
                  border: `1px solid ${theme.colors.primary}`,
                  borderRadius: '4px',
                  padding: '2px 6px',
                  outline: 'none',
                  minWidth: '200px',
                }}
              />
            ) : (
              <span
                onClick={handleStartEditingLoadedName}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.colors.backgroundSecondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Click to edit name"
              >
                {loadedDiagramName || filePath.split('/').pop()}
              </span>
            )}
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
            diagramName={loadedDiagramName || 'Untitled Diagram'}
            initialData={docContent}
            onChange={() => {}}
            projectPath={sourceLocation ?? undefined}
            useAlexandriaStorage={!!sourceLocation}
            showSaveButton={true} // Enable save button for editing
            showNewDiagramButton={false} // Disable new diagram button in view mode
            showNameEditor={false} // Name editing handled by header
            saveRef={wrapperSaveRef} // Allow triggering save from panel
          />
        )}
      </div>
    </div>
  );
};
