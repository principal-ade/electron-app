/**
 * Workspace-tab → detached-tab descriptor conversion.
 *
 * Kept in the renderer because it reads the renderer-local `WorkspaceTab`
 * union; the shared descriptor itself (the IPC contract) lives in
 * `src/shared/detachedTab.ts`.
 */

import type { WorkspaceTab } from '../principal-window/PortalTabsContext';
import type { DetachableTabDescriptor } from '../../shared/detachedTab';
import { customTabLabel } from '../events/portalTabs';

/**
 * Return the serializable descriptor for a tab that can live in a standalone
 * window, or `null` for tabs that carry live state (terminals, editors,
 * drawings, browsers, …).
 */
export function toDetachableTabDescriptor(
  tab: WorkspaceTab | undefined | null,
): DetachableTabDescriptor | null {
  if (!tab) return null;
  // The rename travels separately from `label` so the destination can
  // reapply it after reopening (which recomputes the default label).
  const customLabel = customTabLabel(tab);
  const renamed = customLabel ? { customLabel } : {};
  switch (tab.contentType) {
    case 'local-topic':
      return {
        kind: 'local-topic',
        tabId: tab.id,
        label: tab.label,
        ...renamed,
        topicId: tab.topicId,
        title: tab.title,
      };
    case 'subsystem-model':
      return {
        kind: 'subsystem-model',
        tabId: tab.id,
        label: tab.label,
        ...renamed,
        modelId: tab.modelId,
      };
    case 'c4-sketch':
      return {
        kind: 'c4-sketch',
        tabId: tab.id,
        label: tab.label,
        ...renamed,
        sketchId: tab.sketchId,
      };
    default:
      return null;
  }
}
