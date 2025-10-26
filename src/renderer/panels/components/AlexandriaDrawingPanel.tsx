import React, { useState, useEffect } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { ExcalidrawWrapper } from '../../components/shared/ExcalidrawWrapper';
import { AlexandriaDrawingService } from '../../main-process-api/AlexandriaDrawingService';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';
import type { ExcalidrawDiagramData } from '../../../shared/main-process-api-interfaces/ExcalidrawAPI';

interface AlexandriaDrawingPanelProps {
  // Optional initial drawing to load (without .excalidraw extension)
  drawingId?: string;
}

export const AlexandriaDrawingPanel: React.FC<AlexandriaDrawingPanelProps> = ({
  drawingId: initialDrawingId,
}) => {
  const { theme } = useTheme();
  const { repositoryPath } = useRepositoryPanelContext();
  const [currentDrawingId, setCurrentDrawingId] = useState<string | undefined>(
    initialDrawingId,
  );
  const [drawingData, setDrawingData] = useState<ExcalidrawDiagramData | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(!!initialDrawingId);

  // Load drawing data when drawing ID changes
  useEffect(() => {
    if (currentDrawingId && repositoryPath) {
      setLoading(true);
      const fileName = currentDrawingId.endsWith('.excalidraw')
        ? currentDrawingId
        : `${currentDrawingId}.excalidraw`;

      AlexandriaDrawingService.loadDiagram(fileName, repositoryPath)
        .then((data) => {
          if (data) {
            setDrawingData(data);
            setHasDrawing(true);
          }
        })
        .catch((err) => {
          console.error('Failed to load drawing:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [currentDrawingId, repositoryPath]);

  const handleCreateNewDrawing = () => {
    setCurrentDrawingId(undefined);
    setDrawingData(null);
    setHasDrawing(true);
  };

  const handleSave = (diagramId: string) => {
    setCurrentDrawingId(diagramId);
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
          fontSize: '14px',
          gap: '8px',
          backgroundColor: theme.colors.background,
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <Pencil size={48} style={{ opacity: 0.3 }} />
        <div style={{ fontWeight: 500 }}>No repository selected</div>
        <div style={{ fontSize: '12px', opacity: 0.7, maxWidth: '400px' }}>
          Excalidraw drawings are saved to the repository's Memory Palace.
        </div>
      </div>
    );
  }

  if (!hasDrawing) {
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
          fontSize: '14px',
          gap: '16px',
          backgroundColor: theme.colors.background,
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <Pencil size={48} style={{ opacity: 0.3 }} />
        <div style={{ fontWeight: 500 }}>No drawing loaded</div>
        <div style={{ fontSize: '12px', opacity: 0.7, maxWidth: '400px' }}>
          Create a new drawing or select one from the drawings list panel.
        </div>
        <button
          onClick={handleCreateNewDrawing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: theme.colors.primary,
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
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
          Create New Drawing
        </button>
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
        Loading drawing...
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
      <ExcalidrawWrapper
        initialData={drawingData || undefined}
        diagramId={currentDrawingId}
        diagramName={
          drawingData?.appState?.name ||
          currentDrawingId?.replace('.excalidraw', '') ||
          'Untitled Diagram'
        }
        projectPath={repositoryPath}
        onSave={handleSave}
        useAlexandriaStorage={true}
        showSaveButton={true}
        showNameEditor={false}
        showNewDiagramButton={false}
        onClose={handleCreateNewDrawing}
      />
    </div>
  );
};

export const AlexandriaDrawingPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        height: '80px',
      }}
    >
      <Pencil size={32} style={{ color: theme.colors.primary }} />
      <span
        style={{
          fontSize: '11px',
          color: theme.colors.textSecondary,
        }}
      >
        Diagram Editor
      </span>
    </div>
  );
};
