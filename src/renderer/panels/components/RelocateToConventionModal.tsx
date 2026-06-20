import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Loader2, AlertCircle, Check, FolderTree, ArrowRight } from 'lucide-react';

interface RelocateToConventionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Repo folder name, shown in the header. */
  repoName: string;
  /** The owner folder the repo will be moved under. */
  owner: string;
  /** Where the repo lives now (off-convention). */
  currentPath: string;
  /** The canonical `{baseDir}/{owner}/{repo}` location it will move to. */
  expectedPath: string;
  /**
   * Performs the move and resolves to the new path. Should reject with a
   * user-facing message (e.g. the "close the repository window first" guard).
   */
  onRelocate: () => Promise<string>;
  /** Called after a successful move with the new path. */
  onRelocated?: (newPath: string) => void;
}

type Step = 'confirm' | 'moving' | 'done';

/** One row of the before → after path preview. */
const PathRow: React.FC<{
  label: string;
  path: string;
  tone: 'current' | 'target';
}> = ({ label, path, tone }) => {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span
        style={{
          fontSize: `${theme.fontSizes[0]}px`,
          fontWeight: theme.fontWeights.semibold,
          fontFamily: theme.fonts.body,
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '6px',
          border: `1px solid ${
            tone === 'target' ? theme.colors.primary : theme.colors.border
          }`,
          backgroundColor:
            tone === 'target'
              ? `${theme.colors.primary}12`
              : theme.colors.backgroundSecondary,
          color: theme.colors.text,
          fontSize: `${theme.fontSizes[1]}px`,
          fontFamily: theme.fonts.monospace,
          wordBreak: 'break-all',
        }}
      >
        {path}
      </div>
    </div>
  );
};

export const RelocateToConventionModal: React.FC<
  RelocateToConventionModalProps
> = ({
  isOpen,
  onClose,
  repoName,
  owner,
  currentPath,
  expectedPath,
  onRelocate,
  onRelocated,
}) => {
  const { theme } = useTheme();

  const [step, setStep] = useState<Step>('confirm');
  const [error, setError] = useState<string | null>(null);

  // Reset to a clean state whenever the modal is (re)opened.
  useEffect(() => {
    if (!isOpen) {
      setStep('confirm');
      setError(null);
    }
  }, [isOpen]);

  // Esc closes the modal, except mid-move where there's nothing safe to cancel.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'moving') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, step, onClose]);

  const handleRelocate = async () => {
    setError(null);
    setStep('moving');
    try {
      const newPath = await onRelocate();
      setStep('done');
      onRelocated?.(newPath);
      setTimeout(onClose, 1800);
    } catch (err) {
      // Surface the main-process message verbatim — it carries the actionable
      // guidance (e.g. close the open repository window first).
      setError(
        err instanceof Error ? err.message : 'Failed to move the repository.',
      );
      setStep('confirm');
    }
  };

  if (!isOpen) return null;

  const dismiss = step === 'moving' ? undefined : onClose;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={dismiss}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          width: '560px',
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FolderTree size={20} style={{ color: theme.colors.text }} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: `${theme.fontSizes[3]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.text,
                }}
              >
                {step === 'done' ? 'Moved' : 'Move to standard location'}
              </h2>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {step === 'moving'
                  ? `Moving ${repoName}…`
                  : `${owner}/${repoName}`}
              </p>
            </div>
          </div>
          {step !== 'moving' && (
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: theme.colors.textSecondary,
                display: 'flex',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        {step !== 'done' ? (
          <>
            <div
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                This clone isn&apos;t in the{' '}
                <code style={{ fontFamily: theme.fonts.monospace }}>
                  {'{base}/{owner}/{repo}'}
                </code>{' '}
                layout. Move it under its owner folder so it matches your other
                projects. The files move on disk and the repository
                re-registers at its new path.
              </p>

              <PathRow label="Current" path={currentPath} tone="current" />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  color: theme.colors.textSecondary,
                }}
              >
                <ArrowRight size={18} style={{ transform: 'rotate(90deg)' }} />
              </div>
              <PathRow label="New location" path={expectedPath} tone="target" />

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: `${theme.colors.error ?? '#ef4444'}20`,
                    color: theme.colors.error ?? '#ef4444',
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontFamily: theme.fonts.body,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                padding: '16px 20px',
                borderTop: `1px solid ${theme.colors.border}`,
              }}
            >
              <button
                onClick={onClose}
                disabled={step === 'moving'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.text,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  cursor: step === 'moving' ? 'not-allowed' : 'pointer',
                  opacity: step === 'moving' ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRelocate()}
                disabled={step === 'moving'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  cursor: step === 'moving' ? 'not-allowed' : 'pointer',
                  opacity: step === 'moving' ? 0.6 : 1,
                }}
              >
                {step === 'moving' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FolderTree size={16} />
                )}
                {step === 'moving' ? 'Moving…' : 'Move repository'}
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: `${theme.colors.success ?? '#22c55e'}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={32} style={{ color: theme.colors.success ?? '#22c55e' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: `${theme.fontSizes[2]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.text,
                }}
              >
                Moved to {owner}/{repoName}
              </h3>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.monospace,
                  color: theme.colors.textSecondary,
                  wordBreak: 'break-all',
                }}
              >
                {expectedPath}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
