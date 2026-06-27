/**
 * PortalIntentBridge
 *
 * The single always-mounted listener on the portal bus (`PortalEventContext`).
 * It turns view-agnostic content-open intents into tabs by calling the unified
 * `PortalTabsContext` open methods, routing each intent to the surface named in
 * its payload (`surface`). Because it is always mounted (it lives at the
 * `PrincipalApp` level, not inside a view), an intent fired while the target
 * surface isn't the active view still lands — which a per-view framework
 * listener couldn't guarantee.
 *
 * Portal-unification Increment 2c: this replaces the former per-view framework
 * bridges AND the earlier titlebar-only bridge — every open-intent emitter (left
 * panels, the local-topic trails rail, the titlebar) now emits on the portal
 * bus, and this is the only listener. Increment 3 (first cut) then collapsed the
 * Inbox + Topics buckets into one `useWorkspaceTabs()` list hosted by the
 * persistent `WorkspaceShell`; the `inbox`/`topics` surface routing below now
 * targets that shared bucket (Projects stays separate until it folds in too).
 *
 * This renders nothing.
 */

import { useEffect } from 'react';
import { usePortalEvents } from '../PortalEventContext';
import { useProjectsTabs } from '../contexts/ProjectsTabsContext';
import { useInboxTabs } from '../contexts/InboxTabsContext';
import { useTopicsTabs } from '../contexts/TopicsTabsContext';
import {
  PORTAL_INTENTS,
  type TrailOpenPayload,
  type TopicOpenPayload,
} from '../../events/portalIntents';

export const PortalIntentBridge: React.FC = () => {
  const { events } = usePortalEvents();
  const projects = useProjectsTabs();
  const inbox = useInboxTabs();
  const topics = useTopicsTabs();

  useEffect(() => {
    const handleTrailOpen = (event: { payload: TrailOpenPayload }) => {
      const p = event.payload;
      switch (p.surface) {
        case 'projects':
          // Projects only hosts shared trails opened via the bus (pasted URLs).
          projects.openSharedTrail(p.trailId, p.owner, p.repo);
          break;
        case 'inbox':
          if (p.source === 'local') {
            inbox.openLocalTrail(p.trailId, p.title);
          } else {
            inbox.openSharedTrail(p.trailId, p.owner, p.repo);
          }
          break;
        case 'topics':
          // Topics only hosts local trails (a topic's curated trails).
          topics.openLocalTrail(p.trailId, p.title);
          break;
      }
    };
    const handleTopicOpen = (event: { payload: TopicOpenPayload }) => {
      const p = event.payload;
      switch (p.surface) {
        case 'inbox':
          inbox.openTopic(p.topicId, p.title);
          break;
        case 'topics':
          topics.openTopic(p.topicId, p.title);
          break;
        case 'projects':
          // Projects has no topic tabs; nothing to do.
          break;
      }
    };
    events.on(PORTAL_INTENTS.trailOpen, handleTrailOpen);
    events.on(PORTAL_INTENTS.topicOpen, handleTopicOpen);
    return () => {
      events.off(PORTAL_INTENTS.trailOpen, handleTrailOpen);
      events.off(PORTAL_INTENTS.topicOpen, handleTopicOpen);
    };
  }, [events, projects, inbox, topics]);

  return null;
};

export default PortalIntentBridge;
