import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type {
  AlexandriaEntry,
  Purl,
} from '@principal-ai/alexandria-core-library';
import { emitTerminalNew, PORTAL_INTENTS } from '../events/portalIntents';
import {
  payloadFromLocalEntry,
  payloadFromPurl,
} from '../events/repositorySelected';
import { findEntriesByPurl } from './alexandriaIdentity';

export type TopicProjectTarget = 'profile' | 'terminal';

/** Alternate gestures need a local checkout; remote-only repos keep the explorer path. */
export function openTopicProject(
  events: PanelEventEmitter,
  repositories: readonly AlexandriaEntry[],
  purl: string,
  target: TopicProjectTarget = 'profile',
): void {
  const matches = findEntriesByPurl(repositories, purl as Purl).filter(
    (entry) => entry.path,
  );
  const local = matches[0];
  if (target === 'terminal' && local) {
    emitTerminalNew(events, 'topic-projects-rail', {
      directory: String(local.path),
      label: local.name,
    });
    return;
  }
  events.emit({
    type: PORTAL_INTENTS.repositorySelected,
    source: 'topic-projects-rail',
    timestamp: Date.now(),
    payload: local
      ? payloadFromLocalEntry(local, matches)
      : payloadFromPurl(purl as Purl),
  });
}
