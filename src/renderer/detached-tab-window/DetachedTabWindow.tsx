/**
 * DetachedTabWindow
 *
 * Single-tab host for a workspace tab moved out of the principal window.
 *
 * Protocol:
 *   1. Read the opaque transfer token from the URL hash.
 *   2. Claim it from main — the descriptor never travels in the URL.
 *   3. Preflight-load the content identity (topic / subsystem model).
 *   4. Only after it renders do we accept, which is what removes the source tab.
 *   5. On any failure, reject: main closes this window and the source keeps its
 *      tab.
 *
 * "Move back to main window" hands the *current* descriptor back through the
 * same token/handshake and lets main close this window after the main window
 * adopts it.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { ArrowLeftToLine, Loader2 } from 'lucide-react';
import { BaseTitlebar } from '../components/Titlebar/BaseTitlebar';
import { LocalTopicTabContent } from '../topics-view/LocalTopicTabContent';
import { SubsystemModelTabContent } from '../subsystem-models/SubsystemModelTabContent';
import { C4SketchTabContent } from '../c4-sketches/C4SketchTabContent';
import { C4SketchService } from '../main-process-api/C4SketchService';
import { TopicService } from '../main-process-api/TopicService';
import { SubsystemModelService } from '../main-process-api/SubsystemModelService';
import { WindowService } from '../main-process-api/WindowService';
import type { DetachableTabDescriptor } from '../../shared/detachedTab';

type Phase = 'claiming' | 'preparing' | 'ready' | 'error';

function readTransferToken(): string | null {
  const match = /^#transfer\/([A-Za-z0-9-]+)$/.exec(window.location.hash);
  return match?.[1] ?? null;
}

/**
 * Load the identity the tab needs before we accept the transfer. Mirrors what
 * the content components fetch, so a missing/deleted topic or model fails here
 * while the source tab still exists.
 */
async function preflight(tab: DetachableTabDescriptor): Promise<string | null> {
  if (tab.kind === 'local-topic') {
    const topic = tab.topicId ? await TopicService.getTopic(tab.topicId) : null;
    return topic ? null : 'This topic could not be found.';
  }
  if (tab.kind === 'c4-sketch') {
    const sketch = tab.sketchId
      ? await C4SketchService.get(tab.sketchId)
      : null;
    return sketch ? null : 'This C4 sketch could not be found.';
  }
  const model = tab.modelId
    ? await SubsystemModelService.get(tab.modelId)
    : null;
  return model ? null : 'This subsystem model could not be found.';
}

