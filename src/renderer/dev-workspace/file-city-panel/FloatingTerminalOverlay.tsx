import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { TerminalPanel } from '@industry-theme/xterm-terminal-panel';
import type {
  TerminalPanelActions,
  TerminalPanelProps,
} from '@industry-theme/xterm-terminal-panel';
import { ChevronDown, ChevronUp, TerminalSquare } from 'lucide-react';

export interface FloatingTerminalOverlayProps {
  context: TerminalPanelProps['context'];
  actions: TerminalPanelActions;
  events: TerminalPanelProps['events'];
  /** rgba background tint applied to the terminal surface. */
  backgroundColor?: string;
  /** Initial collapsed state. */
  defaultCollapsed?: boolean;
}

const COLLAPSED_HEIGHT = 36;
const EXPANDED_HEIGHT = 320;
const PANEL_WIDTH = 520;

// Tag for the overlay's PTY session. Anything not starting with the docked
// TabbedTerminalPanel's terminalContext (e.g. "terminal:default") is treated
// as foreign by its session filter, which keeps the docked panel from
// auto-creating a tab for our session.
const OVERLAY_SESSION_CONTEXT = 'overlay:file-city';

export const FloatingTerminalOverlay: React.FC<FloatingTerminalOverlayProps> = ({
  context,
  actions,
  events,
  backgroundColor = 'rgba(20, 20, 20, 0.55)',
  defaultCollapsed = true,
}) => {
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  // Lazy-mount: don't spawn a PTY until the user expands the panel for the
  // first time. Once mounted, the panel stays mounted so subsequent
  // collapse/expand preserves the shell + scrollback.
  const [hasOpened, setHasOpened] = React.useState(!defaultCollapsed);

  // Inject the overlay-specific session context on session creation.
  const overlayActions = React.useMemo<typeof actions>(() => {
    if (!actions.createTerminalSession) return actions;
    const orig = actions.createTerminalSession;
    return {
      ...actions,
      createTerminalSession: (opts) =>
        orig({ ...opts, context: OVERLAY_SESSION_CONTEXT }),
    };
  }, [actions]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: PANEL_WIDTH,
        height: collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
        background: backgroundColor,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 20,
        transition: 'height 160ms ease',
      }}
    >
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
        {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {/*
        Lazy-mount on first open, then keep mounted so collapse/expand
        doesn't unmount and tear down the PTY. When collapsed, we just hide
        the container — the session keeps running underneath.
      */}
      {hasOpened && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: collapsed ? 'none' : 'block',
          }}
        >
          <TerminalPanel
            context={context}
            actions={overlayActions}
            events={events}
            allowTransparency
            backgroundColor="rgba(0, 0, 0, 0)"
          />
        </div>
      )}
    </div>
  );
};
