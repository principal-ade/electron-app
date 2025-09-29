import React, { useState, useEffect } from 'react';
import { FileImage, Trash2 } from 'lucide-react';
import type { Theme } from 'themed-markdown';
import { RoomDrawingService } from '../../../../main-process-api/RoomDrawingService';
import type { RoomDrawingMetadata } from '@a24z/core-library';

interface DrawingsListProps {
  roomId: string;
  repositoryPath: string;
  theme: Theme;
  onEditDrawing: (drawingName: string) => void;
}

export const DrawingsList: React.FC<DrawingsListProps> = ({
  roomId,
  repositoryPath,
  theme,
  onEditDrawing
}) => {
  const [drawings, setDrawings] = useState<RoomDrawingMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDrawings();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDrawings = async () => {
    setLoading(true);
    try {
      // Use the new simplified API that handles room associations internally
      const roomDrawings = await RoomDrawingService.listRoomDrawings(repositoryPath, roomId);

      setDrawings(roomDrawings);
    } catch (error) {
      console.error('Failed to load drawings:', error);
      setDrawings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDrawing = async (drawingId: string) => {
    const drawing = drawings.find(d => d.id === drawingId);
    if (confirm(`Remove drawing "${drawing?.name || drawingId}" from this room?`)) {
      try {
        // Use the new API to unlink drawing from room
        await RoomDrawingService.unlinkDrawingFromRoom(
          repositoryPath,
          roomId,
          drawingId
        );
        await loadDrawings();
      } catch (error) {
        console.error('Failed to remove drawing:', error);
      }
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: theme.colors.textSecondary,
        fontSize: theme.fontSizes[1],
      }}>
        Loading drawings...
      </div>
    );
  }

  if (drawings.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        fontSize: theme.fontSizes[1],
      }}>
        No drawings yet. Click "Add Drawing" to create one.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {drawings.map((drawing) => (
        <div
          key={drawing.id}
          onClick={() => onEditDrawing(drawing.id)}
          style={{
            padding: '12px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.border;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          }}
        >
          <FileImage size={20} style={{ color: theme.colors.primary }} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              color: theme.colors.text,
            }}>
              {drawing.name || 'Untitled Drawing'}
            </div>
            {drawing.modified && (
              <div style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}>
                Modified: {new Date(drawing.modified).toLocaleDateString()}
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering the parent onClick
              handleRemoveDrawing(drawing.id);
            }}
            style={{
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: theme.colors.error || theme.colors.textSecondary,
              zIndex: 1,
            }}
            title="Remove drawing"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};