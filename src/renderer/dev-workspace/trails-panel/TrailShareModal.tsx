import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertTriangle,
  Check,
  Circle,
  Copy,
  ExternalLink,
  Lock,
  Share2,
  X,
} from 'lucide-react';
import type { BaseTrailIndexEntry } from '@industry-theme/file-city-panel';
import { TrailShareError } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailShareService } from '../../services/TrailShareService';

const COPY_FEEDBACK_MS = 1500;

// Persisted "Don't show this again" preference for the pre-share
// confirmation. When set, the modal opens directly in `sharing` state and
// fires the share IPC on mount — the user still sees spinner / success /
// error feedback, just not the explanatory step.
const SKIP_CONFIRMATION_STORAGE_KEY = 'trail-share.skip-confirmation';

const readSkipConfirmation = (): boolean => {
  try {
    return (
      window.localStorage?.getItem(SKIP_CONFIRMATION_STORAGE_KEY) === 'true'
    );
  } catch {
    return false;
  }
};

const writeSkipConfirmation = (value: boolean): void => {
  try {
    if (value) {
      window.localStorage?.setItem(SKIP_CONFIRMATION_STORAGE_KEY, 'true');
    } else {
      window.localStorage?.removeItem(SKIP_CONFIRMATION_STORAGE_KEY);
    }
  } catch {
    // localStorage can throw in restricted webview contexts — fail open.
  }
};

const buildAgentCommand = (trailId: string) =>
  `npx -y @principal-ai/principal-view-cli@latest trail ${trailId}`;

type CopiedKind = 'url' | 'agent' | null;

const SHARE_STEPS = [
  'Preparing your trail',
  'Uploading to web-ade',
  'Publishing',
] as const;
// Step advances are time-driven (the share IPC doesn't expose per-phase
// progress). The total minimum sharing duration is `STEP_2_AT + STEPS_DONE_HOLD`
// so even an instant IPC resolution still plays the full sequence.
const STEP_1_AT_MS = 600;
const STEP_2_AT_MS = 1300;
const MIN_SHARING_MS = 2000;
const STEPS_DONE_HOLD_MS = 400;

type ModalState =
  | { kind: 'idle' }
  | { kind: 'sharing'; stepIndex: number }
  | { kind: 'missing-files'; missing: string[] }
  | { kind: 'success'; url: string }
  | { kind: 'error'; message: string };

export interface TrailShareModalProps {
  /**
   * Trail metadata. `BaseTrailIndexEntry` covers both local
   * (`TrailIndexEntry`) and remote (`SharedTrailIndexEntry`) entries —
   * the modal only reads fields from the base shape.
   */
  trail: BaseTrailIndexEntry;
  /**
   * Required when the modal will run the share IPC (no `initialUrl`).
   * Ignored when `initialUrl` is supplied since we skip the share path.
   */
  repositoryPath?: string;
  /**
   * GitHub visibility of the underlying repo. Drives the private-repo
   * security callout in the idle body — only shown when `'private'`.
   * Omit (or pass `'public'` / `undefined`) and the callout is hidden.
   */
  repoVisibility?: 'public' | 'private';
  /**
   * Pre-populated URL — opens the modal directly in success state so the
   * user can copy the link without re-sharing. Used when the trail was
   * shared earlier this session OR when opening the modal from the
   * "Shared with this repo" list.
   */
  initialUrl?: string | null;
  onClose: () => void;
  /**
   * Called with the resulting URL after a successful share so the parent
   * can record it on the local row's "shared" indicator. Not invoked
   * when the modal opened directly in success state (no share happened).
   */
  onShared?: (url: string) => void;
}

