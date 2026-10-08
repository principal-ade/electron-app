/**
 * TopicStatusHeaderButton
 *
 * A compact, self-contained status control for a topic-tab header. Shows the
 * topic's current workflow state as a colored pill; clicking it opens a popover
 * with the full {@link TopicStatusControl} (the aliveness graph + `waitingOn`
 * sub-form) so the state can be changed without opening the workspace info
 * modal. Used by both local topic-tab surfaces — `LocalTopicTabContent` and
 * `DevWorkspaceTopicTab` — which otherwise only carry the topic id, so this
 * component self-fetches the topic's status and stays live via
 * `TopicService.onTopicChange` (edits from anywhere — this popover, the modal,
 * the home board — refresh the pill).
 *
 * All topic tabs are backed by local topic records, so status changes write
 * through to the same store.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronDown } from 'lucide-react';
import type { TopicStatus } from '@principal-ai/subsystems-core/node';
import { TopicService } from '../../main-process-api/TopicService';
import { TopicEventType } from '../../../shared/main-process-api-interfaces/TopicAPI';
import { normalizeState, stateColor, STATES } from './topicStatusModel';
import { TopicStatusControl } from './TopicStatusControl';

const STATE_LABELS = new Map(STATES.map((s) => [s.value, s.label]));

export interface TopicStatusHeaderButtonProps {
  topicId: string;
}

export const TopicStatusHeaderButton: React.FC<
  TopicStatusHeaderButtonProps
> = ({ topicId }) => {
  const { theme } = useTheme();
  const [status, setStatus] = React.useState<TopicStatus | undefined>();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  // Self-fetch the topic's status and keep it live. The pill must reflect edits
  // made anywhere (this popover, the workspace info modal, the home board), so
  // we both fetch on mount and subscribe to topic-change broadcasts.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const topic = await TopicService.getTopic(topicId);
      if (!cancelled) setStatus(topic?.status);
    })();
    const unsubscribe = TopicService.onTopicChange((event) => {
      if (
        event.type === TopicEventType.UPDATED &&
        event.topic?.id === topicId
      ) {
        setStatus(event.topic.status);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [topicId]);

  // Close the popover on an outside click or Escape.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const state = normalizeState(status?.state);
  const color = stateColor(state, theme);
  const label = status?.label?.trim() || STATE_LABELS.get(state) || 'Status';

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Change topic status"
        aria-label={`Topic status: ${label}. Click to change.`}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 32,
          boxSizing: 'border-box',
          padding: '0 10px',
          borderRadius: 6,
          border: `1px solid ${open ? color : theme.colors.border}`,
          background: theme.colors.backgroundSecondary,
          color: theme.colors.text,
          cursor: 'pointer',
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          fontWeight: 600,
          whiteSpace: 'nowrap',
          transition: 'border-color 0.15s ease',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        {label}
        <ChevronDown
          size={14}
          style={{
            color: theme.colors.textSecondary,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Edit topic status"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1000,
            width: 480,
            maxWidth: '90vw',
            borderRadius: 8,
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.background,
            boxShadow: '0 8px 28px rgba(0, 0, 0, 0.28)',
            overflow: 'hidden',
          }}
        >
          <TopicStatusControl topicId={topicId} status={status} />
        </div>
      )}
    </div>
  );
};

export default TopicStatusHeaderButton;
