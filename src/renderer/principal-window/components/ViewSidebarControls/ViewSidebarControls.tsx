import React from 'react';
import {
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';

interface ViewSidebarControlsProps {
  isCollapsed: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
  side?: 'left' | 'right';
  position?: 'left' | 'center' | 'right';
}

export const ViewSidebarControls: React.FC<ViewSidebarControlsProps> = ({
  isCollapsed,
  onToggle,
  style,
  side = 'left',
  // position prop is consumed by BaseTitlebar for layout placement.
  position: _position,
}) => {
  const { theme } = useTheme();
  void _position;

  const getIcon = () => {
    if (side === 'right') {
      return isCollapsed ? (
        <PanelRight size={18} />
      ) : (
        <PanelRightClose size={18} />
      );
    }
    return isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />;
  };

  const getTitle = () => {
    const action = isCollapsed ? 'Show' : 'Hide';
    const sideLabel = side === 'right' ? 'Right Panel' : 'Sidebar';
    return `${action} ${sideLabel} (Cmd/Ctrl+B)`;
  };

  return (
    <button
      onClick={onToggle}
      title={getTitle()}
      style={{
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
        background: 'transparent',
        border: 'none',
        color: isCollapsed ? theme.colors.textSecondary : theme.colors.primary,
        cursor: 'pointer',
        padding: '6px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        width: '32px',
        height: '32px',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
        e.currentTarget.style.color = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = isCollapsed
          ? theme.colors.textSecondary
          : theme.colors.primary;
      }}
    >
      {getIcon()}
    </button>
  );
};
