/**
 * Inline toast/picker shown when a clicked markdown doc link can't be opened
 * directly:
 *  - `missing`: the path isn't in any of the workspace's project file trees —
 *    a brief auto-dismissing notice.
 *  - `ambiguous`: the path exists in more than one project — a small picker so
 *    the user chooses which project's copy to open.
 *
 * Driven entirely by the `notice` from `useMarkdownLinkHandler`; it renders
 * absolutely positioned at the bottom of its (position: relative) container.
 */

import React, { useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileQuestion, FolderTree, FolderGit2, X } from 'lucide-react';
import type {
  DocLinkCandidate,
  LinkNotice,
} from '../hooks/useMarkdownLinkHandler';

/** A `missing` notice clears itself after this long; `ambiguous` waits for input. */
const MISSING_AUTO_DISMISS_MS = 6000;

export interface MarkdownLinkNoticeProps {
  notice: LinkNotice;
  onDismiss: () => void;
  onChoose: (candidate: DocLinkCandidate) => void;
}

export const MarkdownLinkNotice: React.FC<MarkdownLinkNoticeProps> = ({
  notice,
  onDismiss,
  onChoose,
}) => {
  const { theme } = useTheme();

  useEffect(() => {
    // The `ambiguous` picker waits for the user; informational notices auto-clear.
    if (notice.kind === 'ambiguous') return undefined;
    const timer = setTimeout(onDismiss, MISSING_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  const codeStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[0],
    color: theme.colors.text,
    wordBreak: 'break-all',
  };

  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.backgroundSecondary,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {(() => {
          const iconProps = {
            size: 15,
            color: theme.colors.textSecondary,
            style: { flexShrink: 0, marginTop: 1 },
          };
          if (notice.kind === 'ambiguous') return <FolderTree {...iconProps} />;
          if (notice.kind === 'needs-clone')
            return <FolderGit2 {...iconProps} />;
          return <FileQuestion {...iconProps} />;
        })()}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {notice.kind === 'missing' && (
            <span>
              Couldn&apos;t find <span style={codeStyle}>{notice.path}</span> in
              this workspace&apos;s projects.
            </span>
          )}
          {notice.kind === 'ambiguous' && (
            <span>
              <span style={codeStyle}>{notice.path}</span> exists in multiple
              projects — open which?
            </span>
          )}
          {notice.kind === 'needs-clone' && (
            <span>
              <span style={codeStyle}>{notice.path}</span> lives in{' '}
              <span style={codeStyle}>{notice.repoPurl}</span>, which isn&apos;t
              added to this machine yet. Add the project to open its files.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss"
          aria-label="Dismiss"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            flexShrink: 0,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {notice.kind === 'ambiguous' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {notice.candidates.map((candidate) => (
            <button
              key={candidate.repositoryPath}
              type="button"
              onClick={() => onChoose(candidate)}
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                border: `1px solid ${theme.colors.border}`,
                background: 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.text;
              }}
            >
              {candidate.repoName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarkdownLinkNotice;