export const TrailShareModal: React.FC<TrailShareModalProps> = ({
  trail,
  repositoryPath,
  repoVisibility,
  initialUrl,
  onClose,
  onShared,
}) => {
  const { theme } = useTheme();
  // Auto-share path: user previously chose "Don't show this again" AND we
  // have what we need to run the share IPC (no initialUrl means we're not
  // in re-show mode, and `repositoryPath` is required by the share path).
  const shouldAutoShareRef = useRef(
    !initialUrl && !!repositoryPath && readSkipConfirmation(),
  );
  const [state, setState] = useState<ModalState>(() => {
    if (initialUrl) return { kind: 'success', url: initialUrl };
    if (shouldAutoShareRef.current) return { kind: 'sharing', stepIndex: 0 };
    return { kind: 'idle' };
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [copiedKind, setCopiedKind] = useState<CopiedKind>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timers driving the phased step animation in the sharing body. Tracked
  // so we can clear them if the modal unmounts mid-share.
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      stepTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Esc to close — but only when not in the middle of a share request.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.kind !== 'sharing') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, state.kind]);

  const runShare = useCallback(
    async (allowMissing: boolean) => {
      setState({ kind: 'sharing', stepIndex: 0 });
      // Choreograph the step transitions on a timer. The setState callback
      // is guarded so a late timer can't override a success/error state.
      stepTimersRef.current.forEach(clearTimeout);
      stepTimersRef.current = [
        setTimeout(() => {
          setState((s) =>
            s.kind === 'sharing' ? { kind: 'sharing', stepIndex: 1 } : s,
          );
        }, STEP_1_AT_MS),
        setTimeout(() => {
          setState((s) =>
            s.kind === 'sharing' ? { kind: 'sharing', stepIndex: 2 } : s,
          );
        }, STEP_2_AT_MS),
      ];
      try {
        const sharePromise = TrailShareService.share(trail.id, {
          repositoryPath,
          allowMissing,
        });
        const minDuration = new Promise<void>((resolve) =>
          setTimeout(resolve, MIN_SHARING_MS),
        );
        // Promise.all here means: a fast IPC waits for the choreography to
        // play out, but a rejection (error / missing-files) fails fast and
        // skips the hold — we don't want to delay error states.
        const [result] = await Promise.all([sharePromise, minDuration]);
        // All three steps as "done" for a brief settle frame before the
        // body swaps to success. stepIndex = SHARE_STEPS.length marks every
        // row complete.
        setState({ kind: 'sharing', stepIndex: SHARE_STEPS.length });
        await new Promise<void>((resolve) =>
          setTimeout(resolve, STEPS_DONE_HOLD_MS),
        );
        onShared?.(result.url);
        setState({ kind: 'success', url: result.url });
      } catch (err) {
        if (err instanceof TrailShareError) {
          if (err.code === 'MISSING_FILES_NEEDS_CONFIRM') {
            const missing =
              (err.details as { missing?: string[] } | undefined)?.missing ??
              [];
            setState({ kind: 'missing-files', missing });
            return;
          }
          setState({ kind: 'error', message: err.message });
          return;
        }
        setState({
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Sharing failed unexpectedly.',
        });
      } finally {
        stepTimersRef.current.forEach(clearTimeout);
        stepTimersRef.current = [];
      }
    },
    [onShared, repositoryPath, trail.id],
  );

  const handleConfirm = useCallback(() => {
    if (dontShowAgain) writeSkipConfirmation(true);
    return runShare(false);
  }, [dontShowAgain, runShare]);
  const handleAllowMissing = useCallback(() => runShare(true), [runShare]);
  const handleRetry = useCallback(() => setState({ kind: 'idle' }), []);

  // Kick off the auto-share path once on mount. We guard with the ref so
  // strict-mode double-invocation doesn't fire the IPC twice.
  const autoShareTriggeredRef = useRef(false);
  useEffect(() => {
    if (shouldAutoShareRef.current && !autoShareTriggeredRef.current) {
      autoShareTriggeredRef.current = true;
      void runShare(false);
    }
  }, [runShare]);

  const handleCopy = useCallback(async (text: string, kind: CopiedKind) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(
        () => setCopiedKind(null),
        COPY_FEEDBACK_MS,
      );
    } catch {
      // navigator.clipboard can fail in restricted webviews — fall back to
      // surfacing the value for manual copy. The textarea is already visible.
    }
  }, []);

  const handleOpenInBrowser = useCallback((url: string) => {
    window.mainProcess?.shell?.openExternal(url);
  }, []);

  // Render through a portal at document.body so the modal escapes any
  // ancestor `overflow: hidden`, `transform`, or `contain` that would
  // otherwise contain `position: fixed`. Matches `KeychainConsentModal`.
  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && state.kind !== 'sharing') {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <Share2 size={20} color={theme.colors.primary} />
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              flex: 1,
            }}
          >
            Share trail
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={state.kind === 'sharing'}
            title="Close"
            aria-label="Close"
            style={{
              padding: '4px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: state.kind === 'sharing' ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Trail name — only shown for in-flight / error states. The idle
            body leads with a value-prop intro instead, and the success
            state's action buttons speak for themselves. */}
        {state.kind !== 'success' && state.kind !== 'idle' && (
          <div
            style={{
              fontSize: theme.fontSizes[3],
              fontWeight: theme.fontWeights.medium,
              lineHeight: 1.3,
              marginBottom: '20px',
            }}
          >
            {trail.title || 'Untitled trail'}
          </div>
        )}

        {/* Body — varies by state */}
        {state.kind === 'idle' && (
          <IdleBody
            theme={theme}
            isPrivate={repoVisibility === 'private'}
            dontShowAgain={dontShowAgain}
            onDontShowAgainChange={setDontShowAgain}
            onConfirm={handleConfirm}
            onCancel={onClose}
          />
        )}

        {state.kind === 'sharing' && (
          <SharingBody theme={theme} stepIndex={state.stepIndex} />
        )}

        {state.kind === 'missing-files' && (
          <MissingFilesBody
            theme={theme}
            missing={state.missing}
            onCancel={onClose}
            onConfirm={handleAllowMissing}
          />
        )}

        {state.kind === 'success' && (
          <SuccessBody
            theme={theme}
            url={state.url}
            agentCommand={buildAgentCommand(trail.id)}
            copiedKind={copiedKind}
            onCopyUrl={() => handleCopy(state.url, 'url')}
            onCopyAgent={() =>
              handleCopy(buildAgentCommand(trail.id), 'agent')
            }
            onOpenExternal={() => handleOpenInBrowser(state.url)}
          />
        )}

        {state.kind === 'error' && (
          <ErrorBody
            theme={theme}
            message={state.message}
            onCancel={onClose}
            onRetry={handleRetry}
          />
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// ---------------------------------------------------------------------------
// State bodies
// ---------------------------------------------------------------------------

type Theme = ReturnType<typeof useTheme>['theme'];

const IdleBody: React.FC<{
  theme: Theme;
  isPrivate: boolean;
  dontShowAgain: boolean;
  onDontShowAgainChange: (next: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  theme,
  isPrivate,
  dontShowAgain,
  onDontShowAgainChange,
  onConfirm,
  onCancel,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
  <>
    <p
      style={{
        margin: '0 0 16px 0',
        fontSize: theme.fontSizes[2],
        lineHeight: 1.4,
        color: theme.colors.text,
      }}
    >
      Sharing a trail will allow you to get quick feedback from your
      team&apos;s experts.
    </p>
    {isPrivate && (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px',
          borderRadius: '6px',
          background: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          marginBottom: '16px',
        }}
      >
        <Lock
          size={16}
          color={theme.colors.primary}
          style={{ flexShrink: 0, marginTop: '2px' }}
        />
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          This repo is <strong>private</strong> on GitHub — the trail stays
          private to people with read access there. web-ade never serves it
          publicly.
        </div>
      </div>
    )}
    <button
      type="button"
      onClick={() => setDetailsOpen((open) => !open)}
      aria-expanded={detailsOpen}
      style={{
        display: 'inline',
        padding: 0,
        marginBottom: detailsOpen ? '10px' : '20px',
        background: 'transparent',
        border: 'none',
        color: theme.colors.primary,
        cursor: 'pointer',
        fontSize: theme.fontSizes[1],
        fontFamily: 'inherit',
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
      }}
    >
      {detailsOpen ? 'Hide details' : 'Learn more about sharing'}
    </button>
    {detailsOpen && (
      <>
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: theme.fontSizes[2],
            lineHeight: 1.5,
            color: theme.colors.textSecondary,
          }}
        >
          Sharing publishes this trail to <strong>web-ade</strong> so the
          people who can already read this repo on GitHub can view it.
        </p>
        <ul
          style={{
            margin: '0 0 20px 18px',
            padding: 0,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
          }}
        >
          <li>
            Diff snippet contents are baked from your working tree before
            upload.
          </li>
          <li>
            Notes you authored locally are <strong>not</strong> shared — they
            stay private to your machine.
          </li>
          <li>
            You can delete the share later with the trash icon on web-ade.
          </li>
        </ul>
      </>
    )}
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px',
        fontSize: theme.fontSizes[1],
        color: theme.colors.textSecondary,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={dontShowAgain}
        onChange={(e) => onDontShowAgainChange(e.target.checked)}
        style={{ accentColor: theme.colors.primary, cursor: 'pointer' }}
      />
      Don&apos;t show this again
    </label>
    <ButtonRow>
      <SecondaryButton theme={theme} onClick={onCancel}>
        Cancel
      </SecondaryButton>
      <PrimaryButton theme={theme} onClick={onConfirm}>
        <Share2 size={14} />
        Share
      </PrimaryButton>
    </ButtonRow>
  </>
  );
};

