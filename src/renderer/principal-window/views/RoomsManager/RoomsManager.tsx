import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { RefreshCw, Plus } from 'lucide-react';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/style.css';
import { usePanelsTheme } from '../../../theme/panelsTheme';
import type { PalaceRoom, AlexandriaEntry } from '@a24z/core-library';
import { PalaceRoomService } from '../../../main-process-api/PalaceRoomService';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { RoomListItem } from './components/RoomListItem';
import { RoomDetailsPanel } from './components/RoomDetailsPanel';
import { CreateRoomModal } from './components/CreateRoomModal';

export interface RoomInfo {
  room: PalaceRoom;
  repository: AlexandriaEntry;
}

interface RoomsManagerProps {
  sidebarCollapsed?: boolean;
}

export const RoomsManager: React.FC<RoomsManagerProps> = ({ sidebarCollapsed = false }) => {
  const { theme } = useTheme();
  const panelsTheme = usePanelsTheme();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);

  const loadRooms = useCallback(async () => {
    try {
      // Load all palace rooms from all repositories
      const roomsByRepo = await PalaceRoomService.listAllPalaceRooms();

      // Flatten into room info structures
      const allRooms: RoomInfo[] = [];
      roomsByRepo.forEach(({ repository, rooms }) => {
        rooms.forEach(room => {
          // Include all rooms (no default room filtering for now)
          allRooms.push({ room, repository });
        });
      });

      setRooms(allRooms);

      // Auto-select first room if none selected
      if (!selectedRoom && allRooms.length > 0) {
        setSelectedRoom(allRooms[0]);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setError('Failed to load rooms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRoom]);

  useEffect(() => {
    // Load repositories on mount
    const loadRepos = async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        setRepositories(repos);
      } catch (err) {
        console.error('Failed to load repositories:', err);
      }
    };

    loadRepos();
    loadRooms();
  }, [loadRooms]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRooms();
  };

  const handleRemoveRoom = async (room: RoomInfo) => {
    try {
      const success = await PalaceRoomService.deletePalaceRoom(
        room.repository.path,
        room.room.id
      );

      if (success) {
        // Reload rooms
        await loadRooms();

        // Clear selection if this was selected
        if (selectedRoom?.room.id === room.room.id) {
          setSelectedRoom(null);
        }
      }
    } catch (err) {
      console.error('Failed to remove room:', err);
    }
  };

  const handleCreateRoom = async (name: string, repository: AlexandriaEntry) => {
    try {
      // Create the palace room
      const newRoom = await PalaceRoomService.createPalaceRoom(repository.path, {
        name,
        description: `Room created in ${repository.name}`,
      });

      if (newRoom) {
        // Reload rooms
        await loadRooms();

        // Find and select the new room
        const allRooms = await PalaceRoomService.listAllPalaceRooms();
        const foundRoom = allRooms
          .flatMap(({ repository: repo, rooms }) =>
            rooms.map(room => ({ room, repository: repo }))
          )
          .find(
            w => w.room.id === newRoom.id && w.repository.path === repository.path
          );

        if (foundRoom) {
          setSelectedRoom(foundRoom);
        }
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      throw err;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // Render left panel - Room list sidebar
  const renderLeftPanel = () => {
    return (
      <div style={{
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
            margin: 0,
          }}>
            Rooms
          </h3>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '4px 8px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: theme.fontSizes[1],
              }}
              title="New Room"
            >
              <Plus size={14} />
              New
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                color: theme.colors.text,
                border: 'none',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                opacity: refreshing ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Refresh"
            >
              <RefreshCw size={16} style={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none'
              }} />
            </button>
          </div>
        </div>

        {/* Room List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
        }}>
          {loading ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}>
              Loading rooms...
            </div>
          ) : error ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.error,
              fontSize: theme.fontSizes[1],
            }}>
              {error}
            </div>
          ) : rooms.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}>
              No rooms created yet
              <div style={{
                marginTop: '8px',
                fontSize: theme.fontSizes[0],
              }}>
                Click "New" to create your first room
              </div>
            </div>
          ) : (
            <div>
              {rooms.map((room) => (
                <RoomListItem
                  key={`${room.repository.path}-${room.room.id}`}
                  room={room}
                  isSelected={
                    selectedRoom?.room.id === room.room.id &&
                    selectedRoom?.repository.path === room.repository.path
                  }
                  onSelect={() => setSelectedRoom(room)}
                  formatTime={formatTime}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add CSS animation for refresh spinner */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  };

  // Render right panel - Room details
  const renderRightPanel = () => {
    return (
      <RoomDetailsPanel
        room={selectedRoom}
        theme={theme}
        onRemoveRoom={handleRemoveRoom}
      />
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        repositories={repositories}
        onCreate={handleCreateRoom}
      />
      <AnimatedResizableLayout
        leftPanel={renderLeftPanel()}
        rightPanel={renderRightPanel()}
        minSize={15}
        defaultSize={25}
        collapsibleSide="left"
        collapsed={sidebarCollapsed}
        style={{ height: '100%', width: '100%' }}
        theme={panelsTheme}
      />
    </div>
  );
};