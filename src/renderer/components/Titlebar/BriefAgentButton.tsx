import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bot } from 'lucide-react';
import { topicClient, type Topic } from '../../tipc/topicClient';

/**
 * MIME used to carry a topic-briefing payload via HTML5 drag-and-drop.
 * Drop targets (e.g. the Alexandria terminal panel) read this to know they
 * should brief their agent with the included topicId.
 */
export const BRIEF_AGENT_MIME = 'application/x-alexandria-topic-briefing';

export interface BriefAgentDragPayload {
  topicId: string;
  topicTitle: string;
}

/**
 * Build the prompt that gets pasted into the agent's terminal. The agent
 * fetches the topic URL to learn what it's working on; the event server
 * parses that fetch and links {sessionId → topicId} in the registry.
 */
export function buildBriefingText(payload: BriefAgentDragPayload): string {
  return [
    `Fetch http://localhost:3044/api/topics/${payload.topicId} to begin working on topic "${payload.topicTitle}". That request both links this session to the topic and returns its description and trails — continue with that context in mind.`,
    '',
  ].join('\n');
}

export const BriefAgentButton: React.FC = () => {
  const { theme } = useTheme();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    topicClient
      .getTopics()
      .then((topics) => {
        if (cancelled) return;
        setTopic(topics[0] ?? null);
      })
      .catch((err) => {
        console.error('[BriefAgentButton] failed to load topics', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const armed = topic !== null;

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
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

  const label = 'Brief Agent';

  return (
    <button
      draggable={armed}
      onDragStart={handleDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={!armed}
      title={
        armed
          ? `Drag onto a terminal to brief its agent about "${topic!.title}"`
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
        cursor: armed ? 'grab' : 'not-allowed',
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
    </button>
  );
};
