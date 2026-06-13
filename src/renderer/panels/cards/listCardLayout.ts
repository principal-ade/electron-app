/**
 * Shared layout constants for the Team/Social list-row cards.
 *
 * Avatar sizing used to be hardcoded per card (mostly 40px, with Following at
 * 32px), which drifted out of sync. Keep the row-avatar size here so every list
 * — CoworkerCard, OrganizationCard, WatchedUser/RepoCard, StarredRepoCard,
 * CollectionCard, FollowingUserCard — stays uniform. The projects section-header
 * avatar is intentionally smaller and is not governed by this value.
 */
export const LIST_AVATAR_SIZE = 32;
