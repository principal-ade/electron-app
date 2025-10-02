import React from 'react';
import { GitBranch } from 'lucide-react';
import type { RoomInfo } from '../RoomsManager';
import type { Theme } from '@a24z/industry-theme';

interface RoomListItemProps {
  room: RoomInfo;
  isSelected: boolean;
  onSelect: () => void;
  formatTime: (timestamp: number) => string;
  theme: Theme;
}

export const RoomListItem: React.FC<RoomListItemProps> = ({
  room,
  isSelected,
  onSelect,
  formatTime,
  theme,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

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
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', width: '100%' }}>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: '80px' }}>
          {/* Name */}
          <div style={{
            fontSize: theme.fontSizes[1],
            fontWeight: isSelected ? 600 : 500,
            color: isSelected ? theme.colors.accent : theme.colors.text,
            marginBottom: '4px',
          }}>
            {room.room.name}
          </div>

          {/* Project Name */}
          <div style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            marginBottom: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <GitBranch size={10} />
            {room.repository.name}
          </div>


        </div>

        {/* Time in top right */}
        <div style={{
          position: 'absolute',
          top: '0',
          right: '0',
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
        }}>
          {formatTime(new Date(room.room.createdAt).getTime())}
        </div>
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