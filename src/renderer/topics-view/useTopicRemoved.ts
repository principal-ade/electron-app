import { useEffect } from 'react';
import { TopicEventType } from '../../shared/main-process-api-interfaces/TopicAPI';
import { TopicService } from '../main-process-api/TopicService';

/** Tab hosts subscribe even when their topic content is inactive or hidden. */
export function useTopicRemoved(onRemoved: (topicId: string) => void): void {
  useEffect(
    () =>
      TopicService.onTopicChange((event) => {
        if (event.type === TopicEventType.REMOVED && event.id) {
          onRemoved(event.id);
        }
      }),
    [onRemoved],
  );
}
