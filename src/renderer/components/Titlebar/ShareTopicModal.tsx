import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Route, UploadCloud, AlertTriangle, Check, X } from 'lucide-react';

/**
 * Confirmation shown before publishing a topic. A topic references trails by
 * id, and web-ade only accepts trails that are already shared — so publishing
 * a topic publishes its unshared trails too. This modal spells that out
 * before anything leaves the machine.
 *
 * It shows on every publish (even when there are no extra trails to share) so
 * sharing is never silent — the user can opt out via "Don't show this again",
 * which persists `topicSharing.skipPublishConfirm`.
 */
/**
 * One of the topic's trails, with its publish status:
 *  - `shared`     — already on web-ade, nothing to do.
 *  - `toPublish`  — local-only, will be published as part of this.
 *  - `unresolved` — referenced by the topic but missing from the local
 *                   library; blocks the publish until removed.
 */
export type TopicTrailStatus = 'shared' | 'toPublish' | 'unresolved';

export interface TopicTrailPlan {
  id: string;
  title: string;
  status: TopicTrailStatus;
}

export interface ShareTopicModalProps {
  topicTitle: string;
  /** Every trail referenced by the topic, with its publish status. */
  trails: TopicTrailPlan[];
  busy: boolean;
  error: string | null;
  /** Receives whether "Don't show this again" was checked at confirm time. */
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
}

export const ShareTopicModal: React.FC<ShareTopicModalProps> = ({
  topicTitle,
  trails,
  busy,
  error,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();
  const toPublishCount = trails.filter((t) => t.status === 'toPublish').length;
  const unresolvedCount = trails.filter((t) => t.status === 'unresolved').length;
  const blocked = unresolvedCount > 0;
  const [dontShowAgain, setDontShowAgain] = useState(false);

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
          <UploadCloud size={16} color={theme.colors.primary} />
          <span
            style={{
              fontSize: theme.fontSizes[3],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
            }}
          >
            Publish topic
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
            fontSize: theme.fontSizes[2],
            color: theme.colors.text,
            lineHeight: 1.5,
          }}
        >
          <div>
            Publishing{' '}
            <strong style={{ color: theme.colors.text }}>{topicTitle}</strong>{' '}
            will make it shareable. A topic can only reference trails that are
            shared, so its trails are published too.
          </div>

          {trails.length === 0 && (
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
              }}
            >
              No trails attached to this topic.
            </div>
          )}

          {trails.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {trails.length} trail{trails.length === 1 ? '' : 's'} in this
                topic
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
                {trails.map((trail) => {
                  // Per-status pill — green for shared, neutral-primary for
                  // "will publish", error for the missing/blocking ones.
                  const pill =
                    trail.status === 'shared'
                      ? { label: 'Shared', color: theme.colors.success ?? theme.colors.primary }
                      : trail.status === 'toPublish'
                        ? { label: 'Will publish', color: theme.colors.primary }
                        : { label: 'Missing', color: theme.colors.error };
                  return (
                    <li
                      key={trail.id}
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
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {trail.title}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: theme.fontSizes[1],
                          fontWeight: theme.fontWeights.medium,
                          color: pill.color,
                          background: `color-mix(in srgb, ${pill.color} 14%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${pill.color} 35%, transparent)`,
                        }}
                      >
                        {pill.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {blocked && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 6,
                background: `color-mix(in srgb, ${theme.colors.error} 12%, transparent)`,
                border: `1px solid ${theme.colors.error}`,
                color: theme.colors.error,
                fontSize: theme.fontSizes[1],
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {unresolvedCount} trail{unresolvedCount === 1 ? '' : 's'} in
                this topic {unresolvedCount === 1 ? "isn't" : "aren't"} in your
                local library and can't be published. Remove{' '}
                {unresolvedCount === 1 ? 'it' : 'them'} from the topic first.
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
                fontSize: theme.fontSizes[1],
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
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '12px 16px',
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Don't show again — only offered when the publish can actually go
              through; a blocked publish must always surface its modal. */}
          {!blocked ? (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: busy ? 'default' : 'pointer',
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                userSelect: 'none',
              }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={dontShowAgain}
                disabled={busy}
                onClick={() => setDontShowAgain((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  borderRadius: 4,
                  border: `1px solid ${dontShowAgain ? theme.colors.primary : theme.colors.border}`,
                  background: dontShowAgain
                    ? theme.colors.primary
                    : theme.colors.backgroundTertiary,
                  color: theme.colors.background,
                  cursor: busy ? 'default' : 'pointer',
                  padding: 0,
                }}
              >
                {dontShowAgain && <Check size={12} strokeWidth={3} />}
              </button>
              Don't show this again
            </label>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
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
              fontSize: theme.fontSizes[2],
              fontFamily: theme.fonts.body,
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(dontShowAgain)}
            disabled={busy || blocked}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: `1px solid ${theme.colors.primary}`,
              background: theme.colors.primary,
              color: theme.colors.background,
              cursor: busy || blocked ? 'default' : 'pointer',
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              opacity: busy || blocked ? 0.6 : 1,
            }}
          >
            {busy
              ? 'Publishing…'
              : toPublishCount > 0
                ? `Publish topic + ${toPublishCount} trail${toPublishCount === 1 ? '' : 's'}`
                : 'Publish topic'}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareTopicModal;
