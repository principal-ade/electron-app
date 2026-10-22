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
import { Check, Copy, List } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from './topic-description/TopicDescriptionBody';
import { TopicProjectsRail } from './topic-description/TopicProjectsRail';
import { TopicSubsystemModelsRail } from './topic-description/TopicSubsystemModelsRail';
import { TopicService } from '../main-process-api/TopicService';
import { TopicDeleteHeaderButton } from './TopicDeleteHeaderButton';

export const LocalTopicTabContent: React.FC<{
  topicId: string;
  title?: string;
  events: PanelEventEmitter;
  /** Open a repo declared by the topic (a pick from the Projects rail). */
  onOpenProject?: (purl: string) => void;
  onOpenModel: (modelId: string, title: string) => void;
}> = ({ topicId, title, events, onOpenProject, onOpenModel }) => {
  const { theme } = useTheme();

  // Table-of-contents drawer: the body reports whether the description has
  // headings (`hasToc`), this owns the open-state, and the body renders the
  // outline overlay (it has the heading DOM).
  const [tocOpen, setTocOpen] = React.useState(false);
  const [hasToc, setHasToc] = React.useState(false);
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontSize: theme.fontSizes[3],
            fontWeight: 700,
            color: theme.colors.primary,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title || 'Topic'}
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
                tocOpen ? theme.colors.primary : theme.colors.border
              }`,
              background: theme.colors.backgroundSecondary,
              color: tocOpen ? theme.colors.primary : theme.colors.text,
              cursor: 'pointer',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
          >
            <List size={16} />
          </button>
        )}
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

        {/* Right column: the topic's repos, then the subsystem models it concerns.
            Scrolls as one so both sections stay reachable on short windows. */}
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
        </div>
      </div>
    </div>
  );
};

export default LocalTopicTabContent;
