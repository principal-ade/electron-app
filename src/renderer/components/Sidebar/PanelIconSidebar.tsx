import React from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import {
  GitBranch,
  BookOpen,
  KanbanSquare,
  Network,
  Wand2,
  Bot,
  CheckCircle,
  Package,
  FolderOpen,
} from 'lucide-react';

/**
 * Panel icon sidebar props
 */
export interface PanelIconSidebarProps {
  /** ID of currently active left panel */
  currentPanelId: string;
  /** Callback when panel icon is clicked */
  onPanelChange: (panelId: string) => void;
  /** Theme for styling */
  theme: Theme;
  /** Whether left panel is collapsed */
  collapsed?: boolean;
  /** Callback to expand left panel if collapsed */
  onExpand?: () => void;
  /** Callback to collapse left panel */
  onCollapse?: () => void;
}

/**
 * Panel icon mapping - maps panel IDs to lucide-react icons and labels
 * Sorted alphabetically by label
 */
const PANEL_ICONS = [
  { id: 'agentsList', Icon: Bot, label: 'Agents' },
  { id: 'kanban', Icon: KanbanSquare, label: 'Backlog' },
  { id: 'docs', Icon: BookOpen, label: 'Docs' },
  { id: 'gitChanges', Icon: GitBranch, label: 'Files' },
  { id: 'codeQuality', Icon: CheckCircle, label: 'Quality' },
  { id: 'localProjects', Icon: FolderOpen, label: 'Repos' },
  { id: 'skillsList', Icon: Wand2, label: 'Skills' },
  { id: 'packageComposition', Icon: Package, label: 'Stack' },
  { id: 'canvasList', Icon: Network, label: 'Stories' },
] as const;

/**
 * PanelIconSidebar Component
 *
 * Vertical sidebar with icon buttons for each available panel type.
 * Clicking an icon switches the left panel to that panel type.
 */
export const PanelIconSidebar: React.FC<PanelIconSidebarProps> = ({
  currentPanelId,
  onPanelChange,
  theme,
  collapsed,
  onExpand,
  onCollapse,
}) => {
  const handlePanelClick = (panelId: string) => {
    // If clicking on the same panel that's already visible and panel is expanded, collapse it
    if (!collapsed && currentPanelId === panelId && onCollapse) {
      onCollapse();
    } else {
      // If panel is collapsed, expand it first
      if (collapsed && onExpand) {
        onExpand();
      }
      // Switch to the selected panel
      onPanelChange(panelId);
    }
  };

  return (
    <div
      style={{
        width: '80px',
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRight: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '12px',
        paddingBottom: '12px',
        gap: '0px',
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {PANEL_ICONS.map(({ id, Icon, label }) => {
        const isActive = currentPanelId === id;

        return (
          <button
            key={id}
            onClick={() => handlePanelClick(id)}
            title={label}
            aria-label={label}
            style={{
              width: 'calc(100% - 20px)',
              height: '64px',
              margin: '4px 10px',
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isActive
                ? theme.colors.primary
                : theme.colors.textSecondary,
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                background: isActive
                  ? `${theme.colors.primary}20`
                  : 'transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = theme.colors.border;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Icon size={20} strokeWidth={1.5} />
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: isActive ? '600' : '400',
                lineHeight: 1,
                textAlign: 'center',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
