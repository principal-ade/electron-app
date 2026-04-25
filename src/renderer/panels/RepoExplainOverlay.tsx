/**
 * Side-panel overlays shown by activity panels.
 *
 * - SidePanelOverlay: generic right-side slide-in shell with a header
 *   (title + subtitle + optional right-side controls + close button) and
 *   a content slot.
 * - RepoExplainOverlay: shows an AI-generated commit summary as markdown.
 * - RepoReviewOverlay: shows the diff of a commit via ReviewCommitPanel.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { Loader2, X } from 'lucide-react';
import { ReviewCommitPanel } from './ReviewCommitPanel';
import type { ActivityCommit } from '../hooks/useActivityFeed';

export type ExplainAudience = 'maintainer' | 'non-technical';

interface SidePanelOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  width?: number | string;
  /** When set, render the standard overlay header. Omit to let `children` own the header. */
  header?: {
    title: string | null;
    subtitle?: string;
    controls?: React.ReactNode;
  };
  children: React.ReactNode;
}

export const SidePanelOverlay: React.FC<SidePanelOverlayProps> = ({
  isOpen,
  onClose,
  width = '50%',
  header,
  children,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };

  const closeButton = (
    <button
      onClick={onClose}
      aria-label="Close"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        backgroundColor: header ? 'transparent' : theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 4,
        color: theme.colors.text,
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = header ? 'transparent' : theme.colors.surface;
      }}
    >
      <X size={14} />
    </button>
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width,
        maxWidth: '100%',
        backgroundColor: theme.colors.surface,
        borderLeft: `1px solid ${theme.colors.border}`,
        boxShadow: isOpen ? '-4px 0 16px rgba(0,0,0,0.2)' : 'none',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {header && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderBottom: `1px solid ${theme.colors.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {header.title ?? ''}
            </div>
            {header.subtitle && (
              <div
                style={{
                  fontFamily: theme.fonts?.body,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textMuted,
                }}
              >
                {header.subtitle}
              </div>
            )}
          </div>
          {header.controls}
          {closeButton}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {!header && (
          <div
            style={{
              position: 'absolute',
              top: spacing.md,
              right: spacing.md,
              zIndex: 1,
            }}
          >
            {closeButton}
          </div>
        )}
        {children}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export interface RepoExplainOverlayProps {
  isOpen: boolean;
  repoName: string | null;
  markdown: string | null;
  loading: boolean;
  audience: ExplainAudience;
  onAudienceChange: (audience: ExplainAudience) => void;
  onClose: () => void;
  width?: number | string;
}

export const RepoExplainOverlay: React.FC<RepoExplainOverlayProps> = ({
  isOpen,
  repoName,
  markdown,
  loading,
  audience,
  onAudienceChange,
  onClose,
  width = '50%',
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8 };

  const audienceToggle = (
    <div style={{ display: 'flex', gap: 0, border: `1px solid ${theme.colors.border}`, borderRadius: 4 }}>
      {(['maintainer', 'non-technical'] as const).map((level, i) => {
        const isActive = audience === level;
        return (
          <button
            key={level}
            onClick={() => onAudienceChange(level)}
            style={{
              padding: `${spacing.xs}px ${spacing.sm}px`,
              fontSize: theme.fontSizes[0],
              fontFamily: theme.fonts?.body,
              color: isActive ? theme.colors.background : theme.colors.text,
              backgroundColor: isActive ? theme.colors.primary : 'transparent',
              border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            {level === 'maintainer' ? 'Maintainer' : 'Non-technical'}
          </button>
        );
      })}
    </div>
  );

  return (
    <SidePanelOverlay
      isOpen={isOpen}
      onClose={onClose}
      width={width}
      header={{
        title: repoName ?? 'Explain',
        subtitle: 'AI-generated commit summary',
        controls: audienceToggle,
      }}
    >
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.textMuted,
            gap: spacing.sm,
          }}
        >
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontFamily: theme.fonts?.body, fontSize: theme.fontSizes[1] }}>
            Generating explanation…
          </span>
        </div>
      ) : markdown ? (
        <IndustryMarkdownSlide
          content={markdown}
          slideIdPrefix="repo-explain"
          slideIndex={0}
          isVisible={isOpen}
          theme={theme}
          transparentBackground
          enableKeyboardScrolling={false}
        />
      ) : null}
    </SidePanelOverlay>
  );
};

export interface RepoReviewOverlayProps {
  isOpen: boolean;
  repoPath: string;
  repoName: string;
  githubOwner?: string;
  githubRepoName?: string;
  commit: ActivityCommit | null;
  onClose: () => void;
  width?: number | string;
}

export const RepoReviewOverlay: React.FC<RepoReviewOverlayProps> = ({
  isOpen,
  repoPath,
  repoName,
  githubOwner,
  githubRepoName,
  commit,
  onClose,
  width = '60%',
}) => {
  return (
    <SidePanelOverlay isOpen={isOpen} onClose={onClose} width={width}>
      {commit && (
        <ReviewCommitPanel
          repoPath={repoPath}
          repoName={repoName}
          githubOwner={githubOwner}
          githubRepoName={githubRepoName}
          commit={commit}
        />
      )}
    </SidePanelOverlay>
  );
};

export default RepoExplainOverlay;
