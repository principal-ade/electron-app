import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertTriangle,
  Check,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Plus,
  Search,
  Send,
  Share2,
  Users,
  X,
} from 'lucide-react';
import type { BaseTrailIndexEntry } from '@industry-theme/file-city-panel';
import { TrailShareError } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailShareService } from '../../services/TrailShareService';
import { GitService } from '../../main-process-api/GitService';
import { GithubService } from '../../main-process-api/GithubService';
import { WebAdeService } from '../../main-process-api/WebAdeService';

const COPY_FEEDBACK_MS = 1500;

// Persisted "Don't show this again" preference for the pre-share
// confirmation. Scoped by the repo's git origin URL so toggling skip in
// one repo doesn't silently auto-share trails from a different repo the
// user hasn't reviewed yet. When set, the modal opens directly in
// `sharing` state and fires the share IPC on mount — the user still sees
// spinner / success / error feedback, just not the explanatory step.
const SKIP_CONFIRMATION_KEY_PREFIX = 'trail-share.skip-confirmation:';

const storageKeyFor = (remoteUrl: string): string =>
  `${SKIP_CONFIRMATION_KEY_PREFIX}${remoteUrl}`;

const readSkipConfirmation = (remoteUrl: string | null): boolean => {
  if (!remoteUrl) return false;
  try {
    return window.localStorage?.getItem(storageKeyFor(remoteUrl)) === 'true';
  } catch {
    return false;
  }
};

const writeSkipConfirmation = (
  remoteUrl: string | null,
  value: boolean,
): void => {
  // No remote URL → no stable per-repo identity, so we can't honor the
  // preference on next open. Silently skip the write rather than fall
  // back to a global key (which would defeat the per-repo scoping).
  if (!remoteUrl) return;
  try {
    const key = storageKeyFor(remoteUrl);
    if (value) {
      window.localStorage?.setItem(key, 'true');
    } else {
      window.localStorage?.removeItem(key);
    }
  } catch {
    // localStorage can throw in restricted webview contexts — fail open.
  }
};

// The CLI's `trail` command accepts either a bare share id or a full
// share URL (see `parseTrailId` in principal-view-core-library — it
// extracts the id from `/trail/<id>`). We pass the URL because it's
// already the single source of truth in success state (both the fresh
// share and the re-open-from-shared-list paths converge on it), and
// because agents can also navigate the URL directly if they prefer.
// Note: passing `trail.id` here would be wrong — that's the LOCAL trail
// index id, which has no meaning to the web-ade backend.
const buildAgentCommand = (shareUrl: string) =>
  `npx -y @principal-ai/principal-view-cli@latest trail ${shareUrl}`;

type CopiedKind = 'url' | 'agent' | null;

const SHARE_STEPS = [
  'Preparing your trail',
  'Uploading',
  'Creating your link',
] as const;
// Step advances are time-driven (the share IPC doesn't expose per-phase
// progress). The total minimum sharing duration is `STEP_2_AT + STEPS_DONE_HOLD`
// so even an instant IPC resolution still plays the full sequence.
const STEP_1_AT_MS = 600;
const STEP_2_AT_MS = 1300;
const MIN_SHARING_MS = 2000;
const STEPS_DONE_HOLD_MS = 400;

