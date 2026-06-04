import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  TerminalSession,
  getTerminalDirectory,
} from '@industry-theme/xterm-terminal-panel';
import type {
  TerminalPanelActions,
  TerminalPanelProps,
} from '@industry-theme/xterm-terminal-panel';
import {
  ChevronDown,
  ChevronUp,
  Contrast,
  Maximize2,
  Minimize2,
  TerminalSquare,
} from 'lucide-react';
import { ShellService } from '../../main-process-api/ShellService';

export interface FloatingTerminalOverlayProps {
  context: TerminalPanelProps['context'];
  actions: TerminalPanelActions;
  /** rgba background tint applied to the terminal surface. */
  backgroundColor?: string;
  /** Initial collapsed state. */
  defaultCollapsed?: boolean;
}

const COLLAPSED_HEIGHT = 36;
const EXPANDED_HEIGHT = 320;
const PANEL_WIDTH = 520;
const MIN_WIDTH = 320;
const MIN_EXPANDED_HEIGHT = 160;

// Tag for the overlay's PTY session. Anything not starting with the docked
// TabbedTerminalPanel's terminalContext (e.g. "terminal:default") is treated
// as foreign by its session filter, which keeps the docked panel from
// auto-creating a tab for our session.
const OVERLAY_SESSION_CONTEXT = 'overlay:file-city';

export const FloatingTerminalOverlay: React.FC<FloatingTerminalOverlayProps> = ({
  context,
  actions,
  backgroundColor = 'rgba(20, 20, 20, 0.55)',
  defaultCollapsed = true,
}) => {
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [opaque, setOpaque] = React.useState(true);
  const [size, setSize] = React.useState({
    width: PANEL_WIDTH,
    height: EXPANDED_HEIGHT,
  });
  const [isResizing, setIsResizing] = React.useState(false);
  const [maximized, setMaximized] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const handleResizeMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // When maximized, capture the current rendered size and exit maximized
      // so the bottom-right-anchored drag math stays consistent.
      const rect = containerRef.current?.getBoundingClientRect();
      const startWidth = maximized && rect ? rect.width : size.width;
      const startHeight = maximized && rect ? rect.height : size.height;
      if (maximized) {
        setMaximized(false);
        setSize({ width: startWidth, height: startHeight });
      }
      const startX = e.clientX;
      const startY = e.clientY;
      setIsResizing(true);

      const onMove = (ev: MouseEvent) => {
        // Anchored to bottom-right, so dragging up-and-left grows the panel.
        const nextWidth = Math.max(
          MIN_WIDTH,
          startWidth + (startX - ev.clientX),
        );
        const nextHeight = Math.max(
          MIN_EXPANDED_HEIGHT,
          startHeight + (startY - ev.clientY),
        );
        setSize({ width: nextWidth, height: nextHeight });
      };
      const onUp = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [size.width, size.height, maximized],
  );
  // Lazy-mount: don't spawn a PTY until the user expands the panel for the
  // first time. Once mounted, the panel stays mounted so subsequent
  // collapse/expand preserves the shell + scrollback.
  const [hasOpened, setHasOpened] = React.useState(!defaultCollapsed);

  // TerminalSession takes an explicit cwd; mirror what TerminalPanel used to
  // resolve internally by reading the repository/workspace path from the
  // panel-framework context.
  const cwd = getTerminalDirectory(context, 'repository') ?? undefined;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        ...(maximized && !collapsed
          ? { top: 16, left: 16, width: 'auto', height: 'auto' }
          : {
              width: size.width,
              height: collapsed ? COLLAPSED_HEIGHT : size.height,
            }),
        background: opaque ? theme.colors.background : backgroundColor,
        backdropFilter: opaque ? 'none' : 'blur(10px)',
        WebkitBackdropFilter: opaque ? 'none' : 'blur(10px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 3000,
        transition: isResizing ? 'none' : 'height 160ms ease',
      }}
    >
      {!collapsed && (
        <div
          onMouseDown={handleResizeMouseDown}
          title="Drag to resize"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 14,
            height: 14,
            cursor: 'nwse-resize',
            zIndex: 1,
            // Subtle corner mark so the user can find the handle.
            background:
              'linear-gradient(135deg, transparent 0 6px, ' +
              theme.colors.textSecondary +
              ' 6px 7px, transparent 7px 100%)',
            opacity: 0.6,
          }}
        />
      )}
      <div
        onClick={() => {
          setCollapsed((prev) => {
            const next = !prev;
            if (!next) setHasOpened(true);
            return next;
          });
        }}
        style={{
          height: COLLAPSED_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          cursor: 'pointer',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: 12,
          userSelect: 'none',
          borderBottom: collapsed
            ? 'none'
            : `1px solid ${theme.colors.border}`,
          background: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TerminalSquare size={14} color={theme.colors.textSecondary} />
          <span>Terminal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpaque((prev) => !prev);
            }}
            title={opaque ? 'Make translucent' : 'Make opaque'}
            aria-label={opaque ? 'Make translucent' : 'Make opaque'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              padding: 0,
              border: 'none',
              borderRadius: 4,
              background: opaque ? theme.colors.border : 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            <Contrast size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMaximized((prev) => {
                const next = !prev;
                // Maximizing while collapsed should also expand.
                if (next && collapsed) {
                  setCollapsed(false);
                  setHasOpened(true);
                }
                return next;
              });
            }}
            title={maximized ? 'Restore' : 'Fill view'}
            aria-label={maximized ? 'Restore' : 'Fill view'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              padding: 0,
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/*
        Lazy-mount on first open, then keep mounted so collapse/expand
        doesn't unmount and tear down the PTY. While collapsed we keep the
        wrapper at its expanded dimensions and rely on the outer container's
        height clamp + overflow:hidden to clip it; using display:none here
        would let xterm's FitAddon observe a 0×0 box and cache cols=rows=0,
        producing a broken layout on re-expand.
      */}
      {hasOpened && (
        <div
          style={
            collapsed
              ? {
                  position: 'absolute',
                  top: COLLAPSED_HEIGHT,
                  left: 0,
                  width: size.width,
                  height: Math.max(
                    MIN_EXPANDED_HEIGHT,
                    size.height - COLLAPSED_HEIGHT,
                  ),
                  visibility: 'hidden',
                  pointerEvents: 'none',
                }
              : {
                  flex: 1,
                  minHeight: 0,
                }
          }
        >
          <TerminalSession
            actions={actions}
            sessionContext={OVERLAY_SESSION_CONTEXT}
            cwd={cwd}
            transparent
            backgroundColor="rgba(0, 0, 0, 0)"
            // No panel event bus here — open clicked links directly.
            onLinkClick={(url) => void ShellService.openExternal(url)}
          />
        </div>
      )}
    </div>
  );
};
