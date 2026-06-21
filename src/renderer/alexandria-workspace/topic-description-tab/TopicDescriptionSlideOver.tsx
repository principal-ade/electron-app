/**
 * Left-column slide-over that renders the current topic's description as
 * markdown. It's anchored inside the left panel column — toggled from the
 * titlebar's Description button — and slides in over whichever left segment
 * (Projects/Trails/Sessions) is active.
 *
 * The markdown rendering + inline-edit behavior lives in the shared
 * `TopicDescriptionBody`; this component only adds the slide-over chrome
 * (absolute-positioned panel, "Braindump" header, and the Edit button). Full
 * editing happens in the dedicated MDXEditor tab: the header "Edit" button calls
 * `onEdit`, which opens that tab (the slide-over stays open and live-refreshes).
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Brain, List, Pencil } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from './TopicDescriptionBody';

export interface TopicDescriptionSlideOverProps {
  open: boolean;
  /**
   * When true, the panel appears with no slide-in transition — used when the
   * notes are opened by default on window launch, so they're simply present
   * rather than animating in. Normal toggles leave this false and animate.
   */
  instant?: boolean;
  /** Topic whose description is shown. The slide-over no-ops without one. */
  topicId?: string;
  /** Opens the topic-description MDXEditor tab (current edit affordance). */
  onEdit: () => void;
  /** Event bus — used to open clicked doc links as tabs (`file:opened`). */
  events: PanelEventEmitter;
  /**
   * Workspace whose member repositories doc links resolve against. Topic notes
   * span projects and usually have no single "current repo", so links are
   * matched against the file trees of every repo in this workspace.
   */
  workspaceId?: string;
  /**
   * Fallback repo for resolving links before the workspace file index has
   * loaded (the currently selected repo, when there is one).
   */
  repositoryPath?: string;
}

export const TopicDescriptionSlideOver: React.FC<
  TopicDescriptionSlideOverProps
> = ({
  open,
  instant,
  topicId,
  onEdit,
  events,
  workspaceId,
  repositoryPath,
}) => {
  const { theme } = useTheme();

  // The TOC button + panel: the body reports whether the current description has
  // headings (`hasToc`), this owns the open-state, and the body renders the
  // actual outline overlay (it has the heading DOM). Collapse the panel whenever
  // the slide-over itself closes so it isn't left open behind the scenes.
  const [tocOpen, setTocOpen] = React.useState(false);
  const [hasToc, setHasToc] = React.useState(false);
  const closeToc = React.useCallback(() => setTocOpen(false), []);
  React.useEffect(() => {
    if (!open) setTocOpen(false);
  }, [open]);

  const iconButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    flexShrink: 0,
    padding: 0,
    borderRadius: 6,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.backgroundSecondary,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
  };

  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background,
        borderRight: `1px solid ${theme.colors.border}`,
        boxShadow: open ? '4px 0 16px rgba(0,0,0,0.2)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: instant ? 'none' : 'transform 0.25s ease',
        zIndex: 20,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <Brain size={14} color={theme.colors.textSecondary} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Braindump
        </span>
        {hasToc && (
          <button
            type="button"
            onClick={() => setTocOpen((o) => !o)}
            title="Table of contents"
            aria-label="Table of contents"
            aria-expanded={tocOpen}
            style={{
              ...iconButtonStyle,
              color: tocOpen ? theme.colors.primary : theme.colors.textSecondary,
              borderColor: tocOpen
                ? theme.colors.primary
                : theme.colors.border,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.colors.text;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = tocOpen
                ? theme.colors.primary
                : theme.colors.textSecondary;
              e.currentTarget.style.borderColor = tocOpen
                ? theme.colors.primary
                : theme.colors.border;
            }}
          >
            <List size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          title="Edit description"
          aria-label="Edit description"
          style={iconButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.text;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
        >
          <Pencil size={14} />
        </button>
      </div>

      <TopicDescriptionBody
        topicId={topicId}
        visible={open}
        events={events}
        workspaceId={workspaceId}
        repositoryPath={repositoryPath}
        onEdit={onEdit}
        tocOpen={tocOpen}
        onCloseToc={closeToc}
        onTocAvailableChange={setHasToc}
      />
    </div>
  );
};

export default TopicDescriptionSlideOver;
