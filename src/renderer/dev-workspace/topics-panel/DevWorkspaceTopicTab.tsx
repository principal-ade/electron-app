import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Copy, List } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from '../../topics-view/topic-description/TopicDescriptionBody';
import { TopicProjectsRail } from '../../topics-view/topic-description/TopicProjectsRail';
import { TopicSubsystemModelsRail } from '../../topics-view/topic-description/TopicSubsystemModelsRail';
import { TopicService } from '../../main-process-api/TopicService';
import { TopicDeleteHeaderButton } from '../../topics-view/TopicDeleteHeaderButton';
import { TopicPinHeaderButton } from '../../topics-view/TopicPinHeaderButton';

export interface DevWorkspaceTopicTabProps {
  topicId: string;
  /** Tab label / heading. */
  title?: string;
  /** Gates the description body's open-time fetch; pass the tab's active flag. */
  isActive: boolean;
  events: PanelEventEmitter;
  /** Current repo, used as a link-resolution fallback (optional). */
  repositoryPath?: string;
  onOpenModel: (modelId: string, title: string) => void;
}

/**
 * Tab content for a topic opened from the dev-workspace Topics panel. Reuses
 * the chrome-less {@link TopicDescriptionBody} for the markdown description and
 * the topic's declared project list.
 *
 * The header mirrors the Topics view's `LocalTopicTabContent`: title and an
 * optional table-of-contents toggle.
 */
export const DevWorkspaceTopicTab: React.FC<DevWorkspaceTopicTabProps> = ({
  topicId,
  title,
  isActive,
  events,
  repositoryPath,
  onOpenModel,
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
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: theme.colors.background,
        color: theme.colors.text,
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
            fontFamily: theme.fonts.heading,
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
        <TopicPinHeaderButton topicId={topicId} title={title} />
        <TopicDeleteHeaderButton topicId={topicId} title={title} />
      </div>

      {/* Body: topic description and its declared project list. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex' }}
        >
          <TopicDescriptionBody
            topicId={topicId}
            visible={isActive}
            events={events}
            repositoryPath={repositoryPath}
            tocOpen={tocOpen}
            onCloseToc={closeToc}
            onTocAvailableChange={setHasToc}
          />
        </div>

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
          <TopicProjectsRail topicId={topicId} width="100%" />
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
