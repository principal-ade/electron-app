/**
 * PortalIntentBridge
 *
 * The always-mounted listener on the portal bus (`PortalEventContext`). It turns
 * view-agnostic content-open intents into tabs by calling the existing
 * always-mounted tab contexts — so an emitter that lives *outside* any single
 * view's bus (today: the titlebar URL/paste opener) can open content into a view
 * that may not be mounted yet. A per-view framework bridge can't do this: it is
 * only subscribed while its view is active, so an intent fired from the titlebar
 * while another view is showing would drop on the floor.
 *
 * This renders nothing. It is the seed of the future single `PortalTabsContext`
 * listener (portal-unification Increment 2): when the 3 tab contexts collapse
 * into one, this dispatch logic moves into that context and this file goes away.
 *
 * Destination routing mirrors the titlebar's prior hardcoded behavior: a pasted
 * shared trail opens in Projects (next to repo profiles); a pasted topic opens
 * in Inbox (the shared-content surface). The titlebar still emits its own
 * `panel:switch` on `principalEvents` to bring that view forward.
 */

import { useEffect } from 'react';
import { usePortalEvents } from '../PortalEventContext';
import { useProjectsTabs } from '../contexts/ProjectsTabsContext';
import { useInboxTabs } from '../contexts/InboxTabsContext';
import {
  PORTAL_INTENTS,
  type TrailOpenPayload,
  type TopicOpenPayload,
} from '../../events/portalIntents';

export const PortalIntentBridge: React.FC = () => {
  const { events } = usePortalEvents();
  const { openSharedTrail } = useProjectsTabs();
  const { openTopic } = useInboxTabs();

  useEffect(() => {
    const handleTrailOpen = (event: { payload: TrailOpenPayload }) => {
      // The portal bus only carries shared trails from the titlebar today; a
      // local trail has no cross-view "home" surface, so ignore it here.
      if (event.payload.source === 'shared') {
        openSharedTrail(
          event.payload.trailId,
          event.payload.owner,
          event.payload.repo,
        );
      }
    };
    const handleTopicOpen = (event: { payload: TopicOpenPayload }) => {
      openTopic(event.payload.topicId, event.payload.title);
    };
    events.on(PORTAL_INTENTS.trailOpen, handleTrailOpen);
    events.on(PORTAL_INTENTS.topicOpen, handleTopicOpen);
    return () => {
      events.off(PORTAL_INTENTS.trailOpen, handleTrailOpen);
      events.off(PORTAL_INTENTS.topicOpen, handleTopicOpen);
    };
  }, [events, openSharedTrail, openTopic]);

  return null;
};

export default PortalIntentBridge;