const SharingBody: React.FC<{ theme: Theme; stepIndex: number }> = ({
  theme,
  stepIndex,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '12px 4px 16px',
    }}
  >
    {/* Local keyframe for the active-step pulse. Scoped here so it lives
        and dies with the sharing body and doesn't leak into other UI. */}
    <style>{`
      @keyframes trail-share-step-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.55; transform: scale(0.85); }
      }
    `}</style>
    {SHARE_STEPS.map((label, i) => {
      const status: 'done' | 'active' | 'pending' =
        i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
      return (
        <ShareStepRow key={label} theme={theme} status={status} label={label} />
      );
    })}
  </div>
);

const ShareStepRow: React.FC<{
  theme: Theme;
  status: 'done' | 'active' | 'pending';
  label: string;
}> = ({ theme, status, label }) => {
  const done = status === 'done';
  const active = status === 'active';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: done || active ? theme.colors.text : theme.colors.textSecondary,
        opacity: status === 'pending' ? 0.55 : 1,
        transition: 'opacity 200ms ease, color 200ms ease',
        fontSize: theme.fontSizes[2],
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {done ? (
          <Check size={18} color={theme.colors.primary} strokeWidth={2.5} />
        ) : active ? (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: theme.colors.primary,
              animation:
                'trail-share-step-pulse 1.1s ease-in-out infinite',
            }}
          />
        ) : (
          <Circle size={16} color={theme.colors.textSecondary} />
        )}
      </span>
      {label}
    </div>
  );
};

