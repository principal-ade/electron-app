/**
 * ProjectsTabsContext — module shim.
 *
 * The Projects tab state moved into the unified `PortalTabsContext`
 * (portal-unification Increment 2b): one `PortalTabsProvider` now owns all three
 * surfaces' buckets. This file re-exports the Projects per-surface hook + the
 * provider (aliased) so existing imports keep working unchanged. New code should
 * import from `../PortalTabsContext` directly.
 */
export {
  useProjectsTabs,
  PortalTabsProvider as ProjectsTabsProvider,
} from '../PortalTabsContext';
export type { ProjectsTabsContextValue } from '../PortalTabsContext';
