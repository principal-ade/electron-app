import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Share2, GitFork } from 'lucide-react';
import type { LocalTopicRecord } from '../../../shared/main-process-api-interfaces/TopicAPI';
import {
  STATES,
  normalizeState,
  stateColor,
} from '../../alexandria-workspace/topic-description-tab/topicStatusModel';

/** Compact "x ago" relative time from an ISO timestamp. */
function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const stateLabel = (state: string): string =>
  STATES.find((s) => s.value === state)?.label ?? 'New Thought';

export interface TopicRowProps {
  record: LocalTopicRecord;
  /** Topic's trails reach beyond the current repo (cross-repo bundle). */
  multiRepo?: boolean;
  onOpen: (topicId: string, title?: string) => void;
}

const Badge: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  icon: React.ReactNode;
  label: string;
  title: string;
}> = ({ theme, icon, label, title }) => (
  <span
    title={title}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '1px 6px',
      borderRadius: 4,
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.textSecondary,
      fontSize: theme.fontSizes[0],
      lineHeight: 1.4,
      flexShrink: 0,
    }}
  >
    {icon}
    {label}
  </span>
);

export const TopicRow: React.FC<TopicRowProps> = ({
  record,
  multiRepo,
  onOpen,
}) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const topic = record.topic;
  const state = normalizeState(topic.status?.state);
  const color = stateColor(state, theme);
  const trailCount = topic.trailIds.length;
  const shared = Boolean(record.sync.remoteId);
  const statusName = topic.status?.label || stateLabel(state);
  const trailText = `${trailCount} ${trailCount === 1 ? 'trail' : 'trails'}`;

  // Drag the topic into a terminal as an agent prompt that hydrates it from the
  // local bridge — mirrors the Trails panel's drag-to-context behavior.
  const handleDragStart = (e: React.DragEvent) => {
    if (!e.dataTransfer) return;
    const title = topic.title || 'Untitled topic';
    const payload = `Use topic "${title}" (id: ${topic.id}) as context — fetch via:\ncurl -s http://localhost:3054/api/topics/${topic.id}`;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', payload);
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={() => onOpen(topic.id, topic.title)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '12px 16px',
        border: 'none',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: hovered
          ? theme.colors.backgroundSecondary
          : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        transition: 'background-color 0.15s ease',
      }}
    >
      {/* Status dot — the topic's "aliveness" axis color. */}
      <div
        style={{
          width: 8,
          height: 8,
          marginTop: 5,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: color,
        }}
        title={statusName}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: theme.fontSizes[2],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {topic.title || 'Untitled topic'}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textMuted,
          }}
        >
          <span style={{ flexShrink: 0 }}>{trailText}</span>
          <span aria-hidden style={{ opacity: 0.5 }}>
            ·
          </span>
          <span style={{ flexShrink: 0 }}>{timeAgo(topic.updatedAt)}</span>
          {multiRepo && (
            <Badge
              theme={theme}
              icon={<GitFork size={11} />}
              label="Multi-repo"
              title="This topic's trails span more than the current repository"
            />
          )}
          {shared && (
            <Badge
              theme={theme}
              icon={<Share2 size={11} />}
              label="Shared"
              title="Published to web-ade"
            />
          )}
        </div>
      </div>
    </button>
  );
};
