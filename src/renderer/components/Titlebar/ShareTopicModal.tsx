import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, CheckCircle2, Globe, Lock, UploadCloud, X } from 'lucide-react';
import type { PublishedTopicVisibility } from '../../../shared/main-process-api-interfaces/TopicAPI';

export interface ShareTopicModalProps {
  topicTitle: string;
  busy: boolean;
  error: string | null;
  result?: {
    url: string;
    visibility: PublishedTopicVisibility;
  } | null;
  onConfirm: (
    dontShowAgain: boolean,
    visibility: PublishedTopicVisibility,
  ) => void;
  onCancel: () => void;
}

export const ShareTopicModal: React.FC<ShareTopicModalProps> = ({
  topicTitle,
  busy,
  error,
  result,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [visibility, setVisibility] =
    useState<PublishedTopicVisibility>('private');
  const success = !!result;
  const panelStyle: React.CSSProperties = {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    color: theme.colors.text,
    fontSize: theme.fontSizes[2],
    lineHeight: 1.5,
  };

  return (
    <div
      onClick={busy ? undefined : onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        fontFamily: theme.fonts.body,
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'no-drag',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          {success ? (
            <CheckCircle2
              size={16}
              color={theme.colors.success ?? theme.colors.primary}
            />
          ) : (
            <UploadCloud size={16} color={theme.colors.primary} />
          )}
          <strong
            style={{ fontSize: theme.fontSizes[3], color: theme.colors.text }}
          >
            {success ? 'Topic published' : 'Publish topic'}
          </strong>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={success ? 'Done' : 'Cancel'}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: busy ? 'default' : 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </header>

        {success && result ? (
          <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {result.visibility === 'public' ? (
                <Globe size={14} />
              ) : (
                <Lock size={14} />
              )}
              <span>
                Published as <strong>{result.visibility}</strong>.
              </span>
            </div>
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.backgroundTertiary,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                fontFamily: theme.fonts.monospace ?? 'monospace',
                fontSize: theme.fontSizes[1],
              }}
            >
              {result.url}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: theme.colors.success ?? theme.colors.primary,
                fontSize: theme.fontSizes[1],
              }}
            >
              <Check size={13} strokeWidth={3} />
              Link copied to clipboard
            </div>
          </div>
        ) : (
          <div style={panelStyle}>
            <div>
              Publish <strong>{topicTitle}</strong> to web-ade. Topic sharing
              includes its description and declared projects, not runtime
              trails.
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.semibold,
                  textTransform: 'uppercase',
                }}
              >
                Who can see this
              </span>
              <VisibilityOption
                theme={theme}
                selected={visibility === 'private'}
                disabled={busy}
                onSelect={() => setVisibility('private')}
                icon={<Lock size={14} />}
                label="Private"
                description="Only you and people you send it to can open it."
              />
              <VisibilityOption
                theme={theme}
                selected={visibility === 'public'}
                disabled={busy}
                onSelect={() => setVisibility('public')}
                icon={<Globe size={14} />}
                label="Public"
                description="Anyone with the link can open it; it appears in discovery."
              />
            </div>
            {error && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: `color-mix(in srgb, ${theme.colors.error} 12%, transparent)`,
                  border: `1px solid ${theme.colors.error}`,
                  color: theme.colors.error,
                }}
              >
                {error}
              </div>
            )}
          </div>
        )}

        <footer
          style={{
            display: 'flex',
            justifyContent: success ? 'flex-end' : 'space-between',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          {success ? (
            <button type="button" onClick={onCancel}>
              Done
            </button>
          ) : (
            <>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                }}
              >
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  disabled={busy}
                  onChange={(event) => setDontShowAgain(event.target.checked)}
                />
                Don’t show this again
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={onCancel} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm(dontShowAgain, visibility)}
                  disabled={busy}
                >
                  {busy
                    ? 'Publishing…'
                    : `Publish ${visibility === 'public' ? 'publicly' : 'privately'}`}
                </button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  );
};

const VisibilityOption: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = ({ theme, selected, disabled, onSelect, icon, label, description }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    disabled={disabled}
    onClick={onSelect}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      width: '100%',
      padding: '10px 12px',
      textAlign: 'left',
      borderRadius: 6,
      border: `1px solid ${selected ? theme.colors.primary : theme.colors.border}`,
      background: selected
        ? `color-mix(in srgb, ${theme.colors.primary} 10%, transparent)`
        : theme.colors.backgroundTertiary,
      color: theme.colors.text,
      cursor: disabled ? 'default' : 'pointer',
      fontFamily: theme.fonts.body,
    }}
  >
    <span
      style={{
        color: selected ? theme.colors.primary : theme.colors.textSecondary,
      }}
    >
      {icon}
    </span>
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <strong>{label}</strong>
      <span
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
        }}
      >
        {description}
      </span>
    </span>
  </button>
);

export default ShareTopicModal;
