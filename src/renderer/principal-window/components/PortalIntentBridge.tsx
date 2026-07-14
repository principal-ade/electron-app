/**
 * PortalIntentBridge
 *
 * The single always-mounted listener on the portal bus (`PortalEventContext`).
 * It turns view-agnostic content-open intents into tabs by calling the unified
 * `useWorkspaceTabs()` open methods. Because it is always mounted (it lives at
 * the `PrincipalApp` level, not inside a view), an intent fired while the target
 * surface isn't the active view still lands — which a per-view framework
 * listener couldn't guarantee.
 *
 * Portal-unification Increment 3: Projects, Inbox and Topics share ONE bucket,
 * so this is the lone materializer for all three surfaces. Trail/topic intents
 * still discriminate the few surface-specific cases (web-ade `topic` vs local
 * `local-topic`); the Projects open intents (repo / owner / collection /
 * activity / live-activity) are surface-agnostic. The Projects panels emit those
 * on their local bus; `installProjectsOpenForwarder` (in the shell) lifts them
 * onto the portal bus where this bridge picks them up.
 *
 * This renders nothing.
 */

import { useEffect } from 'react';
import { usePortalEvents } from '../PortalEventContext';
import { useWorkspaceTabs } from '../PortalTabsContext';
import {
  PORTAL_INTENTS,
  type TrailOpenPayload,
  type TopicOpenPayload,
  type RepositorySelectedPayload,
  type OwnerSelectedPayload,
  type CollectionSelectedPayload,
  type OwnerActivityRequestedPayload,
  type RepositoryActivityRequestedPayload,
} from '../../events/portalIntents';

export const PortalIntentBridge: React.FC = () => {
  const { events } = usePortalEvents();
  const ws = useWorkspaceTabs();

  useEffect(() => {
    const handleTrailOpen = (event: { payload: TrailOpenPayload }) => {
      const p = event.payload;
      // One shared bucket: a local trail opens in place, a shared (web-ade)
      // trail self-fetches its file tree. `surface` no longer routes buckets.
      if (p.source === 'local') {
        ws.openLocalTrail(p.trailId, p.title);
      } else {
        ws.openSharedTrail(p.trailId, p.owner, p.repo);
      }
    };

    const handleTopicOpen = (event: { payload: TopicOpenPayload }) => {
      const p = event.payload;
      // The one surface distinction that survives: Inbox opens published
      // web-ade topics, Topics opens on-disk local topics.
      if (p.surface === 'topics') {
        ws.openLocalTopic(p.topicId, p.title);
      } else if (p.surface === 'inbox') {
        ws.openWebAdeTopic(p.topicId, p.title);
      }
    };

    const handleRepositorySelected = (event: {
      payload: RepositorySelectedPayload;
    }) => {
      ws.openProjectInfo(event.payload);
    };

    const handleRepositoryGuideOpen = (event: {
      payload: RepositorySelectedPayload;
    }) => {
      ws.openFileCityGuide(event.payload);
    };

    const handleOwnerSelected = (event: { payload: OwnerSelectedPayload }) => {
      const { owner, kind, email } = event.payload;
      if (kind === 'org') {
        ws.openOrgProfile(owner);
      } else {
        ws.openUserProfile(owner, email);
      }
    };

    const handleCollectionSelected = (event: {
      payload: CollectionSelectedPayload;
    }) => {
      ws.openCollectionProfile(event.payload.collection);
    };

    const handleLiveActivityOpen = () => {
      ws.openLiveActivity();
    };

    const handleOwnerActivity = (event: {
      payload: OwnerActivityRequestedPayload;
    }) => {
      ws.openOwnerActivity(event.payload.login, event.payload.accountType);
    };

    const handleRepoActivity = (event: {
      payload: RepositoryActivityRequestedPayload;
    }) => {
      ws.openRepoActivity(event.payload.owner, event.payload.repo);
    };

    events.on(PORTAL_INTENTS.trailOpen, handleTrailOpen);
    events.on(PORTAL_INTENTS.topicOpen, handleTopicOpen);
    events.on(PORTAL_INTENTS.repositorySelected, handleRepositorySelected);
    events.on(PORTAL_INTENTS.repositoryGuideOpen, handleRepositoryGuideOpen);
    events.on(PORTAL_INTENTS.ownerSelected, handleOwnerSelected);
    events.on(PORTAL_INTENTS.collectionSelected, handleCollectionSelected);
    events.on(PORTAL_INTENTS.liveActivityOpen, handleLiveActivityOpen);
    events.on(PORTAL_INTENTS.ownerActivityRequested, handleOwnerActivity);
    events.on(PORTAL_INTENTS.repositoryActivityRequested, handleRepoActivity);
    return () => {
      events.off(PORTAL_INTENTS.trailOpen, handleTrailOpen);
      events.off(PORTAL_INTENTS.topicOpen, handleTopicOpen);
      events.off(PORTAL_INTENTS.repositorySelected, handleRepositorySelected);
      events.off(PORTAL_INTENTS.repositoryGuideOpen, handleRepositoryGuideOpen);
      events.off(PORTAL_INTENTS.ownerSelected, handleOwnerSelected);
      events.off(PORTAL_INTENTS.collectionSelected, handleCollectionSelected);
      events.off(PORTAL_INTENTS.liveActivityOpen, handleLiveActivityOpen);
      events.off(PORTAL_INTENTS.ownerActivityRequested, handleOwnerActivity);
      events.off(
        PORTAL_INTENTS.repositoryActivityRequested,
        handleRepoActivity,
      );
    };
  }, [events, ws]);

  return null;
};

export default PortalIntentBridge;