export const DetachedTabWindow: React.FC = () => {
  const { theme } = useTheme();
  const token = useMemo(readTransferToken, []);
  const events = useMemo(() => new PanelEventBus(), []);

  const [phase, setPhase] = useState<Phase>('claiming');
  const [tab, setTab] = useState<DetachableTabDescriptor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        setError('This window has no pending tab transfer.');
        setPhase('error');
        return;
      }
      const claimed = await WindowService.claimDetachedTab(token);
      if (cancelled) return;
      if (!claimed) {
        setError('This tab transfer expired or is already in use.');
        setPhase('error');
        return;
      }

      setTab(claimed);
      document.title = claimed.label;
      setPhase('preparing');

      let failure: string | null = null;
      try {
        failure = await preflight(claimed);
      } catch (loadError) {
        console.error('[DetachedTab] Preflight failed:', loadError);
        failure = 'The tab could not be loaded.';
      }
      if (cancelled) return;

      if (failure) {
        setError(failure);
        setPhase('error');
        await WindowService.rejectDetachedTab(token, 'preflight-failed');
        return;
      }
      setPhase('ready');
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Accept only after the ready state has painted, so the source tab is removed
  // once there is something on screen — not merely once a descriptor arrived.
  useEffect(() => {
    if (phase !== 'ready' || !token || acceptedRef.current) return;
    acceptedRef.current = true;
    const frame = requestAnimationFrame(() => {
      void WindowService.acceptDetachedTab(token).then((accepted) => {
        if (!accepted) {
          console.warn(
            '[DetachedTab] Destination could not accept the transfer; main may have timed out.',
          );
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, token]);

  const handleOpenModel = useCallback((modelId: string, title: string) => {
    const next: DetachableTabDescriptor = {
      kind: 'subsystem-model',
      tabId: `subsystem-model-${modelId}`,
      label: title || 'Subsystem Model',
      modelId,
    };
    setTab(next);
    document.title = next.label;
  }, []);

  const handleOpenTopic = useCallback((topicId: string, title: string) => {
    const next: DetachableTabDescriptor = {
      kind: 'local-topic',
      tabId: `local-topic-${topicId}`,
      label: title || 'Topic',
      title,
      topicId,
    };
    setTab(next);
    document.title = next.label;
  }, []);

  const handleOpenSketch = useCallback((sketchId: string, title: string) => {
    const next: DetachableTabDescriptor = {
      kind: 'c4-sketch',
      tabId: `c4-sketch-${sketchId}`,
      label: title || 'C4 Sketch',
      sketchId,
    };
    setTab(next);
    document.title = next.label;
  }, []);

  const handleReturn = useCallback(async () => {
    if (!tab || returning) return;
    setReturning(true);
    setReturnError(null);
    const result = await WindowService.returnDetachedTabToMain(tab);
    setReturning(false);
    if (!result.ok) {
      setReturnError('Could not move the tab back; it is still open here.');
    }
    // On success main closes this window.
  }, [tab, returning]);

  const header = (
    <BaseTitlebar
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          <span
            style={{
              maxWidth: 480,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tab?.label ?? 'Detached Tab'}
          </span>
        </div>
      }
    >
      <button
        type="button"
        data-position="right"
        onClick={() => void handleReturn()}
        disabled={!tab || returning}
        title={returnError ?? 'Move this tab back to the main window'}
        style={{
          WebkitAppRegion: 'no-drag',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginRight: 8,
          padding: '4px 8px',
          borderRadius: 6,
          border: `1px solid ${theme.colors.border}`,
          background: theme.colors.backgroundSecondary,
          color: theme.colors.text,
          cursor: !tab || returning ? 'default' : 'pointer',
          opacity: !tab || returning ? 0.5 : 1,
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        <ArrowLeftToLine size={13} />
        {returning ? 'moving…' : 'move back to main window'}
      </button>
    </BaseTitlebar>
  );

  const centered = (message: React.ReactNode, role?: 'alert' | 'status') => (
    <div
      role={role}
      style={{
        display: 'grid',
        height: '100%',
        placeItems: 'center',
        padding: 24,
        textAlign: 'center',
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.background,
        fontFamily: theme.fonts.body,
      }}
    >
      {message}
    </div>
  );

  let body: React.ReactNode;
  if (phase === 'claiming' || phase === 'preparing') {
    // The window is already on screen where the tab was dropped; show that
    // the tab is on its way rather than an empty pane.
    body = centered(
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} />
        <span>{tab ? `Opening "${tab.label}"…` : 'Opening tab…'}</span>
      </div>,
      'status',
    );
  } else if (phase === 'error' || !tab) {
    body = centered(error ?? 'This tab could not be opened.', 'alert');
  } else if (tab.kind === 'local-topic' && tab.topicId) {
    body = (
      <LocalTopicTabContent
        topicId={tab.topicId}
        title={tab.title}
        events={events}
        onOpenModel={handleOpenModel}
        onOpenTopic={handleOpenTopic}
        onOpenSketch={handleOpenSketch}
      />
    );
  } else if (tab.kind === 'subsystem-model' && tab.modelId) {
    body = <SubsystemModelTabContent modelId={tab.modelId} />;
  } else if (tab.kind === 'c4-sketch' && tab.sketchId) {
    body = <C4SketchTabContent sketchId={tab.sketchId} />;
  } else {
    body = centered(
      'This tab type cannot be opened in a detached window.',
      'alert',
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {header}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{body}</div>
    </div>
  );
};

export default DetachedTabWindow;
