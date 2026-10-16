/**
 * useProjectsHost
 *
 * The Projects surface's host-level concerns, hoisted out of the retired
 * `ProjectsPanelFramework` so the persistent `WorkspaceShell` can own them
 * (portal-unification Increment 3b). One instance runs for the lifetime of the
 * shell across workspace surfaces, so the Projects activity feed, git-status
 * refresh and delete modal stay live even while Topics is the active view.
 *
 * Responsibilities:
 * - the repository delete modal (opened by `repository-profile:delete*` events
 *   from profile tabs) — an always-mounted home, since the emitting tab can be
 *   acted on while another surface's left panel is showing;
 * - the profile-link `window.open` side-effects;
 * - the local→portal open-intent forwarder (see `installProjectsOpenForwarder`).
 *
 * Open-intent tab creation does NOT live here — the Projects panels emit those
 * on the local bus, the forwarder lifts them to the portal bus, and
 * `PortalIntentBridge` materializes them into the shared bucket.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { DeleteAlexandriaEntryModal } from '../panels/components/DeleteAlexandriaEntryModal';
import type { RepositoryProfileData } from '../panels/RepositoryProfilePanel';
import type { ProjectInfoTab } from '../events/portalTabs';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';
import { usePortalEvents } from '../principal-window/PortalEventContext';
import { installProjectsOpenForwarder } from '../events/portalIntents';

export interface ProjectsHost {
  /** The always-mounted delete-confirmation modal element. */
  deleteModal: React.ReactNode;
}

export function useProjectsHost({
  events,
  repositories,
}: {
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
}): ProjectsHost {
  const { tabs, setTabs, activeTabId, setActiveTabId } = useWorkspaceTabs();
  const { events: portalEvents } = usePortalEvents();

  // --- Profile-link window.open side-effects -------------------------------
  useEffect(() => {
    const handleOpenLink = (event: {
      type: string;
      payload: { url: string; type: string };
    }) => {
      if (
        event.type === 'user-profile:open-link' ||
        event.type === 'org-profile:open-link'
      ) {
        window.open(event.payload.url, '_blank');
      }
    };
    events.on('user-profile:open-link', handleOpenLink);
    events.on('org-profile:open-link', handleOpenLink);
    return () => {
      events.off('user-profile:open-link', handleOpenLink);
      events.off('org-profile:open-link', handleOpenLink);
    };
  }, [events]);

  // --- Local→portal open-intent forwarder ----------------------------------
  useEffect(
    () => installProjectsOpenForwarder(events, portalEvents),
    [events, portalEvents],
  );

  // --- Delete modal --------------------------------------------------------
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<AlexandriaEntry | null>(
    null,
  );
  // Path of the clone whose git status the modal checks (it fetches the status
  // itself so opening stays instant — no blocking git call on the delete click).
  const [deleteClonePath, setDeleteClonePath] = useState<string | null>(null);

  useEffect(() => {
    const handleDeleteRequest = (event: {
      type: string;
      payload: { repository: RepositoryProfileData };
    }) => {
      if (event.type !== 'repository-profile:delete-requested') return;
      const { repository } = event.payload;
      const entry = repositories.find(
        (r) =>
          r.name === repository.name &&
          r.path === repository.localClones?.[0]?.path,
      );
      if (entry) {
        setEntryToDelete(entry);
        setDeleteClonePath(entry.path ?? null);
        setIsDeleteModalOpen(true);
      } else {
        console.warn(
          '[useProjectsHost] Could not find repository to delete:',
          repository.name,
        );
      }
    };
    events.on('repository-profile:delete-requested', handleDeleteRequest);
    return () => {
      events.off('repository-profile:delete-requested', handleDeleteRequest);
    };
  }, [events, repositories]);

  useEffect(() => {
    const handleDeleteCloneRequest = (event: {
      type: string;
      payload: { repository: RepositoryProfileData; clonePath: string };
    }) => {
      if (event.type !== 'repository-profile:delete-clone-requested') return;
      const { repository, clonePath } = event.payload;
      const entry = repositories.find(
        (r) =>
          r.name === repository.name &&
          (r.path === clonePath ||
            ('localClones' in r &&
              Array.isArray(r.localClones) &&
              r.localClones.some((clone) => clone.path === clonePath))),
      );
      if (entry) {
        setEntryToDelete(entry);
        setDeleteClonePath(clonePath);
        setIsDeleteModalOpen(true);
      } else {
        console.warn(
          '[useProjectsHost] Could not find repository clone to delete:',
          repository.name,
          clonePath,
        );
      }
    };
    events.on(
      'repository-profile:delete-clone-requested',
      handleDeleteCloneRequest,
    );
    return () => {
      events.off(
        'repository-profile:delete-clone-requested',
        handleDeleteCloneRequest,
      );
    };
  }, [events, repositories]);

  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setEntryToDelete(null);
    setDeleteClonePath(null);
  }, []);

  const handleConfirmDelete = useCallback(
    async (deleteLocal: boolean) => {
      if (!entryToDelete) return;
      try {
        await AlexandriaService.removeRepository(entryToDelete.path, deleteLocal);

        // If this repo has a project-info tab open, convert it to remote-only
        // (or close it when there's nothing remote to show).
        const openTab = tabs.find(
          (tab) =>
            tab.contentType === 'project-info' &&
            (tab as ProjectInfoTab).localEntry?.path === entryToDelete.path,
        ) as ProjectInfoTab | undefined;

        if (openTab && entryToDelete.github) {
          setTabs((prevTabs) =>
            prevTabs.map((tab) =>
              tab.id === openTab.id
                ? { ...openTab, localEntry: undefined }
                : tab,
            ),
          );
        } else if (openTab && !entryToDelete.github) {
          const remaining = tabs.filter((tab) => tab.id !== openTab.id);
          setTabs(remaining);
          if (activeTabId === openTab.id) {
            // Focus whatever is left; with the landing tab gone an empty bucket
            // means no active tab, which shows the workspace's empty state.
            setActiveTabId(remaining[remaining.length - 1]?.id ?? null);
          }
        }

        events.emit({
          type: 'repository:deleted',
          source: 'projects-host',
          timestamp: Date.now(),
          payload: { repositoryName: entryToDelete.name },
        });
      } catch (error) {
        console.error('[useProjectsHost] Failed to delete repository:', error);
        throw error; // Re-throw so the modal can surface the failure.
      }
    },
    [entryToDelete, tabs, activeTabId, events, setTabs, setActiveTabId],
  );

  const deleteModal = (
    <DeleteAlexandriaEntryModal
      isOpen={isDeleteModalOpen}
      entry={entryToDelete}
      onClose={handleCloseDeleteModal}
      onConfirm={handleConfirmDelete}
      clonePath={deleteClonePath}
    />
  );

  return {
    deleteModal,
  };
}
