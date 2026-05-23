import React from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  KanbanSquare,
  Network,
  ToolCase,
  CheckCircle,
  Package,
  Activity,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Globe,
  Play,
  Terminal,
  Plug,
  Github,
  FolderTree,
  Route,
} from 'lucide-react';

/**
 * Panel icon configuration
 */
export interface PanelIconConfig {
  id: string;
  Icon: LucideIcon;
  label: string;
}

/**
 * Panel icon sidebar props
 */
export interface PanelIconSidebarProps {
  /** ID of currently active panel */
  currentPanelId: string;
  /** Callback when panel icon is clicked */
  onPanelChange: (panelId: string) => void;
  /** Callback when panel icon is right-clicked (open as floating overlay) */
  onPanelOverlay?: (panelId: string) => void;
  /** ID of currently overlaid panel (for active styling) */
  overlayPanelId?: string | null;
  /** Theme for styling */
  theme: Theme;
  /** Whether panel is collapsed */
  collapsed?: boolean;
  /** Callback to expand panel if collapsed */
  onExpand?: () => void;
  /** Callback to collapse panel */
  onCollapse?: () => void;
  /** Position of the sidebar (affects border placement) */
  position?: 'left' | 'right';
  /** Custom panel icons (defaults to LEFT_PANEL_ICONS) */
  panelIcons?: PanelIconConfig[];
  /** Show collapse button at the bottom of the sidebar */
  showCollapseButton?: boolean;
  /** Callback to open in Web-ADE (shown above collapse button) */
  onOpenInWebADE?: () => void;
  /** Callback to open GitHub Actions (shown above collapse button) */
  onOpenGitHubActions?: () => void;
  /** Callback to open GitHub repository (shown above collapse button) */
  onOpenGitHubRepo?: () => void;
  /** Custom buttons to render after panel icons */
  customButtons?: React.ReactNode;
}

/**
 * Default panel icons for left sidebar
 */
export const LEFT_PANEL_ICONS: PanelIconConfig[] = [
  { id: 'files', Icon: FolderTree, label: 'Files' },
  { id: 'terminalSessions', Icon: Terminal, label: 'Term' },
  { id: 'packageComposition', Icon: Package, label: 'Info' },
  { id: 'canvasList', Icon: Network, label: 'Stories' },
  { id: 'docs', Icon: BookOpen, label: 'Docs' },
  { id: 'agentsList', Icon: ToolCase, label: 'Skills' },
  { id: 'traceList', Icon: Activity, label: 'Traces' },
  { id: 'trails', Icon: Route, label: 'Trails' },
];

/**
 * Panel icons for right sidebar
 */
export const RIGHT_PANEL_ICONS: PanelIconConfig[] = [
  { id: 'fileCity', Icon: Building2, label: 'File City' },
  { id: 'codeQuality', Icon: CheckCircle, label: 'Quality' },
  { id: 'kanban', Icon: KanbanSquare, label: 'Backlog' },
  { id: 'bruno', Icon: Plug, label: 'Bruno' },
];

/**
 * PanelIconSidebar Component
 *
 * Vertical sidebar with icon buttons for each available panel type.
 * Clicking an icon switches the left panel to that panel type.
 */
