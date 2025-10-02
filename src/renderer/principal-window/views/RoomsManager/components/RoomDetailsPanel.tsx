import React, { useState, useEffect } from 'react';
import {
  Link2,
  Edit2,
  Check,
  X,
  Copy
} from 'lucide-react';
import type { RoomInfo } from '../RoomsManager';
import type { Theme } from '@a24z/industry-theme';
import type { PalacePortal, AlexandriaEntry, ExcalidrawData } from '@a24z/core-library';
import { PalaceRoomService } from '../../../../main-process-api/PalaceRoomService';
import { AlexandriaService } from '../../../../main-process-api/AlexandriaService';
import { AddPortalModal } from './AddPortalModal';
import { DrawingsList } from './DrawingsList';
import { ExcalidrawWrapper } from '../../../../components/shared/ExcalidrawWrapper';
import { RoomDrawingService } from '../../../../main-process-api/RoomDrawingService';

// View mode enum
enum RoomView {
  DETAILS = 'details',
  DRAWING = 'drawing'
}

interface RoomDetailsPanelProps {
  room: RoomInfo | null;
  theme: Theme;
  onRemoveRoom?: (room: RoomInfo) => void;
}


export const RoomDetailsPanel: React.FC<RoomDetailsPanelProps> = ({
  room,
  theme,
  onRemoveRoom,
}) => {
  // Disk space feature removed - getDiskUsage method not available in FileSystemService
  const [portals, setPortals] = useState<PalacePortal[]>([]);
  const [isLoadingPortals, setIsLoadingPortals] = useState(false);
  const [showAddPortalModal, setShowAddPortalModal] = useState(false);
  const [availableRepositories, setAvailableRepositories] = useState<AlexandriaEntry[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Drawing editor state
  const [viewMode, setViewMode] = useState<RoomView>(RoomView.DETAILS);
  const [editingDrawing, setEditingDrawing] = useState<string | null>(null);
  const [editingDrawingName, setEditingDrawingName] = useState('');
  const [initialDrawingData, setInitialDrawingData] = useState<ExcalidrawData | null>(null);
  const [drawingsKey, setDrawingsKey] = useState(0); // For refreshing drawings list
  const excalidrawSaveRef = React.useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (room) {
      loadPortals();
      loadAvailableRepositories();
      setEditedName(room.room.name || '');
      setEditedDescription(room.room.description || '');
      setIsEditMode(false);
    }
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: loadAvailableRepositories, loadPortals are not memoized

  const loadPortals = async () => {
    if (!room) return;

    setIsLoadingPortals(true);
    try {
      const roomPortals = await PalaceRoomService.listPortalsInRoom(
        room.repository.path,
        room.room.id
      );
      setPortals(roomPortals || []);
    } catch (err) {
      console.error('Failed to load portals:', err);
      setPortals([]);
    } finally {
      setIsLoadingPortals(false);
    }
  };




  const loadAvailableRepositories = async () => {
    if (!room) return;

    try {
      const allRepos = await AlexandriaService.getRepositories();
      // Filter out the current repository to avoid self-referencing portals
      const available = allRepos.filter(repo => repo.path !== room.repository.path);
      setAvailableRepositories(available);
    } catch (err) {
      console.error('Failed to load available repositories:', err);
      setAvailableRepositories([]);
    }
  };

  const handleSaveEdit = async () => {
    if (!room || !editedName.trim()) return;

    setIsSaving(true);
    try {
      const updated = await PalaceRoomService.updatePalaceRoom(
        room.repository.path,
        room.room.id,
        {
          name: editedName.trim(),
          description: editedDescription.trim() || undefined,
        }
      );

      if (updated) {
        // Update the room info locally
        room.room.name = updated.name;
        room.room.description = updated.description;
        setIsEditMode(false);
      }
    } catch (err) {
      console.error('Failed to update room:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!room) return;
    setEditedName(room.room.name || '');
    setEditedDescription(room.room.description || '');
    setIsEditMode(false);
  };

  const handleAddPortal = async (targetRepo: AlexandriaEntry, portalName: string, description?: string) => {
    if (!room) return;

    try {
      const portal = await PalaceRoomService.addPortalToRoom(
        room.repository.path,
        room.room.id,
        targetRepo.path,
        portalName,
        description
      );

      if (portal) {
        // Reload portals to show the new one
        await loadPortals();
      }
    } catch (err) {
      console.error('Failed to create portal:', err);
      throw err;
    }
  };

  // Drawing handlers
  const handleNewDrawing = () => {
    // Create a user-friendly default name for new drawings
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const drawingName = `Untitled - ${dateStr} ${timeStr}`;
    setEditingDrawing(null);
    setEditingDrawingName(drawingName);
    setInitialDrawingData(null);
    setViewMode(RoomView.DRAWING);
  };

  const handleEditDrawing = async (drawingId: string) => {
    if (!room) return;

    try {
      // Load drawing using room-aware service
      const diagramData = await RoomDrawingService.loadRoomDrawing(
        room.repository.path,
        room.room.id,
        drawingId
      );

      if (diagramData) {
        setInitialDrawingData(diagramData);
        setEditingDrawing(drawingId);
        // Use the name from appState if available, otherwise fallback to drawingId
        const displayName = diagramData.appState?.name || drawingId.replace('.excalidraw', '');
        setEditingDrawingName(displayName);
        setViewMode(RoomView.DRAWING);
      } else {
        console.error('Drawing not found for room:', drawingId);
      }
    } catch (error) {
      console.error('Failed to load drawing:', error);
    }
  };

  // ExcalidrawWrapper now handles saving with room association
  const handleDrawingSaved = async (_diagramId: string) => {
    if (!room) return;

    // Just refresh the drawings list since the save is handled by RoomDrawingService
    setDrawingsKey(prev => prev + 1);
  };

  const handleBackToRoom = () => {
    // Auto-save handles saving on changes, no need to explicitly save here
    // Refresh drawings list when returning to room view
    setDrawingsKey(prev => prev + 1);

    setViewMode(RoomView.DETAILS);
    setEditingDrawing(null);
    setEditingDrawingName('');
    setInitialDrawingData(null);
  };

  const handleCopyDrawingPath = async () => {
    if (!room || !editingDrawing) return;

    // Construct the full path to the drawing file
    const drawingFileName = editingDrawing.endsWith('.excalidraw')
      ? editingDrawing
      : `${editingDrawing}.excalidraw`;
    const fullPath = `${room.repository.path}/.alexandria/drawings/${drawingFileName}`;

    try {
      await navigator.clipboard.writeText(fullPath);
      // TODO: Add a toast notification for success
    } catch (error) {
      console.error('Failed to copy path to clipboard:', error);
    }
  };

  // Render drawing editor view
  if (viewMode === RoomView.DRAWING) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Drawing Editor Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: theme.colors.backgroundSecondary,
        }}>
          <div style={{ flex: 1 }}>
            <h3 style={{
              margin: 0,
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              color: theme.colors.text,
            }}>
              {room?.room.name || ''} - {editingDrawingName}
            </h3>
          </div>

          <button
            onClick={handleCopyDrawingPath}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
            }}
            title="Copy drawing file path to clipboard"
          >
            <Copy size={16} />
            Copy Path
          </button>

          <button
            onClick={handleBackToRoom}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
            }}
          >
            <X size={16} />
            Close
          </button>
        </div>

        {/* Excalidraw Editor */}
        <div style={{ flex: 1 }}>
          <ExcalidrawWrapper
            initialData={initialDrawingData}
            diagramId={editingDrawing || undefined}
            diagramName={editingDrawingName}
            projectPath={room?.repository.path || ''}
            roomId={room?.room.id}
            showSaveButton={true}
            showNewDiagramButton={false}
            showNameEditor={true}
            useAlexandriaStorage={true}
            onSave={handleDrawingSaved}
            saveRef={excalidrawSaveRef}
          />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        color: theme.colors.textSecondary,
      }}>
        <div style={{ fontSize: theme.fontSizes[2], marginBottom: '8px' }}>
          No room selected
        </div>
        <div style={{ fontSize: theme.fontSizes[1] }}>
          Select a room from the list or create a new one
        </div>
      </div>
    );
  }

  return (
    <>
      <AddPortalModal
        isOpen={showAddPortalModal}
        onClose={() => setShowAddPortalModal(false)}
        availableRepositories={availableRepositories}
        onAddPortal={handleAddPortal}
      />

      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {isEditMode ? (
              <>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Room name"
                  style={{
                    fontSize: theme.fontSizes[3],
                    fontWeight: 600,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    padding: '4px 8px',
                    width: '100%',
                    marginBottom: '8px',
                    outline: 'none',
                  }}
                  autoFocus
                />

                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Room description (optional)"
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.text,
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    padding: '6px 8px',
                    width: '100%',
                    marginBottom: '8px',
                    minHeight: '60px',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: theme.fonts.body,
                  }}
                />
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                  <h2 style={{
                    fontSize: theme.fontSizes[3],
                    fontWeight: 600,
                    color: theme.colors.text,
                    margin: 0,
                  }}>
                    {room.room.name}
                  </h2>

                  <button
                    onClick={() => setIsEditMode(true)}
                    style={{
                      padding: '4px',
                      backgroundColor: 'transparent',
                      color: theme.colors.textSecondary,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Edit room details"
                  >
                    <Edit2 size={16} />
                  </button>

                  {/* Remove Room Button */}
                  {onRemoveRoom && (
                    <button
                      onClick={() => onRemoveRoom(room)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        color: theme.colors.error,
                        border: `1px solid ${theme.colors.error}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: theme.fontSizes[1],
                        marginLeft: 'auto',
                      }}
                      title="Remove Room"
                    >
                      <X size={14} />
                      Remove
                    </button>
                  )}
                </div>

                {room.room.description && (
                  <div style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    marginBottom: '8px',
                  }}>
                    {room.room.description}
                  </div>
                )}
              </>
            )}


            {/* Edit Mode Buttons */}
            {isEditMode && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editedName.trim()}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: theme.colors.success || theme.colors.primary,
                    color: theme.colors.background,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isSaving || !editedName.trim() ? 'not-allowed' : 'pointer',
                    opacity: isSaving || !editedName.trim() ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: theme.fontSizes[1],
                  }}
                >
                  <Check size={14} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>

                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: theme.fontSizes[1],
                  }}
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

      </div>


      {/* Drawings and Portals Sections */}
      {room && (
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        }}>
          {/* Drawings Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}>
            <h3 style={{
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}>
              Drawings
            </h3>
            <button
              onClick={handleNewDrawing}
              style={{
                padding: '4px 8px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: theme.fontSizes[1],
              }}
              title="Add Drawing"
            >
              +
            </button>
          </div>

          <DrawingsList
            key={drawingsKey}
            roomId={room.room.id}
            repositoryPath={room.repository.path}
            theme={theme}
            onEditDrawing={handleEditDrawing}
          />

          {/* Portals Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '24px',
            marginBottom: '12px',
          }}>
            <h3 style={{
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}>
              Portals to Other Repositories
            </h3>
            <button
              onClick={() => setShowAddPortalModal(true)}
              style={{
                padding: '4px 8px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: theme.fontSizes[1],
              }}
              title="Add Portal"
            >
              +
            </button>
          </div>

          {isLoadingPortals ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}>
              Loading portals...
            </div>
          ) : portals.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
            }}>
              No portals configured. Add a portal to connect to other repositories.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '8px',
            }}>
              {portals.map((portal) => (
                <div
                  key={portal.id}
                  style={{
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <Link2 size={20} style={{ color: theme.colors.primary }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: theme.fontSizes[1],
                      fontWeight: 500,
                      color: theme.colors.text,
                      marginBottom: '2px',
                    }}>
                      {portal.name}
                    </div>
                    <div style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.monospace,
                    }}>
                      {portal.target.path}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
};