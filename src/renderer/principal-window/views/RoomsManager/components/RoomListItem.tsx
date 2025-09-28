import React from 'react';
import { Folder, FolderOpen, X, GitBranch } from 'lucide-react';
import type { RoomInfo } from '../RoomsManager';
import type { Theme } from 'themed-markdown';

interface RoomListItemProps {
  room: RoomInfo;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  formatTime: (timestamp: number) => string;
  theme: Theme;
}

export const RoomListItem: React.FC<RoomListItemProps> = ({
  room,
  isSelected,
  onSelect,
  onRemove,
  formatTime,
  theme,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const roomName = room.room.name.length > 25
    ? room.room.name.substring(0, 22) + '...'
    : room.room.name;

  const directoryPath = room.repository.path.length > 35
    ? '...' + room.repository.path.substring(room.repository.path.length - 32)
    : room.repository.path;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '12px 16px',
        backgroundColor: isSelected
          ? theme.colors.accent + '15'
          : isHovered
            ? theme.colors.backgroundSecondary + '50'
            : 'transparent',
        borderBottom: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Icon */}
        <div style={{
          marginTop: '2px',
          color: isSelected ? theme.colors.accent : theme.colors.textSecondary,
        }}>
          {isSelected ? <FolderOpen size={18} /> : <Folder size={18} />}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name and Files Count */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}>
            <span style={{
              fontSize: theme.fontSizes[1],
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? theme.colors.accent : theme.colors.text,
            }}>
              {roomName}
            </span>
            <span style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.background,
              padding: '1px 6px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <GitBranch size={10} />
              {room.repository.name}
            </span>
          </div>

          {/* Directory Path */}
          <div style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.monospace,
            marginBottom: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {directoryPath}
          </div>

          {/* Creation Time and Description */}
          <div style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span>Created {formatTime(new Date(room.room.createdAt).getTime())}</span>
          </div>

          {/* Portal count if any */}
          {room.room.portals && room.room.portals.length > 0 && (
            <div style={{
              marginTop: '6px',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
            }}>
              <span
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.primary,
                  backgroundColor: theme.colors.primary + '10',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                {room.room.portals.length} portal{room.room.portals.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Remove Button */}
        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.error + '20';
              e.currentTarget.style.color = theme.colors.error;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
            title="Remove room"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '3px',
          height: '60%',
          backgroundColor: theme.colors.accent,
          borderRadius: '0 3px 3px 0',
        }} />
      )}
    </div>
  );
};