export const PanelIconSidebar: React.FC<PanelIconSidebarProps> = ({
  currentPanelId,
  onPanelChange,
  onPanelOverlay,
  overlayPanelId,
  theme,
  collapsed,
  onExpand,
  onCollapse,
  position = 'left',
  panelIcons = LEFT_PANEL_ICONS,
  showCollapseButton = false,
  onOpenInWebADE,
  onOpenGitHubActions,
  onOpenGitHubRepo,
  customButtons,
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
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
      style={{
        width: '80px',
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
        borderLeft:
          position === 'right' ? `1px solid ${theme.colors.border}` : undefined,
        borderRight:
          position === 'left' ? `1px solid ${theme.colors.border}` : undefined,
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
      {panelIcons.map(({ id, Icon, label }) => {
        const isActive = currentPanelId === id;
        const isOverlayActive = overlayPanelId === id;
        // When the panel is collapsed, the icon shouldn't show the active
        // highlight — only the label stays colored to indicate the active slot.
        const iconActive = isActive && !collapsed;

        return (
          <button
            key={id}
            onClick={() => handlePanelClick(id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (onPanelOverlay) {
                onPanelOverlay(id);
              }
            }}
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
              color: iconActive
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
                background: iconActive
                  ? `${theme.colors.primary}20`
                  : 'transparent',
                outline: isOverlayActive
                  ? `1px dashed ${theme.colors.primary}`
                  : 'none',
                outlineOffset: '2px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!iconActive) {
                  e.currentTarget.style.background = theme.colors.border;
                }
              }}
              onMouseLeave={(e) => {
                if (!iconActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Icon size={20} strokeWidth={1.5} />
            </div>
            <span
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                fontWeight: isActive
                  ? theme.fontWeights.semibold
                  : theme.fontWeights.body,
                lineHeight: theme.lineHeights.tight,
                textAlign: 'center',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isActive
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}

      {/* Custom buttons (e.g., Storybook) */}
      {customButtons}

      {/* Spacer to push action buttons and collapse button to bottom */}
      {(showCollapseButton ||
        onOpenInWebADE ||
        onOpenGitHubActions ||
        onOpenGitHubRepo) && <div style={{ flex: 1 }} />}

      {/* Web-ADE button */}
      {onOpenInWebADE && (
        <button
          onClick={onOpenInWebADE}
          title="Open in Web-ADE"
          aria-label="Open in Web-ADE"
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
            color: theme.colors.textSecondary,
            transition: 'all 0.2s ease',
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
              background: 'transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Globe size={20} strokeWidth={1.5} />
          </div>
          <span
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              fontWeight: theme.fontWeights.body,
              lineHeight: theme.lineHeights.tight,
              textAlign: 'center',
            }}
          >
            Web
          </span>
        </button>
      )}

      {/* GitHub Actions button */}
      {onOpenGitHubActions && (
        <button
          onClick={onOpenGitHubActions}
          title="Open GitHub Actions"
          aria-label="Open GitHub Actions"
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
            color: theme.colors.textSecondary,
            transition: 'all 0.2s ease',
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
              background: 'transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Play size={20} strokeWidth={1.5} />
          </div>
          <span
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              fontWeight: theme.fontWeights.body,
              lineHeight: theme.lineHeights.tight,
              textAlign: 'center',
            }}
          >
            Actions
          </span>
        </button>
      )}

      {/* GitHub repository button */}
      {onOpenGitHubRepo && (
        <button
          onClick={onOpenGitHubRepo}
          title="Open GitHub Repository"
          aria-label="Open GitHub Repository"
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
            color: theme.colors.textSecondary,
            transition: 'all 0.2s ease',
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
              background: 'transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Github size={20} strokeWidth={1.5} />
          </div>
          <span
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              fontWeight: theme.fontWeights.body,
              lineHeight: theme.lineHeights.tight,
              textAlign: 'center',
            }}
          >
            GitHub
          </span>
        </button>
      )}

      {/* Collapse button at bottom */}
      {showCollapseButton && (onCollapse || onExpand) && (
        <button
          onClick={() => {
            if (collapsed && onExpand) {
              onExpand();
            } else if (!collapsed && onCollapse) {
              onCollapse();
            }
          }}
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          style={{
            width: 'calc(100% - 20px)',
            height: '48px',
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
            color: theme.colors.textSecondary,
            transition: 'all 0.2s ease',
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
              background: 'transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {position === 'right' ? (
              collapsed ? (
                <PanelRightOpen size={20} strokeWidth={1.5} />
              ) : (
                <PanelRightClose size={20} strokeWidth={1.5} />
              )
            ) : collapsed ? (
              <PanelLeftOpen size={20} strokeWidth={1.5} />
            ) : (
              <PanelLeftClose size={20} strokeWidth={1.5} />
            )}
          </div>
        </button>
      )}
    </div>
  );
};
