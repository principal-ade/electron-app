import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Share2,
  X,
} from 'lucide-react';
import type { BaseTrailIndexEntry } from '@industry-theme/file-city-panel';
import { TrailShareError } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailShareService } from '../../services/TrailShareService';

const COPY_FEEDBACK_MS = 1500;

const buildAgentCommand = (trailId: string) =>
  `npx -y @principal-ai/principal-view-cli@latest trail ${trailId}`;

type CopiedKind = 'url' | 'agent' | null;

type ModalState =
  | { kind: 'idle' }
  | { kind: 'sharing' }
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
  initialUrl,
  onClose,
  onShared,
}) => {
  const { theme } = useTheme();
  const openedWithUrl = !!initialUrl;
  const [state, setState] = useState<ModalState>(
    initialUrl ? { kind: 'success', url: initialUrl } : { kind: 'idle' },
  );
  const [copiedKind, setCopiedKind] = useState<CopiedKind>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
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
      setState({ kind: 'sharing' });
      try {
        const result = await TrailShareService.share(trail.id, {
          repositoryPath,
          allowMissing,
        });
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
      }
    },
    [onShared, repositoryPath, trail.id],
  );

  const handleConfirm = useCallback(() => runShare(false), [runShare]);
  const handleAllowMissing = useCallback(() => runShare(true), [runShare]);
  const handleRetry = useCallback(() => setState({ kind: 'idle' }), []);

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

        {/* Trail name */}
        <div
          style={{
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            marginBottom: '4px',
          }}
        >
          {trail.title || 'Untitled trail'}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            marginBottom: '20px',
          }}
        >
          {trail.markerCount} markers
          {trail.hasDiffSnippets ? ' · includes diff snippets' : ''}
        </div>

        {/* Body — varies by state */}
        {state.kind === 'idle' && (
          <IdleBody theme={theme} onConfirm={handleConfirm} onCancel={onClose} />
        )}

        {state.kind === 'sharing' && <SharingBody theme={theme} />}

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
            freshPublish={!openedWithUrl}
            onCopyUrl={() => handleCopy(state.url, 'url')}
            onCopyAgent={() =>
              handleCopy(buildAgentCommand(trail.id), 'agent')
            }
            onOpenExternal={() => handleOpenInBrowser(state.url)}
            onClose={onClose}
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
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ theme, onConfirm, onCancel }) => (
  <>
    <p
      style={{
        margin: '0 0 12px 0',
        fontSize: theme.fontSizes[1],
        lineHeight: 1.5,
        color: theme.colors.textSecondary,
      }}
    >
      Sharing publishes this trail to <strong>web-ade</strong> so anyone with
      GitHub read access to the same repository can view it.
    </p>
    <ul
      style={{
        margin: '0 0 20px 18px',
        padding: 0,
        fontSize: theme.fontSizes[0],
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
      }}
    >
      <li>
        Diff snippet contents are baked from your working tree before upload.
      </li>
      <li>
        Notes you authored locally are <strong>not</strong> shared — they stay
        private to your machine.
      </li>
      <li>You can delete the share later with the trash icon on web-ade.</li>
    </ul>
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

const SharingBody: React.FC<{ theme: Theme }> = ({ theme }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '24px 0',
      color: theme.colors.textSecondary,
      fontSize: theme.fontSizes[1],
    }}
  >
    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
    Baking diff snippets and uploading to web-ade…
  </div>
);

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
  freshPublish: boolean;
  onCopyUrl: () => void;
  onCopyAgent: () => void;
  onOpenExternal: () => void;
  onClose: () => void;
}> = ({
  theme,
  url,
  agentCommand,
  copiedKind,
  freshPublish,
  onCopyUrl,
  onCopyAgent,
  onOpenExternal,
  onClose,
}) => {
  const copiedUrl = copiedKind === 'url';
  const copiedAgent = copiedKind === 'agent';
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: '6px',
          background: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.primary}`,
          marginBottom: '16px',
          color: theme.colors.primary,
          fontSize: theme.fontSizes[1],
        }}
      >
        <Check size={16} />
        {freshPublish
          ? 'Trail published. Local draft removed — the trail now lives at the link below.'
          : 'Trail shared. Anyone with GitHub read access to the repo can view it.'}
      </div>

      <FieldLabel theme={theme}>Link</FieldLabel>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px',
            border: 'none',
            background: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[0],
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onCopyUrl}
          title={copiedUrl ? 'Copied' : 'Copy link'}
          aria-label={copiedUrl ? 'Copied' : 'Copy link'}
          style={{
            padding: '0 12px',
            background: 'transparent',
            border: 'none',
            borderLeft: `1px solid ${theme.colors.border}`,
            color: copiedUrl ? theme.colors.primary : theme.colors.textSecondary,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: theme.fontSizes[0],
          }}
        >
          {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
          {copiedUrl ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={onOpenExternal}
          title="Open in browser"
          aria-label="Open in browser"
          style={{
            padding: '0 12px',
            background: 'transparent',
            border: 'none',
            borderLeft: `1px solid ${theme.colors.border}`,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: theme.fontSizes[0],
          }}
        >
          <ExternalLink size={14} />
        </button>
      </div>

      <FieldLabel theme={theme}>Copy for agents</FieldLabel>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        <input
          type="text"
          readOnly
          value={agentCommand}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px',
            border: 'none',
            background: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[0],
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onCopyAgent}
          title={copiedAgent ? 'Copied' : 'Copy CLI command'}
          aria-label={copiedAgent ? 'Copied' : 'Copy CLI command'}
          style={{
            padding: '0 12px',
            background: 'transparent',
            border: 'none',
            borderLeft: `1px solid ${theme.colors.border}`,
            color: copiedAgent
              ? theme.colors.primary
              : theme.colors.textSecondary,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: theme.fontSizes[0],
          }}
        >
          {copiedAgent ? <Check size={14} /> : <Copy size={14} />}
          {copiedAgent ? 'Copied' : 'Copy'}
        </button>
      </div>

      <ButtonRow>
        <PrimaryButton theme={theme} onClick={onClose}>
          Done
        </PrimaryButton>
      </ButtonRow>
    </>
  );
};

const FieldLabel: React.FC<{
  theme: Theme;
  children: React.ReactNode;
}> = ({ theme, children }) => (
  <div
    style={{
      fontSize: theme.fontSizes[0],
      color: theme.colors.textSecondary,
      marginBottom: '6px',
    }}
  >
    {children}
  </div>
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
