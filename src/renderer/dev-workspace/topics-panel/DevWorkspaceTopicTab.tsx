import React, { useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import { TopicDescriptionBody } from '../../alexandria-workspace/topic-description-tab/TopicDescriptionBody';
import { TopicTrailsRail } from '../../alexandria-workspace/topic-description-tab/TopicTrailsRail';
import { TRAIL_EVENT, type TrailActivatedEvent } from '../trail-events';

export interface DevWorkspaceTopicTabProps {
  topicId: string;
  /** Gates the description body's open-time fetch; pass the tab's active flag. */
  isActive: boolean;
  events: PanelEventEmitter;
  /** Workspace whose repos the topic's doc links resolve against (optional). */
  workspaceId?: string;
  /** Current repo, used as a link-resolution fallback (optional). */
  repositoryPath?: string;
}

/**
 * Tab content for a topic opened from the dev-workspace Topics panel. Reuses
 * the chrome-less {@link TopicDescriptionBody} for the markdown description and
 * the shared {@link TopicTrailsRail} for the trails list. Clicking a trail
 * activates it the same way the Trails panel does —
 * `TrailLibraryService.activate` + a {@link TRAIL_EVENT.activated} emit — so
 * File City updates in this window.
 */
export const DevWorkspaceTopicTab: React.FC<DevWorkspaceTopicTabProps> = ({
  topicId,
  isActive,
  events,
  workspaceId,
  repositoryPath,
}) => {
  const { theme } = useTheme();

  const activateTrail = useCallback(
    async (id: string) => {
      const result = await TrailLibraryService.activate(id);
      if (!result) return;
      events.emit<TrailActivatedEvent>({
        type: TRAIL_EVENT.activated,
        source: 'topic-tab',
        timestamp: Date.now(),
        payload: {
          payload: result.payload,
          repositoryPath: result.repositoryPath,
        },
      });
    },
    [events],
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        background: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <div
        style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex' }}
      >
        <TopicDescriptionBody
          topicId={topicId}
          visible={isActive}
          events={events}
          workspaceId={workspaceId}
          repositoryPath={repositoryPath}
        />
      </div>

      <TopicTrailsRail
        topicId={topicId}
        onOpenTrail={(id) => void activateTrail(id)}
        width={260}
      />
    </div>
  );
};
