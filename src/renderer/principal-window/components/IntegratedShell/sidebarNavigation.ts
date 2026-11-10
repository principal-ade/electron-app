import type { SidebarNavigationItem } from '../../../../shared/types/userPreferences.types';

export const SIDEBAR_NAVIGATION_ITEMS: ReadonlyArray<{
  id: SidebarNavigationItem;
  label: string;
}> = [
  { id: 'home-panel', label: 'Home' },
  { id: 'projects', label: 'Projects' },
  { id: 'topics', label: 'Topics' },
  { id: 'subsystem-models', label: 'Models' },
  { id: 'bots', label: 'Bots' },
  { id: 'drawings', label: 'Drawings' },
  { id: 'requests', label: 'Requests' },
  { id: 'onboarding', label: 'Tutorials' },
  { id: 'processes', label: 'Processes' },
  { id: 'skills', label: 'Skills' },
  { id: 'sessions', label: 'Sessions' },
];

export const DEFAULT_SIDEBAR_NAVIGATION_ORDER = SIDEBAR_NAVIGATION_ITEMS.map(
  ({ id }) => id,
);

const sidebarNavigationItemIds = new Set<string>(
  DEFAULT_SIDEBAR_NAVIGATION_ORDER,
);

/** Keep stored order valid across app upgrades and append newly added entries. */
export const resolveSidebarNavigationOrder = (
  savedOrder?: readonly string[],
): SidebarNavigationItem[] => {
  const order: SidebarNavigationItem[] = [];
  for (const id of savedOrder ?? []) {
    if (
      sidebarNavigationItemIds.has(id) &&
      !order.includes(id as SidebarNavigationItem)
    ) {
      order.push(id as SidebarNavigationItem);
    }
  }
  for (const id of DEFAULT_SIDEBAR_NAVIGATION_ORDER) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
};
