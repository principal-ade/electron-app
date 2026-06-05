import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Route, Share2, AlertTriangle, X } from 'lucide-react';

/**
 * Confirmation shown before publishing a topic. A topic references trails by
 * id, and web-ade only accepts trails that are already shared — so publishing
 * a topic publishes its unshared trails too. This modal spells that out
 * before anything leaves the machine.
 */
export interface ShareTopicModalProps {
  topicTitle: string;
  /** Titles of trails that will be newly published as part of this. */
  toPublish: string[];
  /** Count of the topic's trails already shared (no action needed). */
  alreadySharedCount: number;
  /** Titles of trails that can't be resolved locally — publishing will fail
   *  until they're removed or recovered. */
  unresolved: string[];
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ShareTopicModal: React.FC<ShareTopicModalProps> = ({
  topicTitle,
  toPublish,
  alreadySharedCount,
  unresolved,
  busy,
  error,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();
  const blocked = unresolved.length > 0;

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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <Share2 size={16} color={theme.colors.primary} />
          <span
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
            }}
          >
            Share topic
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel"
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: busy ? 'default' : 'pointer',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            fontSize: theme.fontSizes[1],
            color: theme.colors.text,
            lineHeight: 1.5,
          }}
        >
          <div>
            Publishing{' '}
            <strong style={{ color: theme.colors.text }}>{topicTitle}</strong>{' '}
            shares it to web-ade. A topic can only reference trails that are
            shared, so its trails are published too.
          </div>

          {toPublish.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[0],
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {toPublish.length} trail{toPublish.length === 1 ? '' : 's'} will
                be published
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {toPublish.map((title) => (
                  <li
                    key={title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <Route size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {alreadySharedCount > 0 && (
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              {alreadySharedCount} trail{alreadySharedCount === 1 ? ' is' : 's are'}{' '}
              already shared.
            </div>
          )}

          {unresolved.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 6,
                background: `color-mix(in srgb, ${theme.colors.error} 12%, transparent)`,
                border: `1px solid ${theme.colors.error}`,
                color: theme.colors.error,
                fontSize: theme.fontSizes[0],
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {unresolved.length} trail{unresolved.length === 1 ? '' : 's'} in
                this topic {unresolved.length === 1 ? "isn't" : "aren't"} in your
                local library and can't be published. Remove{' '}
                {unresolved.length === 1 ? 'it' : 'them'} from the topic first.
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                background: `color-mix(in srgb, ${theme.colors.error} 12%, transparent)`,
                border: `1px solid ${theme.colors.error}`,
                color: theme.colors.error,
                fontSize: theme.fontSizes[0],
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 16px',
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.backgroundTertiary,
              color: theme.colors.text,
              cursor: busy ? 'default' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || blocked}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: `1px solid ${theme.colors.primary}`,
              background: theme.colors.primary,
              color: theme.colors.background,
              cursor: busy || blocked ? 'default' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              opacity: busy || blocked ? 0.6 : 1,
            }}
          >
            {busy
              ? 'Publishing…'
              : toPublish.length > 0
                ? `Publish topic + ${toPublish.length} trail${toPublish.length === 1 ? '' : 's'}`
                : 'Publish topic'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareTopicModal;
