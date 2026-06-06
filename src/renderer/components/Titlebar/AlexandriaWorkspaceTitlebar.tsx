import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  PanelCollapseButton,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { Bot, FileText, FolderGit2, Plug, Route } from 'lucide-react';
import { WorkspaceInfoModal } from './WorkspaceInfoModal';
import {
  PanelSelectorDropdown,
  type PanelOption,
} from './PanelSelectorDropdown';
import { BriefAgentButton } from './BriefAgentButton';
import { ShareTopicButton } from './ShareTopicButton';
import { PANEL_FOCUS_SEARCH_EVENT } from '../Sidebar/PanelIconSidebar';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { UserPreferences } from '../../../shared/types/userPreferences.types';

// Available panels for Alexandria workspace
// Ordered to match dev workspace panel options
const AVAILABLE_PANELS: PanelOption[] = [
  { id: 'principal-view', label: 'Architecture' },
  { id: 'alexandria-docs', label: 'Documentation' },
  { id: 'file-city', label: 'File City' },
  { id: 'localhost-browser', label: 'Localhost Browser' },
];

/**
 * Left-panel segments. The "Hooks" entry is a developer tool and is gated
 * by the `alexandriaWorkspace.titlebar.hookDebug` user preference — the
 * full list lives here for layout/shortcut declarations and is filtered
 * at render time.
 */
const LEFT_PANEL_SEGMENTS = [
  { id: 'workspace-repos', label: 'Projects', Icon: FolderGit2, shortcut: 'j' },
  { id: 'trails', label: 'Trails', Icon: Route, shortcut: 'k' },
  { id: 'sessions', label: 'Sessions', Icon: Bot, shortcut: 'l' },
  { id: 'hook-debug', label: 'Hooks', Icon: Plug, shortcut: 'h' },
] as const;

type LeftPanelSegmentId = (typeof LEFT_PANEL_SEGMENTS)[number]['id'];

const ALWAYS_ON_SEGMENT_IDS = new Set<LeftPanelSegmentId>([
  'workspace-repos',
  'trails',
  'sessions',
]);

export interface AlexandriaWorkspaceTitlebarProps {
  workspace: Workspace;
  selectedRepository?: { name: string; path: string };
  // Panel controls
  collapsed?: { left: boolean; right: boolean };
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  // Layout controls
  layout?: PanelLayout;
  onLayoutChange?: (layout: PanelLayout) => void;
  // Topic-description slide-over (rendered over the left column by the layout)
  descriptionOpen?: boolean;
  onToggleDescription?: () => void;
  onCloseDescription?: () => void;
}

export const AlexandriaWorkspaceTitlebar: React.FC<
  AlexandriaWorkspaceTitlebarProps
