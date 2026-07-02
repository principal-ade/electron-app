import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Loader2, UploadCloud } from 'lucide-react';
import type {
  LocalTopicRecord,
  PublishedTopicVisibility,
  TopicTrailPublishResult,
} from '../../../shared/main-process-api-interfaces/TopicAPI';
import { TopicService } from '../../main-process-api/TopicService';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { ShareTopicModal } from './ShareTopicModal';
import type { TopicTrailPlan } from './ShareTopicModal';

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
  const [plan, setPlan] = useState<{ trails: TopicTrailPlan[] }>({
    trails: [],
  });
  // Set on a successful publish while the modal is open, so the modal can show
  // a confirmation (link, audience, per-trail results) instead of closing.
  const [publishResult, setPublishResult] = useState<{
    url: string;
    visibility: PublishedTopicVisibility;
    trails: TopicTrailPublishResult[];
  } | null>(null);
  // Mirrors `topicSharing.skipPublishConfirm` — when true, an unblocked publish
  // skips the educational modal. Read once on mount and kept current via the
  // preferences-updated event.
  const skipConfirmRef = useRef(false);
  const revertRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        if (!cancelled)
          skipConfirmRef.current = Boolean(
            prefs.topicSharing?.skipPublishConfirm,
          );
      })
      .catch(() => {
        /* default: don't skip */
      });
    const off = UserPreferencesService.onPreferencesUpdated((prefs) => {
      skipConfirmRef.current = Boolean(prefs.topicSharing?.skipPublishConfirm);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

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
  const published = Boolean(remoteId);
  const armed = Boolean(topicId && record);

  // The actual publish — shared by the direct (opted-out) path and the
  // modal-confirm path. Keeps the modal open on error so its message shows
  // there; closes + flashes "copied" on success. `dontShowAgain` is only set
  // from the modal's checkbox; persists the opt-out before publishing.
  const runPublish = useCallback(
    async (
      dontShowAgain = false,
      visibility: PublishedTopicVisibility = 'private',
    ) => {
      if (!topicId) return;
      if (dontShowAgain) {
        skipConfirmRef.current = true;
        void UserPreferencesService.updatePreferences({
          topicSharing: { skipPublishConfirm: true },
        });
      }
      setStatus('publishing');
      setErrorMsg(null);
      try {
        const result = await TopicService.publishTopic(topicId, visibility);
        setRecord(result.record);
        try {
          await navigator.clipboard.writeText(result.url);
        } catch {
          /* clipboard denied — still published */
        }
        if (modalOpen) {
          // Keep the modal open to confirm success (link, audience, per-trail
          // results) rather than closing it silently.
          setPublishResult({
            url: result.url,
            visibility: result.visibility,
            trails: result.trailResults,
          });
          setStatus('idle');
        } else {
          setStatus('idle');
          flash('copied', 1500);
        }
      } catch (err) {
        setStatus('idle');
        // The typed TrailShareError loses its class crossing IPC, but its message
        // survives — surface it so the real reason (e.g. "description exceeds
        // 8000 chars", "sign in to GitHub") shows instead of a generic string.
        setErrorMsg(
          err instanceof Error && err.message
            ? err.message
            : 'Could not share this topic.',
        );
        if (!modalOpen) flash('error', 3500);
      }
    },
    [topicId, modalOpen, flash],
  );

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

    // Resolve each of the topic's trails to its publish status so the modal
    // can list them. A topic stores local trail ids; the library lookup gives
    // titles + sharedAt. Trails missing from the library are 'unresolved' and
    // block the publish.
    const { entries } = await TrailLibraryService.list();
    const byId = new Map(entries.map((e) => [e.id, e]));
    const trails: TopicTrailPlan[] = record.topic.trailIds.map((trailId) => {
      const entry = byId.get(trailId);
      if (!entry) return { id: trailId, title: trailId, status: 'unresolved' };
      return {
        id: trailId,
        title: entry.title || trailId,
        status: entry.sharedAt ? 'shared' : 'toPublish',
      };
    });
    const hasUnresolved = trails.some((t) => t.status === 'unresolved');

    // The modal shows on every publish so sharing is never silent. The only
    // exception is when the user has opted out *and* nothing is blocking —
    // a blocked publish (unresolved trails) must always surface the modal so
    // its explanation shows.
    if (skipConfirmRef.current && !hasUnresolved) {
      await runPublish();
      return;
    }
    setPlan({ trails });
    setErrorMsg(null);
    setPublishResult(null);
    setModalOpen(true);
  }, [topicId, record, remoteId, status, flash, runPublish]);

  const label =
    status === 'publishing'
      ? 'Publishing…'
      : status === 'copied'
        ? 'Link copied'
        : status === 'error'
          ? 'Publish failed'
          : published
            ? 'Shared'
            : 'Publish topic';

  const Icon =
    status === 'publishing'
      ? Loader2
      : published || status === 'copied'
        ? Check
        : UploadCloud;

  const title = !topicId
    ? 'Create a topic first'
    : status === 'error' && errorMsg
      ? errorMsg
      : undefined;

  // Shared topics get a quiet "primary outline" resting state so the shared
  // status reads at a glance; unshared use the neutral titlebar-button look.
  const showActive = isHovered && armed && status !== 'error';
  const restingBorder =
    status === 'error'
      ? theme.colors.error
      : published
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
                : published || status === 'copied'
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
          className={status === 'publishing' ? 'publish-topic-spin' : undefined}
          style={
            status === 'publishing'
              ? { animation: 'publish-topic-spin 0.8s linear infinite' }
              : undefined
          }
        />
        <span>{label}</span>
        <style>{`
        @keyframes publish-topic-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      </button>
      {modalOpen && record && (
        <ShareTopicModal
          topicTitle={record.topic.title}
          trails={plan.trails}
          busy={status === 'publishing'}
          error={errorMsg}
          result={publishResult}
          onConfirm={runPublish}
          onCancel={() => {
            if (status === 'publishing') return;
            setModalOpen(false);
            setErrorMsg(null);
            setPublishResult(null);
          }}
        />
      )}
    </>
  );
};

export default ShareTopicButton;
