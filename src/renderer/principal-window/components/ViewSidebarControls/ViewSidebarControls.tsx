import React from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface ViewSidebarControlsProps {
  isCollapsed: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
}

export const ViewSidebarControls: React.FC<ViewSidebarControlsProps> = ({
  isCollapsed,
  onToggle,
  style,
}) => {
  const { theme } = useTheme();

  return (
    <button
      onClick={onToggle}
      title={isCollapsed ? 'Show Sidebar (Cmd/Ctrl+B)' : 'Hide Sidebar (Cmd/Ctrl+B)'}
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
        e.currentTarget.style.color = isCollapsed ? theme.colors.textSecondary : theme.colors.primary;
      }}
    >
      {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
    </button>
  );
};