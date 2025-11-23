import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Clock, Plus, Copy } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { AlexandriaDrawingService } from '../../main-process-api/AlexandriaDrawingService';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';
import type { DiagramListItem } from '../../main-process-api/ExcalidrawStorageService';
import {
  diagramEventBus,
  DIAGRAM_EVENTS,
} from '../../services/DiagramEventBus';

interface DrawingsListPanelProps {
  onDrawingSelect?: (drawingId: string, drawingName: string) => void;
  onCreateNew?: () => void;
}

export const DrawingsListPanel: React.FC<DrawingsListPanelProps> = ({
  onDrawingSelect,
  onCreateNew,
}) => {
  const { theme } = useTheme();
  const { repositoryPath } = useRepositoryPanelContext();
  const [drawings, setDrawings] = useState<DiagramListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null,
  );

  const loadDrawings = useCallback(async () => {
    if (!repositoryPath) {
      setDrawings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const drawingsList =
        await AlexandriaDrawingService.listDiagrams(repositoryPath);
      // Sort by most recently updated first
      drawingsList.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      setDrawings(drawingsList);
    } catch (err) {
      console.error('Failed to load drawings:', err);
      setDrawings([]);
    } finally {
      setLoading(false);
    }
  }, [repositoryPath]);

  useEffect(() => {
    void loadDrawings();
  }, [loadDrawings]);

  // Listen to diagram events to refresh the list
  useEffect(() => {
    const handleDiagramCreated = (event: {
      id: string;
      name: string;
      projectPath?: string;
    }) => {
      void loadDrawings();
      // Select the newly created diagram
      setSelectedDrawingId(event.id);
      if (onDrawingSelect) {
        onDrawingSelect(event.id, event.name);
      }
    };

    const handleDiagramSaved = () => {
      void loadDrawings();
    };

    diagramEventBus.on(DIAGRAM_EVENTS.DIAGRAM_CREATED, handleDiagramCreated);
    diagramEventBus.on(DIAGRAM_EVENTS.DIAGRAM_SAVED, handleDiagramSaved);

    return () => {
      diagramEventBus.off(DIAGRAM_EVENTS.DIAGRAM_CREATED, handleDiagramCreated);
      diagramEventBus.off(DIAGRAM_EVENTS.DIAGRAM_SAVED, handleDiagramSaved);
    };
  }, [loadDrawings, onDrawingSelect]);

  const handleDrawingClick = (drawing: DiagramListItem) => {
    setSelectedDrawingId(drawing.id);
    if (onDrawingSelect) {
      onDrawingSelect(drawing.id, drawing.name);
    }
  };

  const handleCopyPath = async (
    drawing: DiagramListItem,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    if (!drawing.filePath) {
      console.error('File path not available for this drawing');
      return;
    }

    try {
      await navigator.clipboard.writeText(drawing.filePath);
    } catch (err) {
      console.error('Failed to copy path to clipboard:', err);
    }
  };

  const handleDeleteDrawing = async (
    drawing: DiagramListItem,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${drawing.name}"?`)) {
      return;
    }

    if (!repositoryPath) return;

    const fileName = drawing.id.endsWith('.excalidraw')
      ? drawing.id
      : `${drawing.id}.excalidraw`;

    const success = await AlexandriaDrawingService.deleteDiagram(
      fileName,
      repositoryPath,
    );
    if (success) {
      // Reload the list
      await loadDrawings();
      // Clear selection if deleted drawing was selected
      if (selectedDrawingId === drawing.id) {
        setSelectedDrawingId(null);
      }
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  if (!repositoryPath) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          fontSize: theme.fontSizes[1],
          fontFamily: theme.fonts.body,
          gap: '8px',
          backgroundColor: theme.colors.background,
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <Pencil size={48} style={{ opacity: 0.3 }} />
        <div style={{ fontWeight: theme.fontWeights.medium }}>
          No repository selected
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[0],
            opacity: 0.7,
            maxWidth: '400px',
          }}
        >
          Select a repository to view its drawings.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.textSecondary,
        }}
      >
        Loading drawings...
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        fontFamily: theme.fonts.body,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Pencil size={16} color={theme.colors.primary} />
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
            }}
          >
            Drawings ({drawings.length})
          </span>
        </div>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              cursor: 'pointer',
              fontSize: theme.fontSizes[0],
              fontFamily: theme.fonts.body,
              fontWeight: theme.fontWeights.medium,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Plus size={14} />
            New
          </button>
        )}
      </div>

      {/* Drawings List */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
        }}
      >
        {drawings.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              gap: '16px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <Pencil size={48} style={{ opacity: 0.3 }} />
            <div style={{ fontWeight: theme.fontWeights.medium }}>
              No drawings yet
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[0],
                opacity: 0.7,
                maxWidth: '300px',
              }}
            >
              Create your first drawing to get started.
            </div>
            {onCreateNew && (
              <button
                onClick={onCreateNew}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
                  fontWeight: theme.fontWeights.medium,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <Plus size={16} />
                Create Drawing
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {drawings.map((drawing) => (
              <div
                key={drawing.id}
                onClick={() => handleDrawingClick(drawing)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: `1px solid ${
                    selectedDrawingId === drawing.id
                      ? theme.colors.primary
                      : theme.colors.border
                  }`,
                  backgroundColor:
                    selectedDrawingId === drawing.id
                      ? `${theme.colors.primary}15`
                      : theme.colors.backgroundSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (selectedDrawingId !== drawing.id) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundLight;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedDrawingId !== drawing.id) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundSecondary;
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Pencil size={14} color={theme.colors.primary} />
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        fontWeight: theme.fontWeights.medium,
                        color: theme.colors.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {drawing.name}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <button
                      onClick={(e) => handleCopyPath(drawing, e)}
                      title="Copy file path"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                        color: theme.colors.textSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`;
                        e.currentTarget.style.color = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color =
                          theme.colors.textSecondary;
                      }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteDrawing(drawing, e)}
                      title="Delete drawing"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                        color: theme.colors.textSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${theme.colors.error}20`;
                        e.currentTarget.style.color = theme.colors.error;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color =
                          theme.colors.textSecondary;
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                  }}
                >
                  <Clock size={10} />
                  <span>{formatDate(drawing.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const DrawingsListPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: theme.fontSizes[0],
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Pencil size={14} style={{ color: theme.colors.primary }} />
        <span>architecture.excalidraw</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Pencil size={14} style={{ color: theme.colors.primary }} />
        <span>flow-diagram.excalidraw</span>
      </div>
    </div>
  );
};
