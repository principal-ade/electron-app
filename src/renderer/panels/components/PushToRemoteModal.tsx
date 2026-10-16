import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Loader2, AlertCircle, Check, ArrowUp, CloudUpload } from 'lucide-react';

interface PushToRemoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Repo folder name, shown in the header. */
  repoName: string;
  /** Number of local commits that would be pushed. */
  aheadCount: number;
  /** Current branch, shown in the copy when known. */
  branch?: string;
  /**
   * Performs the push. Resolves with the git result; a `success: false` result
   * is shown inline as an error and the modal stays open.
   */
  onPush: () => Promise<{ success: boolean; message: string }>;
  /** Called after a successful push so the host can refresh its status. */
  onPushed?: () => void;
}

type Step = 'confirm' | 'pushing' | 'done';

export const PushToRemoteModal: React.FC<PushToRemoteModalProps> = ({
  isOpen,
  onClose,
  repoName,
  aheadCount,
  branch,
  onPush,
  onPushed,
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

  // Esc closes the modal, except mid-push where there's nothing safe to cancel.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'pushing') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, step, onClose]);

  const handlePush = async () => {
    setError(null);
    setStep('pushing');
    try {
      const result = await onPush();
      if (!result.success) {
        // Surface git's message verbatim — it carries the actionable reason
        // (rejected / auth failed / nothing to push).
        setError(result.message || 'Push failed.');
        setStep('confirm');
        return;
      }
      setStep('done');
      onPushed?.();
      setTimeout(onClose, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed.');
      setStep('confirm');
    }
  };

  if (!isOpen) return null;

  const commits = `${aheadCount} commit${aheadCount === 1 ? '' : 's'}`;
  const branchLabel = branch ? ` on ${branch}` : '';
  const dismiss = step === 'pushing' ? undefined : onClose;

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
          width: '480px',
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
              <CloudUpload size={20} style={{ color: theme.colors.text }} />
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
                {step === 'done' ? 'Pushed' : 'Push to remote'}
              </h2>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {repoName}
              </p>
            </div>
          </div>
          {step !== 'pushing' && (
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
                Push {commits}
                {branchLabel} to the remote (
                <code style={{ fontFamily: theme.fonts.monospace }}>origin</code>).
                This sends your local commits to the remote branch.
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: `${theme.colors.info ?? '#3b82f6'}15`,
                  border: `1px solid ${theme.colors.info ?? '#3b82f6'}40`,
                  color: theme.colors.info ?? '#3b82f6',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.body,
                }}
              >
                <ArrowUp size={16} style={{ flexShrink: 0 }} />
                <span>{commits} ahead of remote</span>
              </div>

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
                disabled={step === 'pushing'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.text,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  cursor: step === 'pushing' ? 'not-allowed' : 'pointer',
                  opacity: step === 'pushing' ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handlePush()}
                disabled={step === 'pushing'}
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
                  cursor: step === 'pushing' ? 'not-allowed' : 'pointer',
                  opacity: step === 'pushing' ? 0.6 : 1,
                }}
              >
                {step === 'pushing' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CloudUpload size={16} />
                )}
                {step === 'pushing' ? 'Pushing…' : 'Push to remote'}
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
                Pushed to remote
              </h3>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {commits} pushed{branchLabel}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PushToRemoteModal;
