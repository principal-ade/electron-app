/**
 * useDetachedTabAdopter
 *
 * Main-window side of the detached-tab protocol. Main repeats a lightweight
 * "transfer available" notification until this hook claims the token, so a
 * freshly created principal window cannot miss the event while mounting.
 *
 * The tab is opened in the shared workspace bucket first; only then does the
 * hook accept the transfer, which is what closes the detached window. If the
 * opener throws, it rejects and the detached window (and its tab) stay alive.
 */

import { useEffect, useRef } from 'react';
import { WindowService } from '../main-process-api/WindowService';

export interface DetachedTabOpeners {
  openLocalTopic: (topicId: string, title?: string) => void;
  openSubsystemModel: (modelId: string, title: string) => void;
}

export function useDetachedTabAdopter(openers: DetachedTabOpeners): void {
  const openersRef = useRef(openers);
  useEffect(() => {
    openersRef.current = openers;
  });

  useEffect(() => {
    return WindowService.onIncomingDetachedTab(({ token }) => {
      void (async () => {
        const tab = await WindowService.claimIncomingDetachedTab(token);
        if (!tab) return; // already claimed by another listener
        try {
          if (tab.kind === 'local-topic') {
            if (!tab.topicId) throw new Error('missing topicId');
            openersRef.current.openLocalTopic(tab.topicId, tab.title);
          } else {
            if (!tab.modelId) throw new Error('missing modelId');
            openersRef.current.openSubsystemModel(tab.modelId, tab.label);
          }
          const accepted = await WindowService.acceptIncomingDetachedTab(token);
          if (!accepted) {
            console.warn(
              '[DetachedTab] Main window opened the tab but could not accept the transfer; the detached window stays open.',
            );
          }
        } catch (error) {
          console.error('[DetachedTab] Failed to adopt incoming tab:', error);
          await WindowService.rejectIncomingDetachedTab(token, 'adopt-failed');
        }
      })();
    });
  }, []);
}
