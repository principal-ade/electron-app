import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { MessagesSquare, PencilRuler, PenTool } from 'lucide-react';
import type { TopicReference } from '@principal-ai/subsystems-core';
import { TopicService } from '../../main-process-api/TopicService';
import { C4SketchService } from '../../main-process-api/C4SketchService';
import { getDrawingSummary } from '../../drawings-view/drawingsStorage';

interface ReferenceRow {
  reference: TopicReference;
  id: string;
  title: string;
  status: 'ready' | 'missing' | 'error';
  /** Resolved `.excalidraw` path, for drawing rows. */
  path?: string;
}

function referenceId(reference: TopicReference): string {
  switch (reference.kind) {
    case 'topic':
      return reference.topicId;
    case 'c4-sketch':
      return reference.sketchId;
    case 'drawing':
      return reference.drawingId;
  }
}

async function resolveReference(
  reference: TopicReference,
): Promise<{ title: string; path?: string } | null> {
  const id = referenceId(reference);
  switch (reference.kind) {
    case 'topic': {
      const topic = await TopicService.getTopic(id);
      return topic ? { title: topic.title } : null;
    }
    case 'c4-sketch': {
      const sketch = await C4SketchService.getSummary(id);
      return sketch ? { title: sketch.title } : null;
    }
    case 'drawing': {
      const drawing = await getDrawingSummary(id);
      return drawing ? { title: drawing.name, path: drawing.path } : null;
    }
  }
}

export interface TopicReferencesRailProps {
  topicId: string;
  width?: React.CSSProperties['width'];
  onOpenTopic: (topicId: string, title: string) => void;
  onOpenSketch: (sketchId: string, title: string) => void;
  /** Omit when the host can't show drawing tabs; drawing rows then can't be opened. */
  onOpenDrawing?: (drawingId: string, title: string, path?: string) => void;
}

function ReferenceSection({
  title,
  icon,
  rows,
  error,
  loading,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  rows: ReferenceRow[];
  error: boolean;
  loading: boolean;
  onOpen?: (row: ReferenceRow) => void;
}) {
  const { theme } = useTheme();
  if (!loading && !error && rows.length === 0) return null;

  return (
    <section aria-label={title} style={{ flexShrink: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 8px 0',
          borderTop: `1px solid ${theme.colors.border}`,
          color: theme.colors.textSecondary,
        }}
      >
        {icon}
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </span>
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}
      >
        {rows.length === 0 ? (
          <span
            style={{
              padding: '4px 8px',
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            {loading ? 'Loading…' : 'References unavailable.'}
          </span>
        ) : (
          rows.map((row) => {
            const openable = row.status === 'ready' && onOpen !== undefined;
            return (
              <div
                key={row.id}
                style={{
                  borderRadius: theme.radii?.[1] || 4,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(event) => {
                  if (!openable) return;
                  event.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  event.currentTarget.style.borderColor = theme.colors.primary;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                  event.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                <button
                  type="button"
                  disabled={!openable}
                  aria-label={
                    openable
                      ? `Open ${row.title} in a new tab`
                      : row.status === 'ready'
                        ? row.title
                        : `${row.title} unavailable`
                  }
                  onClick={() => onOpen?.(row)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    width: '100%',
                    minWidth: 0,
                    padding: 10,
                    border: 'none',
                    background: 'transparent',
                    color:
                      row.status === 'ready'
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                    textAlign: 'left',
                    cursor: openable ? 'pointer' : 'default',
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      fontWeight: 600,
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      fontStyle: row.status === 'ready' ? 'normal' : 'italic',
                    }}
                  >
                    {row.title}
                  </span>
                  {row.status !== 'ready' && (
                    <span style={{ fontSize: theme.fontSizes[0] }}>
                      {row.status === 'missing'
                        ? 'Reference not found'
                        : 'Could not load reference'}
                    </span>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

/** Read-only attachments, separate from any links in the topic's prose. */
export const TopicReferencesRail: React.FC<TopicReferencesRailProps> = ({
  topicId,
  width = 280,
  onOpenTopic,
  onOpenSketch,
  onOpenDrawing,
}) => {
  const { theme } = useTheme();
  const [state, setState] = React.useState<{
    topicId: string;
    rows: ReferenceRow[];
    loading: boolean;
    error: boolean;
  }>({ topicId, rows: [], loading: true, error: false });

  React.useEffect(() => {
    let generation = 0;
    let disposed = false;
    const reload = async () => {
      const current = ++generation;
      try {
        const owner = await TopicService.getTopic(topicId);
        if (disposed || current !== generation) return;
        if (!owner) {
          setState({ topicId, rows: [], loading: false, error: true });
          return;
        }
        const references = [
          ...new Map(
            (owner.references ?? []).map((reference) => [
              `${reference.kind}:${referenceId(reference)}`,
              reference,
            ]),
          ).values(),
        ];
        const rows = await Promise.all(
          references.map(async (reference): Promise<ReferenceRow> => {
            const id = referenceId(reference);
            try {
              const target = await resolveReference(reference);
              return {
                reference,
                id,
                title: target?.title ?? id,
                status: target ? 'ready' : 'missing',
                ...(target?.path ? { path: target.path } : {}),
              };
            } catch {
              return { reference, id, title: id, status: 'error' };
            }
          }),
        );
        if (!disposed && current === generation) {
          setState({ topicId, rows, loading: false, error: false });
        }
      } catch {
        if (!disposed && current === generation) {
          setState({ topicId, rows: [], loading: false, error: true });
        }
      }
    };
    void reload();
    const unsubscribe = TopicService.onTopicChange(() => {
      void reload();
    });
    // Sketch and drawing files may change outside the Electron event bus.
    const onFocus = () => {
      void reload();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      disposed = true;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [topicId]);

  const rows = state.topicId === topicId ? state.rows : [];
  const loading = state.topicId !== topicId || state.loading;
  const error = state.topicId === topicId && state.error;
  if (!loading && !error && rows.length === 0) return null;

  return (
    <aside
      style={{
        width,
        boxSizing: 'border-box',
        flexShrink: 0,
        backgroundColor: theme.colors.background,
      }}
    >
      {error && (
        <div
          role="alert"
          style={{ padding: 8, color: theme.colors.textSecondary }}
        >
          Could not load references.
        </div>
      )}
      <ReferenceSection
        title="C4 sketches"
        icon={<PencilRuler size={14} />}
        rows={rows.filter((row) => row.reference.kind === 'c4-sketch')}
        error={error}
        loading={loading}
        onOpen={(row) => onOpenSketch(row.id, row.title)}
      />
      <ReferenceSection
        title="Drawings"
        icon={<PenTool size={14} />}
        rows={rows.filter((row) => row.reference.kind === 'drawing')}
        error={error}
        loading={loading}
        onOpen={
          onOpenDrawing
            ? (row) => onOpenDrawing(row.id, row.title, row.path)
            : undefined
        }
      />
      <ReferenceSection
        title="Related topics"
        icon={<MessagesSquare size={14} />}
        rows={rows.filter((row) => row.reference.kind === 'topic')}
        error={error}
        loading={loading}
        onOpen={(row) => onOpenTopic(row.id, row.title)}
      />
    </aside>
  );
};
