import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bot } from 'lucide-react';
import type { Topic } from '../../tipc/topicClient';
import { TopicService } from '../../main-process-api/TopicService';

/**
 * MIME used to carry a topic-briefing payload via HTML5 drag-and-drop.
 * Drop targets (e.g. the Alexandria terminal panel) read this to know they
 * should brief their agent with the included topicId.
 */
export const BRIEF_AGENT_MIME = 'application/x-alexandria-topic-briefing';

/**
 * Window CustomEvent name used by the click path. The button lives in the
 * titlebar (a sibling React tree from the workspace), so click-to-brief
 * crosses tree boundaries via this event. `detail` carries the same
 * BriefAgentDragPayload shape the drag path uses.
 */
export const BRIEF_AGENT_CLICK_EVENT = 'alexandria:brief-agent-click';

export interface BriefAgentDragPayload {
  topicId: string;
  topicTitle: string;
}

/**
 * Build the prompt that gets pasted into the agent's terminal. The agent
 * fetches the topic URL to learn what it's working on. Session linking is
 * handled out-of-band by the event server parsing the hook payload — the
 * agent can't observe it, so we don't mention it in the prompt.
 */
export function buildBriefingText(payload: BriefAgentDragPayload): string {
  return [
    `Fetch http://localhost:3044/api/topics/${payload.topicId} to begin working on topic "${payload.topicTitle}". The response returns its description and trails — continue with that context in mind.`,
    '',
    `If you author a trail during this task, include "topicId": "${payload.topicId}" in the POST body so it attaches to this topic.`,
    '',
    `To leave context on the topic, POST to http://localhost:3044/api/topics/${payload.topicId}/description/append with {"text": "..."} to add a paragraph, or POST to .../description/section with {"heading": "...", "body": "..."} to replace one section in place (match the heading text exactly — GET the topic first to read it). Section upsert keeps a status section truthful instead of stacking duplicates.`,
    '',
  ].join('\n');
}

export interface BriefAgentButtonProps {
  /**
   * Topic this window is briefing about. Required so the button reflects the
   * workspace's topic rather than whichever topic happens to be first globally.
   * `undefined` means the workspace has no topic — the button renders disabled.
   */
  topicId: string | undefined;
}

export const BriefAgentButton: React.FC<BriefAgentButtonProps> = ({
  topicId,
}) => {
  const { theme } = useTheme();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!topicId) {
      setTopic(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      TopicService.getTopic(topicId)
        .then((t) => {
          if (cancelled) return;
          setTopic(t);
        })
        .catch((err) => {
          console.error('[BriefAgentButton] failed to load topic', err);
        });
    };
    load();
    const off = TopicService.onTopicChange((event) => {
      const changedId = event.topic?.id ?? event.id;
      if (changedId === topicId) load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [topicId]);

  const armed = topic !== null;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!topic) {
      e.preventDefault();
      return;
    }
    const payload: BriefAgentDragPayload = {
      topicId: topic.id,
      topicTitle: topic.title,
    };
    e.dataTransfer.setData(BRIEF_AGENT_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setIsHovered(false);
  };

  const handleClick = () => {
    if (!topic) return;
    const payload: BriefAgentDragPayload = {
      topicId: topic.id,
      topicTitle: topic.title,
    };
    window.dispatchEvent(
      new CustomEvent<BriefAgentDragPayload>(BRIEF_AGENT_CLICK_EVENT, {
        detail: payload,
      }),
    );
  };

  // Prevent mousedown from shifting focus to this control. The button is a
  // div (not <button>), so it doesn't auto-focus on mousedown the way a real
  // <button> would; but the click path explicitly refocuses the terminal
  // afterward, and we don't want any intermediate focus flicker.
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const label = 'Brief Agent';

  // Rendered as a <div role="button"> rather than <button>: clicking a real
  // <button> focuses it on mousedown, stealing focus from the terminal we're
  // about to write into. Project cards in the workspace use the same
  // <div draggable> pattern for the same reason.
  return (
    <div
      role="button"
      aria-disabled={!armed}
      draggable={armed}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={armed ? handleClick : undefined}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={
        armed
          ? `Click to brief the active terminal, or drag onto a specific one — topic "${topic!.title}"`
          : 'Create a topic to enable briefing'
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        minHeight: '34px',
        boxSizing: 'border-box',
        borderRadius: '6px',
        background:
          armed && isHovered
            ? theme.colors.primary
            : theme.colors.backgroundTertiary,
        border: `1px solid ${
          armed && isHovered ? theme.colors.primary : theme.colors.border
        }`,
        color:
          armed && isHovered
            ? theme.colors.background
            : theme.colors.textSecondary,
        cursor: armed ? 'pointer' : 'not-allowed',
        opacity: armed ? 1 : 0.5,
        fontSize: `${theme.fontSizes[1]}px`,
        fontWeight: theme.fontWeights.medium,
        fontFamily: theme.fonts.body,
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      <Bot size={16} />
      <span>{label}</span>
    </div>
  );
};
