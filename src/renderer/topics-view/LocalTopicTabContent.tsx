/**
 * LocalTopicTabContent
 *
 * Tab body for the Topics view — renders a single LOCAL topic (one from
 * `TopicService.getTopics`). The tab is a split:
 * the topic's markdown description (via the shared `TopicDescriptionBody`)
 * fills the left, and a projects rail on the right lists its declared repos.
 *
 * No `workspaceId` is passed to the body: doc links resolve optimistically,
 * which is the right default for this cross-project reading surface.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Copy, List, SquareArrowOutUpRight } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from './topic-description/TopicDescriptionBody';
import { TopicProjectsRail } from './topic-description/TopicProjectsRail';
import { TopicSubsystemModelsRail } from './topic-description/TopicSubsystemModelsRail';
import {
  TopicReferencesRail,
  type TopicReferencesRailProps,
} from './topic-description/TopicReferencesRail';
import { TopicService } from '../main-process-api/TopicService';
import { TopicDeleteHeaderButton } from './TopicDeleteHeaderButton';
import { TopicPinHeaderButton } from './TopicPinHeaderButton';
import type { TopicProjectsRailProps } from './topic-description/TopicProjectsRail';

export const LocalTopicTabContent: React.FC<{
  topicId: string;
  title?: string;
  events: PanelEventEmitter;
  /** Open a repo profile/explorer, or a terminal for an alternate gesture. */
  onOpenProject?: TopicProjectsRailProps['onOpenProject'];
  onOpenModel: (modelId: string, title: string) => void;
  onOpenTopic: (topicId: string, title: string) => void;
  onOpenSketch: (sketchId: string, title: string) => void;
  onOpenDrawing?: TopicReferencesRailProps['onOpenDrawing'];
  /** Move this tab into its own window. Hidden when the host can't detach. */
  onDetach?: () => void;
}> = ({
  topicId,
  title,
  events,
  onOpenProject,
  onOpenModel,
  onOpenTopic,
  onOpenSketch,
  onOpenDrawing,
  onDetach,
}) => {
  const { theme } = useTheme();

  // Table-of-contents drawer: the body reports whether the description has
  // headings (`hasToc`), this owns the open-state, and the body renders the
  // outline overlay (it has the heading DOM).
  const [tocOpen, setTocOpen] = React.useState(false);
  const [hasToc, setHasToc] = React.useState(false);
  const [headerHovered, setHeaderHovered] = React.useState(false);
  const [titleFocused, setTitleFocused] = React.useState(false);
  const highlightToc = tocOpen || headerHovered || titleFocused;
  const closeToc = React.useCallback(() => setTocOpen(false), []);

  // Copy the topic's on-disk JSON path to the clipboard, with a brief "copied"
  // confirmation. `getFilePath` is null while the legacy topics blob is the
  // backend (no per-topic file) — the click then no-ops.
  const [copiedPath, setCopiedPath] = React.useState(false);
  const copyResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTopicPath = React.useCallback(async () => {
    const filePath = await TopicService.getFilePath(topicId);
    if (!filePath) return;
    try {
      await navigator.clipboard.writeText(filePath);
      setCopiedPath(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopiedPath(false), 1500);
    } catch {
      // navigator.clipboard can reject in restricted webviews; no-op.
    }
  }, [topicId]);
  React.useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      <div
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px 14px 10px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontSize: theme.fontSizes[4],
            fontWeight: 700,
            color: theme.colors.text,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <button
            type="button"
            disabled={!hasToc}
            onClick={() => setTocOpen((open) => !open)}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            aria-label={`Table of contents for ${title || 'Topic'}`}
            aria-expanded={tocOpen}
            style={{
              display: 'block',
              width: '100%',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              lineHeight: 'inherit',
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: hasToc ? 'pointer' : 'default',
            }}
          >
            {title || 'Topic'}
          </button>
        </h1>
        <button
          type="button"
          onClick={() => void copyTopicPath()}
          title="Copy topic file path"
          aria-label="Copy topic file path"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            flexShrink: 0,
            padding: 0,
            borderRadius: 6,
            border: `1px solid ${
              copiedPath ? theme.colors.primary : theme.colors.border
            }`,
            background: theme.colors.backgroundSecondary,
            color: copiedPath ? theme.colors.primary : theme.colors.text,
            cursor: 'pointer',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
        >
          {copiedPath ? <Check size={16} /> : <Copy size={16} />}
        </button>
        {hasToc && (
          <button
            type="button"
            onClick={() => setTocOpen((o) => !o)}
            title="Table of contents"
            aria-label="Table of contents"
            aria-expanded={tocOpen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              flexShrink: 0,
              padding: 0,
              borderRadius: 6,
              border: `1px solid ${
                highlightToc ? theme.colors.primary : theme.colors.border
              }`,
              background: theme.colors.backgroundSecondary,
              color: highlightToc ? theme.colors.primary : theme.colors.text,
              cursor: 'pointer',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
          >
            <List size={16} />
          </button>
        )}
        {onDetach && (
          <button
            type="button"
            onClick={onDetach}
            title="Move this tab to its own window"
            aria-label="Move this tab to its own window"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              flexShrink: 0,
              padding: 0,
              borderRadius: 6,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              cursor: 'pointer',
            }}
          >
            <SquareArrowOutUpRight size={16} />
          </button>
        )}
        <TopicPinHeaderButton topicId={topicId} title={title} />
        <TopicDeleteHeaderButton topicId={topicId} title={title} />
      </div>

      {/* Body: topic description and its declared project list. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            // Match the markdown slide's own background (theme.colors.backgroundDark)
            // so the area reads uniform when the centered prose leaves side gaps.
            backgroundColor: theme.colors.backgroundDark,
          }}
        >
          <TopicDescriptionBody
            topicId={topicId}
            events={events}
            tocOpen={tocOpen}
            onCloseToc={closeToc}
            onTocAvailableChange={setHasToc}
          />
        </div>

        {/* References scroll as one so every section stays reachable on short windows. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            width: '25%',
            minWidth: 300,
            boxSizing: 'border-box',
            minHeight: 0,
            overflowY: 'auto',
            borderLeft: `1px solid ${theme.colors.border}`,
          }}
        >
          <TopicProjectsRail
            topicId={topicId}
            width="100%"
            onOpenProject={onOpenProject}
          />
          <TopicSubsystemModelsRail
            topicId={topicId}
            width="100%"
            onOpenModel={onOpenModel}
          />
          <TopicReferencesRail
            topicId={topicId}
            width="100%"
            onOpenTopic={onOpenTopic}
            onOpenSketch={onOpenSketch}
            onOpenDrawing={onOpenDrawing}
          />
        </div>
      </div>
    </div>
  );
};

export default LocalTopicTabContent;
