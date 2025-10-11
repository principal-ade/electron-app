import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { ExcalidrawWrapper } from '../../components/shared/ExcalidrawWrapper';
import { AlexandriaDrawingService } from '../../main-process-api/AlexandriaDrawingService';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';
import type { ExcalidrawDiagramData } from '../../../shared/main-process-api-interfaces/ExcalidrawAPI';

interface ExcalidrawPanelProps {
  // Optional initial drawing to load
  drawingId?: string;
  drawingName?: string;
}

export const ExcalidrawPanel: React.FC<ExcalidrawPanelProps> = ({
  drawingId: initialDrawingId,
  drawingName: initialDrawingName,
}) => {
  const { theme } = useTheme();
  const { repositoryPath } = useRepositoryPanelContext();
  const [currentDrawingId, setCurrentDrawingId] = useState<string | undefined>(
    initialDrawingId,
  );
  const [currentDrawingName, setCurrentDrawingName] = useState<string>(
    initialDrawingName || 'Untitled Drawing',
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
    setCurrentDrawingName('Untitled Drawing');
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
        initialData={drawingData}
        diagramId={currentDrawingId}
        diagramName={currentDrawingName}
        projectPath={repositoryPath}
        onSave={handleSave}
        useAlexandriaStorage={true}
        showSaveButton={true}
        showNameEditor={true}
        showNewDiagramButton={true}
        onClose={handleCreateNewDrawing}
      />
    </div>
  );
};
