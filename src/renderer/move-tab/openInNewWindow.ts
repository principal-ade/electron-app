/**
 * Open a topic, subsystem model, or C4 sketch in its own window from a
 * modifier-click, reusing the detached-tab window host.
 *
 * Unlike a detach, nothing is removed from the source: the entity is opened
 * by identity, so main is asked for an `open`-mode window and the result only
 * matters for user feedback.
 */

import type React from 'react';
import { WindowService } from '../main-process-api/WindowService';
import type {
  DetachableTabDescriptor,
  DetachableTabKind,
  DetachedTabOpenResult,
} from '../../shared/detachedTab';

/** How a reference was activated; `newWindow` is set by Cmd/Ctrl+click. */
export interface OpenGesture {
  newWindow: boolean;
}

export function openGestureFromEvent(
  event: Pick<React.MouseEvent, 'metaKey' | 'ctrlKey'>,
): OpenGesture {
  return { newWindow: event.metaKey || event.ctrlKey };
}

/**
 * Descriptor for an entity opened by identity. Tab ids follow the workspace
 * tab convention so a window opened this way dedupes against a real detach of
 * the same entity.
 */
export function entityTabDescriptor(
  kind: DetachableTabKind,
  id: string,
  title: string,
): DetachableTabDescriptor {
  switch (kind) {
    case 'local-topic':
      return {
        kind,
        tabId: `local-topic-${id}`,
        label: title || 'Topic',
        title,
        topicId: id,
      };
    case 'subsystem-model':
      return {
        kind,
        tabId: `subsystem-model-${id}`,
        label: title || 'Subsystem Model',
        modelId: id,
      };
    case 'c4-sketch':
      return {
        kind,
        tabId: `c4-sketch-${id}`,
        label: title || 'C4 Sketch',
        sketchId: id,
      };
  }
}

export function openEntityInNewWindow(
  kind: DetachableTabKind,
  id: string,
  title: string,
): Promise<DetachedTabOpenResult> {
  return WindowService.openDetachedTab(entityTabDescriptor(kind, id, title), {
    mode: 'open',
  });
}

/**
 * Wrap an inline open handler so a `newWindow` gesture goes to a new window
 * instead. `onFailure` receives a short user-facing message.
 */
export function routeOpenGesture(
  kind: DetachableTabKind,
  openInline: (id: string, title: string) => void,
  onFailure?: (message: string) => void,
): (id: string, title: string, gesture?: OpenGesture) => void {
  return (id, title, gesture) => {
    if (!gesture?.newWindow) {
      openInline(id, title);
      return;
    }
    void openEntityInNewWindow(kind, id, title).then((result) => {
      if (!result.ok) onFailure?.('Could not open a new window');
    });
  };
}
