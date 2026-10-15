/**
 * TopicSubsystemModelsRail
 *
 * Right-rail section listing the subsystem models a topic concerns, plus an
 * inline picker to associate or dissociate them. Mirrors {@link TopicProjectsRail}
 * (fanned out from the same right column) and reads the model catalogue from
 * {@link SubsystemModelService}.
 *
 * Associations are stored on the topic (`DraftTopic.subsystemModels`) as local
 * store ids and updated whole-array via `TopicService.updateTopic`, so every
 * change round-trips through the same store + TOPIC_UPDATED broadcast as a
 * description edit.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Network, Plus, X } from 'lucide-react';
import type { TopicSubsystemModelRef } from '@principal-ai/subsystems-core/node';
import type { SubsystemModelSummary } from '../../../shared/tipc/subsystemModelRouterTypes';
import { TopicService } from '../../main-process-api/TopicService';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';

export interface TopicSubsystemModelsRailProps {
  topicId: string;
  width?: number;
}

export const TopicSubsystemModelsRail: React.FC<
  TopicSubsystemModelsRailProps
> = ({ topicId, width = 280 }) => {
  const { theme } = useTheme();
  const [refs, setRefs] = React.useState<TopicSubsystemModelRef[]>([]);
  const [models, setModels] = React.useState<SubsystemModelSummary[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const topic = await TopicService.getTopic(topicId);
      setRefs(topic?.subsystemModels ?? []);
    } catch (err) {
      console.error('[TopicSubsystemModelsRail] failed to load topic', err);
      setRefs([]);
    }
  }, [topicId]);

  // Model catalogue. Loaded on mount and re-fetched when the picker opens, so a
  // model created earlier in the session shows up without a remount.
  const loadModels = React.useCallback(async () => {
    try {
      const list = await SubsystemModelService.list();
      setModels(list);
    } catch (err) {
      console.error('[TopicSubsystemModelsRail] failed to list models', err);
    }
  }, []);

  React.useEffect(() => {
    void reload();
    void loadModels();
    const off = TopicService.onTopicChange((event) => {
      if ((event.topic?.id ?? event.id) === topicId) void reload();
    });
    return off;
  }, [topicId, reload, loadModels]);

  const persist = React.useCallback(
    async (next: TopicSubsystemModelRef[]) => {
      setBusy(true);
      setError(null);
      try {
        const topic = await TopicService.updateTopic(topicId, {
          subsystemModels: next,
        });
        setRefs(topic.subsystemModels ?? []);
      } catch (err) {
        console.error('[TopicSubsystemModelsRail] failed to update topic', err);
        setError('Could not update topic');
      } finally {
        setBusy(false);
      }
    },
    [topicId],
  );

  const addModel = React.useCallback(
    (modelId: string) => {
      if (refs.some((r) => r.modelId === modelId)) return;
      setAdding(false);
      void persist([...refs, { modelId }]);
    },
    [refs, persist],
  );

  const removeModel = React.useCallback(
    (modelId: string) => {
      void persist(refs.filter((r) => r.modelId !== modelId));
    },
    [refs, persist],
  );

  const titleFor = (modelId: string): string =>
    models.find((m) => m.id === modelId)?.title ?? modelId;

  const available = models.filter((m) => !refs.some((r) => r.modelId === m.id));

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          color: theme.colors.textSecondary,
        }}
      >
        <Network size={14} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Models ({refs.length})
        </span>
        <button
          type="button"
          onClick={() => {
            setAdding((a) => !a);
            void loadModels();
          }}
          disabled={busy}
          title="Associate a subsystem model"
          aria-label="Associate a subsystem model"
          aria-expanded={adding}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            flexShrink: 0,
            padding: 0,
            borderRadius: 6,
            border: `1px solid ${adding ? theme.colors.primary : theme.colors.border}`,
            background: theme.colors.backgroundSecondary,
            color: adding ? theme.colors.primary : theme.colors.text,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 8,
        }}
      >
        {adding && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: 8,
              borderRadius: theme.radii?.[1] || 4,
              border: `1px dashed ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
            }}
          >
            {available.length === 0 ? (
              <span
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                }}
              >
                {models.length === 0
                  ? 'No subsystem models yet.'
                  : 'All models are already linked.'}
              </span>
            ) : (
              available.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addModel(m.id)}
                  disabled={busy}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    padding: '6px 8px',
                    borderRadius: theme.radii?.[1] || 4,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.background,
                    color: theme.colors.text,
                    cursor: busy ? 'default' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.fontSizes[0],
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {m.title}
                  </span>
                  <span
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {m.componentCount} components
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {refs.length === 0 && !adding ? (
          <span
            style={{
              padding: '4px 8px',
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            No models linked.
          </span>
        ) : (
          refs.map((ref) => {
            const summary = models.find((m) => m.id === ref.modelId);
            return (
              <div
                key={ref.modelId}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: 10,
                  borderRadius: theme.radii?.[1] || 4,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: theme.fontSizes[0],
                      fontWeight: 600,
                      color: summary
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontStyle: summary ? 'normal' : 'italic',
                    }}
                    title={ref.modelId}
                  >
                    {titleFor(ref.modelId)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeModel(ref.modelId)}
                    disabled={busy}
                    title="Remove association"
                    aria-label="Remove association"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      padding: 0,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      color: theme.colors.textSecondary,
                      cursor: busy ? 'default' : 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                {summary && (
                  <span
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {summary.componentCount} components
                  </span>
                )}
                {ref.trailIds && ref.trailIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {ref.trailIds.map((trailId) => (
                      <span
                        key={trailId}
                        style={{
                          padding: '1px 6px',
                          borderRadius: 999,
                          border: `1px solid ${theme.colors.border}`,
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {trailId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {error && (
          <span
            style={{
              padding: '4px 8px',
              fontSize: theme.fontSizes[0],
              color: theme.colors.error ?? theme.colors.text,
            }}
          >
            {error}
          </span>
        )}
      </div>
    </aside>
  );
};

export default TopicSubsystemModelsRail;
