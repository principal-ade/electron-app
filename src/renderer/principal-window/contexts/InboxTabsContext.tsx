/**
 * InboxTabsContext — module shim.
 *
 * The Inbox tab state moved into the unified `PortalTabsContext`
 * (portal-unification Increment 2b): one `PortalTabsProvider` now owns all three
 * surfaces' buckets. This file re-exports the Inbox per-surface hook + the
 * provider (aliased) so existing imports keep working unchanged. New code should
 * import from `../PortalTabsContext` directly.
 */
export {
  useInboxTabs,
  PortalTabsProvider as InboxTabsProvider,
} from '../PortalTabsContext';
export type { InboxTabsContextValue } from '../PortalTabsContext';
