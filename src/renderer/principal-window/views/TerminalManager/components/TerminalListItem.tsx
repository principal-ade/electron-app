import React from 'react';
import { Terminal, Folder, X, Circle, Cpu } from 'lucide-react';
import type { Theme } from '@a24z/industry-theme';
import { TerminalInfo } from '../../../../../shared/main-process-api-interfaces/TerminalService';

interface TerminalListItemProps {
  terminal: TerminalInfo;
  sessionNumber: number;
  isSelected: boolean;
  hasWindow: boolean;
  onSelect: () => void;
  onClose: () => void;
  formatTime: (timestamp: number) => string;
  theme: Theme;
}

export const TerminalListItem: React.FC<TerminalListItemProps> = ({
  terminal,
  sessionNumber,
  isSelected,
  hasWindow,
  onSelect,
  onClose,
  formatTime,
  theme,
}) => {
  const getDirectoryName = (path: string) => {
    const parts = path.split('/');
    const dirName =
      parts[parts.length - 1] || parts[parts.length - 2] || 'Unknown';
    // For home directory, return a more friendly name
    if (
      path === process.env.HOME ||
      path === process.env.USERPROFILE ||
      dirName === ''
    ) {
      return 'Home';
    }
    return dirName;
  };

  const getParentPath = (path: string) => {
    const parts = path.split('/');
    if (parts.length <= 1) return '';
    const parent = parts.slice(-3, -1).join('/');
    return parent.length > 30 ? '...' + parent.slice(-27) : parent;
  };

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px 16px',
        backgroundColor: isSelected ? theme.colors.background : 'transparent',
        borderBottom: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor =
            theme.colors.background + '50';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: '3px',
            height: '70%',
            backgroundColor: theme.colors.primary,
            borderRadius: '0 3px 3px 0',
          }}
        />
      )}

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
        {/* Icon */}
        <div
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: isSelected
              ? theme.colors.primary + '20'
              : theme.colors.backgroundTertiary,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Terminal
            size={16}
            style={{
              color: isSelected
                ? theme.colors.primary
                : theme.colors.textSecondary,
            }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Directory name */}
          <div
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: isSelected ? 600 : 500,
              color: theme.colors.text,
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {getDirectoryName(terminal.directory)}
            {sessionNumber > 0 && (
              <span
                style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  color: theme.colors.textSecondary,
                  padding: '1px 4px',
                  borderRadius: '4px',
                  fontSize: theme.fontSizes[0],
                  fontWeight: 500,
                }}
              >
                #{sessionNumber}
              </span>
            )}
            {hasWindow && (
              <Circle
                size={6}
                style={{
                  fill: theme.colors.success,
                  color: theme.colors.success,
                }}
              />
            )}
            {terminal.agentSessionId && (
              <Cpu
                size={12}
                style={{
                  color: theme.colors.primary,
                  opacity: 0.7,
                }}
              />
            )}
          </div>

          {/* Path */}
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Folder size={10} />
            {getParentPath(terminal.directory) || '/'}
          </div>

          {/* Time */}
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textTertiary,
              marginTop: '4px',
            }}
          >
            {formatTime(terminal.createdAt)}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
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
            opacity: 0.6,
            transition: 'opacity 0.2s, background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.backgroundColor = theme.colors.error + '20';
            e.currentTarget.style.color = theme.colors.error;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.6';
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
          title="Close terminal"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
