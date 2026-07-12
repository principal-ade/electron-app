/**
 * HomeLibrarySubView
 *
 * The "Your Trails & Topics" sub-view: locally-created topics from the
 * TopicService. Trails don't have a local listing API yet, so this shows
 * what's available.
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Footprints, Layers } from 'lucide-react';
import { TopicService } from '../../../main-process-api/TopicService';
import type { DraftTopic as Topic } from '@principal-ai/principal-view-core';
import { SubViewHeader } from './SubViewHeader';

export interface HomeLibrarySubViewProps {
  onBack: () => void;
}

export const HomeLibrarySubView: React.FC<HomeLibrarySubViewProps> = ({
  onBack,
}) => {
  const { theme } = useTheme();
  const [topics, setTopics] = useState<Topic[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    TopicService.getTopics()
      .then((t) => { if (!cancelled) setTopics(t); })
      .catch(() => { if (!cancelled) setTopics([]); });
    return () => { cancelled = true; };
  }, []);

  const loading = topics === null;

  return (
    <>
      <SubViewHeader
        icon={<Footprints size={14} />}
        label="Your Trails & Topics"
        count={loading ? undefined : topics?.length || undefined}
        onBack={onBack}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading ? (
          <ListMessage>Loading your topics…</ListMessage>
        ) : !topics || topics.length === 0 ? (
          <ListMessage>You haven't created any topics yet.</ListMessage>
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
              Topics · {topics.length}
            </div>
            {topics.map((topic) => (
              <TopicRow key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

function TopicRow({ topic }: { topic: Topic }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Layers size={12} style={{ color: theme.colors.textMuted, flexShrink: 0 }} />
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
          {topic.title || 'Untitled Topic'}
        </span>
      </div>
      {topic.trailIds && topic.trailIds.length > 0 && (
        <div
          style={{
            marginTop: 2,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textMuted,
          }}
        >
          {topic.trailIds.length} trail{topic.trailIds.length !== 1 ? 's' : ''}
        </div>
      )}
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