const MissingFilesBody: React.FC<{
  theme: Theme;
  missing: string[];
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ theme, missing, onCancel, onConfirm }) => (
  <>
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px',
        borderRadius: '6px',
        background: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        marginBottom: '16px',
      }}
    >
      <AlertTriangle
        size={16}
        color={theme.colors.warning ?? theme.colors.textSecondary}
        style={{ flexShrink: 0, marginTop: '2px' }}
      />
      <div
        style={{
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {missing.length} diff snippet{missing.length === 1 ? '' : 's'} reference
        files that are missing on your disk. You can share anyway — those
        snippets will upload with empty post-change contents.
      </div>
    </div>
    <ul
      style={{
        margin: '0 0 16px 18px',
        padding: 0,
        maxHeight: '120px',
        overflowY: 'auto',
        fontSize: theme.fontSizes[0],
        fontFamily: theme.fonts.monospace,
        color: theme.colors.textSecondary,
      }}
    >
      {missing.map((m, i) => (
        <li key={i} style={{ wordBreak: 'break-all' }}>
          {m}
        </li>
      ))}
    </ul>
    <ButtonRow>
      <SecondaryButton theme={theme} onClick={onCancel}>
        Cancel
      </SecondaryButton>
      <PrimaryButton theme={theme} onClick={onConfirm}>
        <Share2 size={14} />
        Share anyway
      </PrimaryButton>
    </ButtonRow>
  </>
);

const SuccessBody: React.FC<{
  theme: Theme;
  url: string;
  agentCommand: string;
  copiedKind: CopiedKind;
  onCopyUrl: () => void;
  onCopyAgent: () => void;
  onOpenExternal: () => void;
}> = ({
  theme,
  url,
  agentCommand,
  copiedKind,
  onCopyUrl,
  onCopyAgent,
  onOpenExternal,
}) => {
  const copiedUrl = copiedKind === 'url';
  const copiedAgent = copiedKind === 'agent';
  return (
    <>
      <div style={{ marginTop: '12px' }}>
        <SectionLabel theme={theme}>With humans</SectionLabel>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <ActionButton
          theme={theme}
          onClick={onCopyUrl}
          title={url}
          active={copiedUrl}
        >
          {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
          {copiedUrl ? 'Link copied' : 'Copy link'}
        </ActionButton>
        <ActionButton theme={theme} onClick={onOpenExternal} title={url}>
          <ExternalLink size={14} />
          Open in browser
        </ActionButton>
      </div>
      <SectionLabel theme={theme}>With agents</SectionLabel>
      <div style={{ display: 'flex' }}>
        <ActionButton
          theme={theme}
          onClick={onCopyAgent}
          title={agentCommand}
          active={copiedAgent}
        >
          {copiedAgent ? <Check size={14} /> : <Copy size={14} />}
          {copiedAgent ? 'Command copied' : 'Copy for agents'}
        </ActionButton>
      </div>
    </>
  );
};

const SectionLabel: React.FC<{
  theme: Theme;
  children: React.ReactNode;
}> = ({ theme, children }) => (
  <div
    style={{
      fontSize: theme.fontSizes[0],
      fontWeight: theme.fontWeights.medium,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: theme.colors.textSecondary,
      marginBottom: '6px',
    }}
  >
    {children}
  </div>
);

const ActionButton: React.FC<{
  theme: Theme;
  onClick: () => void;
  title?: string;
  active?: boolean;
  children: React.ReactNode;
}> = ({ theme, onClick, title, active, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      flex: 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '10px 14px',
      borderRadius: '6px',
      border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
      background: theme.colors.backgroundSecondary,
      color: active ? theme.colors.primary : theme.colors.text,
      cursor: 'pointer',
      fontSize: theme.fontSizes[1],
      fontFamily: 'inherit',
    }}
  >
    {children}
  </button>
);

const ErrorBody: React.FC<{
  theme: Theme;
  message: string;
  onCancel: () => void;
  onRetry: () => void;
}> = ({ theme, message, onCancel, onRetry }) => (
  <>
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px',
        borderRadius: '6px',
        background: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.error ?? theme.colors.border}`,
        marginBottom: '20px',
      }}
    >
      <AlertTriangle
        size={16}
        color={theme.colors.error ?? theme.colors.textSecondary}
        style={{ flexShrink: 0, marginTop: '2px' }}
      />
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.text,
          lineHeight: 1.5,
        }}
      >
        {message}
      </div>
    </div>
    <ButtonRow>
      <SecondaryButton theme={theme} onClick={onCancel}>
        Cancel
      </SecondaryButton>
      <PrimaryButton theme={theme} onClick={onRetry}>
        Try again
      </PrimaryButton>
    </ButtonRow>
  </>
);

// ---------------------------------------------------------------------------
// Button helpers
// ---------------------------------------------------------------------------

const ButtonRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
    }}
  >
    {children}
  </div>
);

const PrimaryButton: React.FC<{
  theme: Theme;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ theme, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '8px 14px',
      backgroundColor: theme.colors.primary,
      border: 'none',
      borderRadius: '6px',
      color: theme.colors.background,
      cursor: 'pointer',
      fontSize: theme.fontSizes[1],
      fontWeight: theme.fontWeights.medium,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    }}
  >
    {children}
  </button>
);

const SecondaryButton: React.FC<{
  theme: Theme;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ theme, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '8px 14px',
      backgroundColor: 'transparent',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '6px',
      color: theme.colors.text,
      cursor: 'pointer',
      fontSize: theme.fontSizes[1],
    }}
  >
    {children}
  </button>
);