type ModalState =
  // Brief async gap on open while we look up the repo's git origin URL
  // to decide whether the per-repo skip-confirmation flag is set. Renders
  // an empty body so users who previously opted in don't see the idle
  // confirmation flash before auto-sharing kicks in.
  | { kind: 'resolving-scope' }
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
  // Per-repo skip flag is keyed by git origin URL, which we have to
  // resolve via IPC. While that's in flight we render an empty body
  // (`resolving-scope`) so users who opted in don't briefly see the
  // confirmation step before auto-share kicks in. The share path also
  // requires `repositoryPath`; without it we go straight to idle.
  const needsScopeLookup = !initialUrl && !!repositoryPath;
  const [state, setState] = useState<ModalState>(() => {
    if (initialUrl) return { kind: 'success', url: initialUrl };
    if (needsScopeLookup) return { kind: 'resolving-scope' };
    return { kind: 'idle' };
  });
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
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

  // States where the modal is mid-operation and Esc / backdrop / close
  // button should be blocked: the scope lookup may flip us into auto-share
  // any moment, and the share request itself is mid-flight.
  const isBusy = state.kind === 'sharing' || state.kind === 'resolving-scope';

  // Esc to close — but only when not in the middle of a share request.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, isBusy]);

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
    if (dontShowAgain) writeSkipConfirmation(remoteUrl, true);
    return runShare(false);
  }, [dontShowAgain, remoteUrl, runShare]);
  const handleAllowMissing = useCallback(() => runShare(true), [runShare]);
  const handleRetry = useCallback(() => setState({ kind: 'idle' }), []);

  // Resolve the repo's git origin URL on mount, then decide whether to
  // auto-share (per-repo skip flag set) or fall through to the idle
  // confirmation step. Guarded against strict-mode double-invocation and
  // unmount-during-flight so we don't fire the share IPC twice or push
  // state into an unmounted modal.
  const scopeLookupStartedRef = useRef(false);
  useEffect(() => {
    if (!needsScopeLookup || !repositoryPath || scopeLookupStartedRef.current)
      return;
    scopeLookupStartedRef.current = true;
    let cancelled = false;
    void (async () => {
      let origin: string | null = null;
      try {
        const info = await GitService.getRepositoryInfo(repositoryPath);
        origin =
          info?.remotes?.find((r) => r.name === 'origin')?.url ?? null;
      } catch {
        // Treat lookup failures as "no scope" — user sees the idle
        // confirmation step and can still share manually.
      }
      if (cancelled) return;
      setRemoteUrl(origin);
      if (readSkipConfirmation(origin)) {
        void runShare(false);
      } else {
        setState((s) => (s.kind === 'resolving-scope' ? { kind: 'idle' } : s));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsScopeLookup, repositoryPath, runShare]);

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
        if (e.target === e.currentTarget && !isBusy) {
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
            disabled={isBusy}
            title="Close"
            aria-label="Close"
            style={{
              padding: '4px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Trail name — only shown for in-flight / error states. The idle
            body leads with a value-prop intro instead, and the success
            state's action buttons speak for themselves. The resolving
            state intentionally renders an empty body so we don't flash
            content before deciding whether to auto-share. */}
        {state.kind !== 'success' &&
          state.kind !== 'idle' &&
          state.kind !== 'resolving-scope' && (
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
            agentCommand={buildAgentCommand(state.url)}
            copiedKind={copiedKind}
            repositoryPath={repositoryPath}
            onCopyUrl={() => handleCopy(state.url, 'url')}
            onCopyAgent={() =>
              handleCopy(buildAgentCommand(state.url), 'agent')
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
      Send a link. They open it in any browser, have all the context, and can
      leave a note. No clone, no setup.
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
      {missing.map((m) => (
        <li key={m} style={{ wordBreak: 'break-all' }}>
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

// ---------------------------------------------------------------------------
// Send-to-people section (rendered inside the success state)
// ---------------------------------------------------------------------------

// Parse the web-ade share id from a share URL (`…/trail/<id>`). This is the
// id `/api/trails/by-id/{id}/send` keys on — NOT the local trail-index id.
const parseShareId = (url: string): string | null => {
  try {
    const { pathname } = new URL(url);
    const m = pathname.match(/\/trail\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
};

// Pull owner/repo out of a GitHub origin remote URL. Mirrors the main
// process `parseGitRemoteUrl` patterns so the picker can list collaborators
// without another IPC round-trip.
const parseOwnerRepo = (
  remoteUrl: string | null,
): { owner: string; repo: string } | null => {
  if (!remoteUrl) return null;
  const patterns = [
    /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
  ];
  for (const p of patterns) {
    const m = remoteUrl.match(p);
    if (m) return { owner: m[1], repo: m[2] };
  }
  return null;
};

interface Recipient {
  login: string;
  avatarUrl?: string;
}

type SendState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'sending' }
  | {
      kind: 'sent';
      delivered: number;
      failed: Array<{ login: string; reason: string }>;
    }
  | { kind: 'error'; message: string };

const FAILURE_LABEL: Record<string, string> = {
  unknown_user: 'no such GitHub user',
  invalid_login: 'invalid login',
};

/**
 * Recipient picker shown after a successful share. Seeds from the repo's
 * collaborators (everyone selected by default), and falls back to manual
 * GitHub-login entry when collaborators can't be enumerated — which is the
 * common case for a reader, since GitHub gates the collaborators endpoint
 * behind write/maintain/admin access.
 */
const SendToPeopleSection: React.FC<{
  theme: Theme;
  shareUrl: string;
  repositoryPath?: string;
}> = ({ theme, shareUrl, repositoryPath }) => {
  const [people, setPeople] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Whether the repo's collaborators could be listed. Drives the
  // "couldn't list collaborators" hint above the search box — the search
  // box itself is always shown so any user can be added regardless.
  const [collaboratorsListed, setCollaboratorsListed] = useState(true);
  // Current GitHub login, lowercased — used to keep the sender out of
  // both the suggestion list and the search results.
  const [selfLogin, setSelfLogin] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  // Search starts collapsed behind a "+ Add" pill so the field only
  // appears when the user wants to add someone beyond the suggestions.
  const [searchOpen, setSearchOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<SendState>({ kind: 'loading' });

  const shareId = useMemo(() => parseShareId(shareUrl), [shareUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // No repo path → can't resolve owner/repo, so we can't enumerate
      // collaborators. The search box still lets the user add anyone.
      if (!repositoryPath) {
        if (!cancelled) {
          setCollaboratorsListed(false);
          setState({ kind: 'ready' });
        }
        return;
      }
      try {
        const info = await GitService.getRepositoryInfo(repositoryPath);
        const origin =
          info?.remotes?.find((r) => r.name === 'origin')?.url ?? null;
        const ownerRepo = parseOwnerRepo(origin);
        if (!ownerRepo) {
          if (!cancelled) {
            setCollaboratorsListed(false);
            setState({ kind: 'ready' });
          }
          return;
        }
        const [{ collaborators, forbidden }, currentUser] = await Promise.all([
          GithubService.getRepositoryCollaborators(
            ownerRepo.owner,
            ownerRepo.repo,
          ),
          GithubService.getCurrentUser(),
        ]);
        if (cancelled) return;
        const self = currentUser?.login?.toLowerCase() ?? null;
        setSelfLogin(self);
        // Drop yourself — sending a trail to your own inbox is pointless.
        const list = collaborators
          .filter((c) => c.login.toLowerCase() !== self)
          .map((c) => ({ login: c.login, avatarUrl: c.avatar_url }));
        setPeople(list);
        // Suggestions start unselected — the user opts people in explicitly.
        setSelected(new Set());
        // Forbidden (reader) or genuinely empty → note that the suggestion
        // list is incomplete so the search box reads as the way forward.
        setCollaboratorsListed(!forbidden && list.length > 0);
        setState({ kind: 'ready' });
      } catch {
        if (cancelled) return;
        setCollaboratorsListed(false);
        setState({ kind: 'ready' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repositoryPath]);

  const toggle = useCallback((login: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(login)) next.delete(login);
      else next.add(login);
      return next;
    });
  }, []);

  // Add a person to the selection (and to the suggestion list if they're
  // not already a chip), then clear the search box. Used by both a search
  // result click and the Enter-to-add-exact-login fallback.
  const addPerson = useCallback((recipient: Recipient) => {
    const login = recipient.login.trim().replace(/^@/, '');
    if (!login) return;
    setPeople((prev) =>
      prev.some((p) => p.login.toLowerCase() === login.toLowerCase())
        ? prev
        : [...prev, { login, avatarUrl: recipient.avatarUrl }],
    );
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(login);
      return next;
    });
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Live GitHub user search, debounced. Skips logins already shown as
  // chips and the sender themselves so the dropdown only surfaces people
  // the user can actually add.
  useEffect(() => {
    const q = searchQuery.trim().replace(/^@/, '');
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { users } = await GithubService.searchUsers(q, { perPage: 6 });
          if (cancelled) return;
          const existing = new Set(people.map((p) => p.login.toLowerCase()));
          const results = users
            .filter(
              (u) =>
                u.login.toLowerCase() !== selfLogin &&
                !existing.has(u.login.toLowerCase()),
            )
            .map((u) => ({ login: u.login, avatarUrl: u.avatar_url }));
          setSearchResults(results);
        } catch {
          if (!cancelled) setSearchResults([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, people, selfLogin]);

  const selectedLogins = useMemo(
    () => people.filter((p) => selected.has(p.login)).map((p) => p.login),
    [people, selected],
  );

  const handleSend = useCallback(async () => {
    if (!shareId) {
      setState({
        kind: 'error',
        message: 'Could not read the share id from the link.',
      });
      return;
    }
    if (selectedLogins.length === 0) return;
    setState({ kind: 'sending' });
    try {
      const res = await WebAdeService.sendTrail({
        shareId,
        recipients: selectedLogins,
        comment: comment.trim() || undefined,
      });
      setState({
        kind: 'sent',
        delivered: res.delivered.length,
        failed: res.failed,
      });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Send failed.',
      });
    }
  }, [shareId, selectedLogins, comment]);

  return (
    <div style={{ marginTop: '20px', borderTop: `1px solid ${theme.colors.border}`, paddingTop: '16px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <SectionLabel theme={theme}>Send to people</SectionLabel>

      {state.kind === 'loading' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
            padding: '4px 0',
          }}
        >
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Finding people with access…
        </div>
      )}

      {state.kind === 'sent' && (
        <div style={{ fontSize: theme.fontSizes[1] }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: theme.colors.primary,
              marginBottom: state.failed.length ? '8px' : 0,
            }}
          >
            <Check size={14} />
            {state.delivered === 1
              ? 'Sent to 1 person'
              : `Sent to ${state.delivered} people`}
          </div>
          {state.failed.length > 0 && (
            <div style={{ color: theme.colors.textSecondary }}>
              Couldn’t deliver to{' '}
              {state.failed
                .map((f) => `${f.login} (${FAILURE_LABEL[f.reason] ?? f.reason})`)
                .join(', ')}
              .
            </div>
          )}
          <button
            type="button"
            onClick={() => setState({ kind: 'ready' })}
            style={{
              marginTop: '10px',
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: theme.colors.primary,
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
            }}
          >
            Send to more people
          </button>
        </div>
      )}

      {(state.kind === 'ready' ||
        state.kind === 'sending' ||
        state.kind === 'error') && (
        <>
          {people.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              {people.map((p) => {
                const isOn = selected.has(p.login);
                return (
                  <button
                    key={p.login}
                    type="button"
                    onClick={() => toggle(p.login)}
                    title={`@${p.login}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px 4px 4px',
                      borderRadius: '999px',
                      border: `1px solid ${isOn ? theme.colors.primary : theme.colors.border}`,
                      background: isOn
                        ? `${theme.colors.primary}1a`
                        : theme.colors.backgroundSecondary,
                      color: isOn ? theme.colors.primary : theme.colors.text,
                      cursor: 'pointer',
                      fontSize: theme.fontSizes[1],
                      fontFamily: 'inherit',
                    }}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt=""
                        width={20}
                        height={20}
                        style={{ borderRadius: '50%' }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: theme.colors.border,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Users size={11} />
                      </span>
                    )}
                    {p.login}
                    {isOn && <Check size={13} />}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            {!searchOpen ? (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px 4px 8px',
                  borderRadius: '999px',
                  border: `1px dashed ${theme.colors.border}`,
                  background: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: theme.fontSizes[1],
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={14} />
                Add
              </button>
            ) : (
              <>
            {!collaboratorsListed && (
              <div
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  marginBottom: '6px',
                }}
              >
                {people.length === 0
                  ? 'Couldn’t list this repo’s collaborators — search to add anyone by GitHub username.'
                  : 'Search to add anyone else by GitHub username.'}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                color={theme.colors.textSecondary}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter with no results yet still adds the typed login —
                  // covers users GitHub search can't surface. Escape collapses
                  // the field back to the pill.
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    e.preventDefault();
                    addPerson({ login: searchQuery });
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setSearchQuery('');
                    setSearchResults([]);
                    setSearchOpen(false);
                  }
                }}
                placeholder="Search people to add…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px 8px 30px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontSize: theme.fontSizes[1],
                  fontFamily: 'inherit',
                }}
              />
              {searching && (
                <Loader2
                  size={14}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    animation: 'spin 1s linear infinite',
                    color: theme.colors.textSecondary,
                  }}
                />
              )}
            </div>
            {searchResults.length > 0 && (
              <div
                style={{
                  marginTop: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '6px',
                  overflow: 'hidden',
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                {searchResults.map((r) => (
                  <button
                    key={r.login}
                    type="button"
                    onClick={() => addPerson(r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text,
                      cursor: 'pointer',
                      fontSize: theme.fontSizes[1],
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    {r.avatarUrl ? (
                      <img
                        src={r.avatarUrl}
                        alt=""
                        width={20}
                        height={20}
                        style={{ borderRadius: '50%' }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: theme.colors.border,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Users size={11} />
                      </span>
                    )}
                    <span style={{ flex: 1 }}>{r.login}</span>
                    <Plus size={14} color={theme.colors.textSecondary} />
                  </button>
                ))}
              </div>
            )}
              </>
            )}
          </div>

          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="Add a note (optional)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontFamily: 'inherit',
              marginBottom: '12px',
            }}
          />

          {state.kind === 'error' && (
            <div
              style={{
                color: theme.colors.error ?? '#e5484d',
                fontSize: theme.fontSizes[0],
                marginBottom: '10px',
              }}
            >
              {state.message}
            </div>
          )}

          <ButtonRow>
            <PrimaryButton
              theme={theme}
              onClick={state.kind === 'sending' ? () => {} : handleSend}
            >
              {state.kind === 'sending' ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Send size={14} />
              )}
              {selectedLogins.length > 0
                ? `Send to ${selectedLogins.length}`
                : 'Send'}
            </PrimaryButton>
          </ButtonRow>
        </>
      )}
    </div>
  );
};

const SuccessBody: React.FC<{
  theme: Theme;
  url: string;
  agentCommand: string;
  copiedKind: CopiedKind;
  repositoryPath?: string;
  onCopyUrl: () => void;
  onCopyAgent: () => void;
  onOpenExternal: () => void;
}> = ({
  theme,
  url,
  agentCommand,
  copiedKind,
  repositoryPath,
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
      <SendToPeopleSection
        theme={theme}
        shareUrl={url}
        repositoryPath={repositoryPath}
      />
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
