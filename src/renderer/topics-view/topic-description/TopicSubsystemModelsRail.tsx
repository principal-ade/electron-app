/**
 * TopicSubsystemModelsRail
 *
 * Read-only right-rail section listing the subsystem models a topic concerns.
 * Mirrors {@link TopicProjectsRail}
 * (fanned out from the same right column) and reads the model catalogue from
 * {@link SubsystemModelService}.
 *
 * Associations are stored on the topic (`DraftTopic.subsystemModels`) as local
 * store ids. Topic change broadcasts refresh the linked models.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Network } from 'lucide-react';
import type { TopicSubsystemModelRef } from '@principal-ai/subsystems-core/node';
import type { SubsystemModelSummary } from '../../../shared/tipc/subsystemModelRouterTypes';
import { TopicService } from '../../main-process-api/TopicService';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';

export interface TopicSubsystemModelsRailProps {
  topicId: string;
  width?: React.CSSProperties['width'];
  onOpenModel: (modelId: string, title: string) => void;
}

export const TopicSubsystemModelsRail: React.FC<
  TopicSubsystemModelsRailProps
> = ({ topicId, width = 280, onOpenModel }) => {
  const { theme } = useTheme();
  const [refs, setRefs] = React.useState<TopicSubsystemModelRef[]>([]);
  const [models, setModels] = React.useState<SubsystemModelSummary[]>([]);

  const reload = React.useCallback(async () => {
    try {
      const topic = await TopicService.getTopic(topicId);
      setRefs(topic?.subsystemModels ?? []);
    } catch (err) {
      console.error('[TopicSubsystemModelsRail] failed to load topic', err);
      setRefs([]);
    }
  }, [topicId]);

  // Load the model catalogue to resolve linked model titles.
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

  const titleFor = (modelId: string): string =>
    models.find((m) => m.id === modelId)?.title ?? modelId;

  if (refs.length === 0) return null;

  return (
    <aside
      style={{
        width,
        boxSizing: 'border-box',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
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
        <Network size={14} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Models
        </span>
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
        {refs.map((ref) => {
          const summary = models.find((m) => m.id === ref.modelId);
          return (
            <div
              key={ref.modelId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: theme.radii?.[1] || 4,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(event) => {
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
                aria-label={`Open ${titleFor(ref.modelId)} in a new tab`}
                onClick={() => onOpenModel(ref.modelId, titleFor(ref.modelId))}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  width: '100%',
                  minWidth: 0,
                  padding: 10,
                  border: 'none',
                  background: 'transparent',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: theme.radii?.[1] || 4,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    fontSize: theme.fontSizes[1],
                    fontWeight: 600,
                    color: summary
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    fontStyle: summary ? 'normal' : 'italic',
                  }}
                >
                  {titleFor(ref.modelId)}
                </span>
                {ref.trailIds && ref.trailIds.length > 0 && (
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default TopicSubsystemModelsRail;
