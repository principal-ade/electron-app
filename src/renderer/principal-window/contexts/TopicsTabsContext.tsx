/**
 * TopicsTabsContext — module shim.
 *
 * The Topics tab state moved into the unified `PortalTabsContext`
 * (portal-unification Increment 2b): one `PortalTabsProvider` now owns all three
 * surfaces' buckets. This file re-exports the Topics per-surface hook + the
 * provider (aliased) so existing imports keep working unchanged. New code should
 * import from `../PortalTabsContext` directly.
 */
export {
  useTopicsTabs,
  PortalTabsProvider as TopicsTabsProvider,
} from '../PortalTabsContext';
export type { TopicsTabsContextValue } from '../PortalTabsContext';
