import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Loader2, Share2 } from 'lucide-react';
import type { LocalTopicRecord } from '../../../shared/main-process-api-interfaces/TopicAPI';
import { TrailShareError } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TopicService } from '../../main-process-api/TopicService';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import { ShareTopicModal } from './ShareTopicModal';

/**
 * Titlebar action that publishes the workspace's topic to web-ade.
 *
 * Two states, keyed on `sync.remoteId`:
 *  - **Unshared** — clicking publishes via `TopicService.publishTopic`, then
 *    copies the returned link. On failure (e.g. a referenced trail isn't
 *    shared yet) the publish is rejected and the error surfaces in the label;
 *    nothing changes locally.
 *  - **Shared** — clicking re-copies the topic's public link. Edits to a
 *    shared topic write through to web-ade elsewhere (TopicRegistryService);
 *    this button only mints + links.
 */
export interface ShareTopicButtonProps {
  /** Topic this window owns. `undefined` → no topic → button disabled. */
  topicId: string | undefined;
}

type Status = 'idle' | 'publishing' | 'copied' | 'error';

const topicLink = (remoteId: string): string =>
  `https://app.principal-ade.com/topic/${remoteId}`;

export const ShareTopicButton: React.FC<ShareTopicButtonProps> = ({
  topicId,
}) => {
  const { theme } = useTheme();
  const [record, setRecord] = useState<LocalTopicRecord | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [plan, setPlan] = useState<{
    toPublish: string[];
    alreadyShared: number;
    unresolved: string[];
  }>({ toPublish: [], alreadyShared: 0, unresolved: [] });
  const revertRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the topic record (canonical + sync) so the button knows whether the
  // topic is already shared. Refetch on any topic change — publishing fires
  // TOPIC_UPDATED, and the record's sync.remoteId only shows up on a reread.
  useEffect(() => {
    if (!topicId) {
      setRecord(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      TopicService.getRecord(topicId)
        .then((r) => {
          if (!cancelled) setRecord(r);
        })
        .catch((err) => {
          console.error('[ShareTopicButton] failed to load topic record', err);
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

  useEffect(
    () => () => {
      if (revertRef.current) clearTimeout(revertRef.current);
    },
    [],
  );

  const flash = useCallback((next: Status, ms: number) => {
    setStatus(next);
    if (revertRef.current) clearTimeout(revertRef.current);
    revertRef.current = setTimeout(() => setStatus('idle'), ms);
  }, []);

  const remoteId = record?.sync.remoteId;
  const shared = Boolean(remoteId);
  const armed = Boolean(topicId && record);

  // The actual publish — shared by the direct path (no trails to pre-share)
  // and the modal-confirm path. Keeps the modal open on error so its message
  // shows there; closes + flashes "copied" on success.
  const runPublish = useCallback(async () => {
    if (!topicId) return;
    setStatus('publishing');
    setErrorMsg(null);
    try {
      const result = await TopicService.publishTopic(topicId);
      setRecord(result.record);
      try {
        await navigator.clipboard.writeText(result.url);
      } catch {
        /* clipboard denied — still published */
      }
      setModalOpen(false);
      setStatus('idle');
      flash('copied', 1500);
    } catch (err) {
      setStatus('idle');
      setErrorMsg(
        err instanceof TrailShareError
          ? err.message
          : 'Could not share this topic.',
      );
      if (!modalOpen) flash('error', 3500);
    }
  }, [topicId, modalOpen, flash]);

  const handleClick = useCallback(async () => {
    if (!topicId || !record || status === 'publishing') return;

    // Already shared → just (re)copy the link.
    if (remoteId) {
      try {
        await navigator.clipboard.writeText(topicLink(remoteId));
        flash('copied', 1500);
      } catch {
        /* clipboard denied — no-op */
      }
      return;
    }

    // Partition the topic's trails by shared state so the modal can explain
    // which ones publishing will also share. A topic stores local trail ids;
    // the library lookup gives titles + sharedAt.
    const { entries } = await TrailLibraryService.list();
    const byId = new Map(entries.map((e) => [e.id, e]));
    const toPublish: string[] = [];
    const unresolved: string[] = [];
    let alreadyShared = 0;
    for (const trailId of record.topic.trailIds) {
      const entry = byId.get(trailId);
      if (!entry) unresolved.push(trailId);
      else if (entry.sharedAt) alreadyShared += 1;
      else toPublish.push(entry.title || trailId);
    }

    // Nothing extra to publish and nothing broken → skip the modal.
    if (toPublish.length === 0 && unresolved.length === 0) {
      await runPublish();
      return;
    }
    setPlan({ toPublish, alreadyShared, unresolved });
    setErrorMsg(null);
    setModalOpen(true);
  }, [topicId, record, remoteId, status, flash, runPublish]);

  const label =
    status === 'publishing'
      ? 'Sharing…'
      : status === 'copied'
        ? 'Link copied'
        : status === 'error'
          ? 'Share failed'
          : shared
            ? 'Shared'
            : 'Share topic';

  const Icon =
    status === 'publishing' ? Loader2 : shared || status === 'copied' ? Check : Share2;

  const title = !topicId
    ? 'Create a topic to enable sharing'
    : status === 'error' && errorMsg
      ? errorMsg
      : shared
        ? 'Copy this topic’s web-ade link'
        : 'Publish this topic to web-ade and copy its link';

  // Shared topics get a quiet "primary outline" resting state so the shared
  // status reads at a glance; unshared use the neutral titlebar-button look.
  const showActive = isHovered && armed && status !== 'error';
  const restingBorder =
    status === 'error'
      ? theme.colors.error
      : shared
        ? theme.colors.primary
        : theme.colors.border;

  return (
    <>
    <button
      type="button"
      disabled={!armed && status === 'idle'}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        minHeight: '34px',
        boxSizing: 'border-box',
        borderRadius: '6px',
        background: showActive
          ? theme.colors.primary
          : theme.colors.backgroundTertiary,
        border: `1px solid ${showActive ? theme.colors.primary : restingBorder}`,
        color:
          status === 'error'
            ? theme.colors.error
            : showActive
              ? theme.colors.background
              : shared || status === 'copied'
                ? theme.colors.primary
                : theme.colors.textSecondary,
        cursor: armed ? 'pointer' : 'not-allowed',
        opacity: armed ? 1 : 0.5,
        fontSize: `${theme.fontSizes[1]}px`,
        fontWeight: theme.fontWeights.medium,
        fontFamily: theme.fonts.body,
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'no-drag',
      }}
    >
      <Icon
        size={16}
        className={status === 'publishing' ? 'share-topic-spin' : undefined}
        style={
          status === 'publishing'
            ? { animation: 'share-topic-spin 0.8s linear infinite' }
            : undefined
        }
      />
      <span>{label}</span>
      <style>{`
        @keyframes share-topic-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
    {modalOpen && record && (
      <ShareTopicModal
        topicTitle={record.topic.title}
        toPublish={plan.toPublish}
        alreadySharedCount={plan.alreadyShared}
        unresolved={plan.unresolved}
        busy={status === 'publishing'}
        error={errorMsg}
        onConfirm={runPublish}
        onCancel={() => {
          if (status === 'publishing') return;
          setModalOpen(false);
          setErrorMsg(null);
        }}
      />
    )}
    </>
  );
};

export default ShareTopicButton;
