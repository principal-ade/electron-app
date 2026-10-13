/**
 * Shared layout constants for the social list-row cards.
 *
 * Avatar sizing used to be hardcoded per card (mostly 40px, with Following at
 * 32px), which drifted out of sync. Keep the row-avatar size here so every list
 * — e.g. StarredRepoCard — stays uniform. The projects section-header avatar is
 * intentionally small and is not governed by this value.
 */
export const LIST_AVATAR_SIZE = 32;