> = ({
  workspace,
  selectedRepository,
  collapsed,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onCollapsedChange,
  layout,
  onLayoutChange,
  descriptionOpen,
  onToggleDescription,
  onCloseDescription,
}) => {
  const { theme } = useTheme();
  const [showInfoModal, setShowInfoModal] = useState(false);
  // True while Cmd (macOS) or Ctrl (Win/Linux) is held — reveals the
  // numeric shortcut badges on the left-panel segment buttons.
  const [modPressed, setModPressed] = useState(false);
  // Whether to render the "Hooks" segment. Gated by the
  // `alexandriaWorkspace.titlebar.hookDebug` user preference; false until
  // we've loaded prefs so a stale toggle doesn't flash on cold start.
  const [showHookDebug, setShowHookDebug] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const applyPrefs = (prefs: UserPreferences) => {
      if (!isMounted) return;
      setShowHookDebug(prefs.alexandriaWorkspace?.titlebar?.hookDebug ?? false);
    };
    UserPreferencesService.getPreferences().then(applyPrefs).catch(() => {});

    const onPrefsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UserPreferences>).detail;
      if (detail) applyPrefs(detail);
    };
    window.addEventListener('user-preferences-updated', onPrefsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('user-preferences-updated', onPrefsUpdated);
    };
  }, []);

  // Final list rendered in the segment switch and matched by the
  // keyboard-shortcut handler. The "Hooks" entry is conditional; the
  // others are always on.
  const visibleSegments = LEFT_PANEL_SEGMENTS.filter((seg) =>
    ALWAYS_ON_SEGMENT_IDS.has(seg.id) ? true : showHookDebug,
  );

  // Handler for changing the left panel
  const handleLeftPanelChange = (panelId: string) => {
    if (layout && onLayoutChange) {
      onLayoutChange({ ...layout, left: panelId });
    }
  };

  // Handler for changing the right panel
  const handleRightPanelChange = (panelId: string) => {
    if (layout && onLayoutChange) {
      onLayoutChange({ ...layout, right: panelId });
    }
  };

  // Handler to expand left panel if collapsed
  const handleExpandLeftPanel = () => {
    if (collapsed?.left && onCollapsedChange) {
      onCollapsedChange({ ...collapsed, left: false });
    }
  };

  // Handler to expand right panel if collapsed
  const handleExpandRightPanel = () => {
    if (collapsed?.right && onCollapsedChange) {
      onCollapsedChange({ ...collapsed, right: false });
    }
  };

  // Pump a left-panel activation through the same path mouse clicks take:
  // switch the layout, ensure the panel is expanded, and broadcast a focus
  // event. The dispatch is deferred two frames because the target panel
  // may be freshly mounting — its `useEffect` window listener doesn't
  // register until after React commits, so a synchronous dispatch would
  // arrive before anyone is listening.
  const activateLeftPanel = (panelId: string) => {
    handleLeftPanelChange(panelId);
    handleExpandLeftPanel();
    // The description slide-over covers the left column, so selecting a
    // panel while it's open would leave the chosen panel hidden behind it.
    // Dismiss it so the panel the user just picked is actually visible.
    if (descriptionOpen && onCloseDescription) {
      onCloseDescription();
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent(PANEL_FOCUS_SEARCH_EVENT, { detail: { panelId } }),
        );
      });
    });
  };

  // Keep latest activation closure available to the global key listener
  // without rebinding it on every render.
  const activateRef = useRef(activateLeftPanel);
  useEffect(() => {
    activateRef.current = activateLeftPanel;
  });

  // Mirror `showHookDebug` into a ref so the always-on keyboard handler
  // can gate Cmd+H without re-binding the listener.
  const showHookDebugRef = useRef(showHookDebug);
  useEffect(() => {
    showHookDebugRef.current = showHookDebug;
  });

  // ⌘D toggles the topic-description slide-over. Mirror the handler and the
  // "has a topic" gate into refs so the always-on key listener stays bound.
  const hasTopic = Boolean(workspace.topicIds?.[0]);
  const onToggleDescriptionRef = useRef(onToggleDescription);
  const hasTopicRef = useRef(hasTopic);
  useEffect(() => {
    onToggleDescriptionRef.current = onToggleDescription;
    hasTopicRef.current = hasTopic;
  });

  useEffect(() => {
    const isModKey = (e: KeyboardEvent) =>
      e.key === 'Meta' || e.key === 'Control';

    const onKeyDown = (e: KeyboardEvent) => {
      if (isModKey(e)) {
        setModPressed(true);
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      const target = LEFT_PANEL_SEGMENTS.find((s) => s.shortcut === key);
      if (target) {
        // Respect the same hookDebug gate the render path uses — pressing
        // ⌘H when the segment is hidden in settings must be a no-op.
        if (
          !ALWAYS_ON_SEGMENT_IDS.has(target.id) &&
          !showHookDebugRef.current
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        activateRef.current(target.id);
        return;
      }
      // ⌘D → toggle the topic-description slide-over (no-op without a topic).
      if (key === 'd') {
        if (!hasTopicRef.current || !onToggleDescriptionRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        onToggleDescriptionRef.current();
        return;
      }
      // Cmd+; → focus the visible xterm. TabbedTerminalPanel hides inactive
      // tabs with display:none, so the wrong textarea has offsetParent=null.
      if (key === ';') {
        const textareas = document.querySelectorAll<HTMLTextAreaElement>(
          '.xterm-helper-textarea',
        );
        for (const ta of Array.from(textareas)) {
          if (ta.offsetParent !== null) {
            e.preventDefault();
            e.stopPropagation();
            ta.focus();
            break;
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isModKey(e) || (!e.metaKey && !e.ctrlKey)) setModPressed(false);
    };
    const onBlur = () => setModPressed(false);

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return (
    <div
      style={{
        height: '56px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: theme.fonts.body,
        position: 'relative',
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'drag',
      }}
    >
      {/* Left section: traffic lights spacer + left panel dropdown */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginLeft: '16px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Traffic lights spacer on macOS */}
        <div style={{ width: '64px', flexShrink: 0 }} />

        {/* Left Collapse Button - outside the panel selector */}
        {onToggleLeftSidebar && (
          <PanelCollapseButton
            isCollapsed={collapsed?.left ?? false}
            onToggle={onToggleLeftSidebar}
            side="left"
            iconSize={16}
            style={{
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              padding: '6px 8px',
              minHeight: '34px',
              boxSizing: 'border-box',
            }}
          />
        )}

        {/* Left Panel Switch — Projects ↔ Trails */}
        {layout && onLayoutChange && typeof layout.left === 'string' && (
          <div
            style={{
              display: 'flex',
              padding: '2px',
              borderRadius: '6px',
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              // @ts-ignore - WebkitAppRegion is not in CSSProperties
              WebkitAppRegion: 'no-drag',
            }}
          >
            {visibleSegments.map(({ id, label, Icon, shortcut }, index) => {
              const isActive = layout.left === id;
              const shortcutLabel = shortcut.toUpperCase();
              // Decreasing z-index left→right so each segment's corner
              // badge (which overflows into the next sibling's area at
              // right: -6) stacks above the later segments. Without this,
              // an active right-side neighbor paints its solid background
              // over the earlier badge.
              const stackIndex = visibleSegments.length - index;
              return (
                <button
                  key={id}
                  onClick={() => activateLeftPanel(id)}
                  title={`${label} (⌘${shortcutLabel})`}
                  style={{
                    position: 'relative',
                    zIndex: stackIndex,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    border: 'none',
                    borderRadius: '4px',
                    background: isActive
                      ? theme.colors.background
                      : 'transparent',
                    color: isActive
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontWeight: isActive
                      ? theme.fontWeights.semibold
                      : theme.fontWeights.medium,
                    fontFamily: theme.fonts.body,
                    transition: 'all 0.15s',
                    boxShadow: isActive
                      ? theme.shadows[1]
                      : 'none',
                  }}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  <span>{label}</span>
                  {modPressed && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 8,
                        background: theme.colors.primary,
                        color: theme.colors.background,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[0],
                        fontWeight: theme.fontWeights.semibold,
                        lineHeight: '16px',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        boxShadow: `0 0 0 2px ${theme.colors.backgroundTertiary}`,
                      }}
                    >
                      {shortcutLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Topic Description — toggles the markdown slide-over over the left
            column. Only shown when the workspace has a topic to describe. */}
        {onToggleDescription && hasTopic && (
          <button
            onClick={onToggleDescription}
            title="Topic description (⌘D)"
            aria-label="Topic description"
            aria-pressed={descriptionOpen ?? false}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 10px',
              minHeight: '34px',
              boxSizing: 'border-box',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              background: descriptionOpen
                ? theme.colors.background
                : theme.colors.backgroundTertiary,
              color: descriptionOpen
                ? theme.colors.text
                : theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: descriptionOpen
                ? theme.fontWeights.semibold
                : theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              transition: 'all 0.15s',
            }}
          >
            <FileText size={16} strokeWidth={1.75} />
            <span>Notes</span>
            {modPressed && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 8,
                  background: theme.colors.primary,
                  color: theme.colors.background,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[0],
                  fontWeight: theme.fontWeights.semibold,
                  lineHeight: '16px',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  boxShadow: `0 0 0 2px ${theme.colors.backgroundTertiary}`,
                }}
              >
                D
              </span>
            )}
          </button>
        )}

        {/* Cmd-held hint: shortcut to focus the terminal. Appears inline
            next to the left-panel segment switch only while the modifier
            is held, matching the J/K/L badges above. */}
        {modPressed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.medium,
              pointerEvents: 'none',
            }}
          >
            <kbd
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 4,
                background: theme.colors.primary,
                color: theme.colors.background,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                fontWeight: theme.fontWeights.semibold,
                lineHeight: 1,
              }}
            >
              ;
            </kbd>
            <span>Terminal</span>
          </div>
        )}

      </div>

      {/* Center: Workspace name and selected repository — click to open
          the workspace-info modal (workspace details + theme picker). */}
      <button
        type="button"
        onClick={() => setShowInfoModal(true)}
        title="Workspace info & theme"
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: 'transparent',
          border: 'none',
          borderRadius: '6px',
          padding: '4px 10px',
          cursor: 'pointer',
          color: 'inherit',
          fontFamily: theme.fonts.body,
          transition: 'background-color 0.15s',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundTertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Workspace name */}
        <span
          style={{
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
          }}
        >
          {workspace.name}
        </span>

        {/* Selected repository or description */}
        {selectedRepository ? (
          <span
            style={{
              fontSize: `${theme.fontSizes[0]}px`,
              color: theme.colors.accent,
              fontFamily: theme.fonts.body,
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={selectedRepository.path}
          >
            {selectedRepository.name}
          </span>
        ) : workspace.description ? (
          <span
            style={{
              fontSize: `${theme.fontSizes[0]}px`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {workspace.description}
          </span>
        ) : null}
      </button>

      {/* Right: Actions will go here */}
      <div
        style={{
          marginLeft: 'auto',
          marginRight: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Brief Agent — always visible. Draggable; drop on a terminal to
            link its Claude session to the current topic. */}
        <BriefAgentButton topicId={workspace.topicIds?.[0]} />

        {/* Share Topic — publish this workspace's topic to web-ade (or copy
            its link once shared). */}
        <ShareTopicButton topicId={workspace.topicIds?.[0]} />

        {/* Right Panel Selector */}
        {layout && onLayoutChange && typeof layout.right === 'string' && (
          <PanelSelectorDropdown
            side="right"
            currentPanelId={layout.right}
            availablePanels={AVAILABLE_PANELS}
            onPanelChange={handleRightPanelChange}
            onExpand={handleExpandRightPanel}
          />
        )}

        {/* Right Collapse Button - outside the panel selector */}
        {onToggleRightSidebar && (
          <PanelCollapseButton
            isCollapsed={collapsed?.right ?? false}
            onToggle={onToggleRightSidebar}
            side="right"
            iconSize={16}
            style={{
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              padding: '6px 8px',
              minHeight: '34px',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      <WorkspaceInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        workspace={workspace}
      />
    </div>
  );
};
