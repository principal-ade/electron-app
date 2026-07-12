/**
 * HomeBookmarksSubView
 *
 * The "Bookmarks" sub-view. Shows inbox trails (shared with the user) as
 * a proxy for bookmarks since the electron app doesn't have a dedicated
 * bookmarks API yet.
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bookmark, Route } from 'lucide-react';
import { WebAdeService } from '../../../main-process-api/WebAdeService';
import type { InboxIndexEntry } from '../../../../shared/tipc/webAdeRouterTypes';
import { SubViewHeader } from './SubViewHeader';

export interface HomeBookmarksSubViewProps {
  onBack: () => void;
}

export const HomeBookmarksSubView: React.FC<HomeBookmarksSubViewProps> = ({
  onBack,
}) => {
  const { theme } = useTheme();
  const [inboxEntries, setInboxEntries] = useState<InboxIndexEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    WebAdeService.getInbox()
      .then((result) => {
        if (!cancelled) setInboxEntries(result.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setInboxEntries([]);
      });
    return () => { cancelled = true; };
  }, []);

  const loading = inboxEntries === null;

  return (
    <>
      <SubViewHeader
        icon={<Bookmark size={14} />}
        label="Bookmarks"
        count={loading ? undefined : inboxEntries.length || undefined}
        onBack={onBack}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading ? (
          <ListMessage>Loading…</ListMessage>
        ) : inboxEntries.length === 0 ? (
          <ListMessage>
            No bookmarks yet. Shared trails sent to you will appear here.
          </ListMessage>
        ) : (
          <div>
            <div
              style={{
                padding: '6px 16px',
                fontSize: theme.fontSizes[0],
                fontWeight: 600,
                color: theme.colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: `1px solid ${theme.colors.border}`,
                background: theme.colors.backgroundSecondary,
              }}
            >
              Shared with you · {inboxEntries.length}
            </div>
            {inboxEntries.map((entry) => (
              <InboxTrailRow key={entry.trailId} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

function InboxTrailRow({ entry }: { entry: InboxIndexEntry }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Route size={12} style={{ color: theme.colors.textMuted, flexShrink: 0 }} />
        <span
          style={{
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.snapshot?.title ?? entry.trailId}
        </span>
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textMuted,
        }}
      >
        from @{entry.sender?.githubLogin} · {entry.owner}/{entry.repo}
      </div>
    </div>
  );
}

function ListMessage({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '24px 16px',
        color: theme.colors.textMuted,
        fontSize: theme.fontSizes[1],
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
