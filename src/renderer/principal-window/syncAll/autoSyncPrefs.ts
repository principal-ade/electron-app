import {
  DEFAULT_REPOSITORY_AUTO_SYNC_INTERVAL_MINUTES,
  type UserPreferences,
} from '../../../shared/types/userPreferences.types';

export interface AutoSyncSettings {
  enabled: boolean;
  intervalMinutes: number;
}

/** Interval choices offered in General settings. */
export const AUTO_SYNC_INTERVAL_OPTIONS = [15, 30, 60, 120, 240] as const;

export const DEFAULT_AUTO_SYNC_SETTINGS: AutoSyncSettings = {
  enabled: false,
  intervalMinutes: DEFAULT_REPOSITORY_AUTO_SYNC_INTERVAL_MINUTES,
};

export function normalizeAutoSyncSettings(
  prefs?: Pick<UserPreferences, 'repositoryAutoSync'> | null,
): AutoSyncSettings {
  const stored = prefs?.repositoryAutoSync;
  const minutes =
    typeof stored?.intervalMinutes === 'number' &&
    Number.isFinite(stored.intervalMinutes) &&
    stored.intervalMinutes >= 5
      ? Math.floor(stored.intervalMinutes)
      : DEFAULT_REPOSITORY_AUTO_SYNC_INTERVAL_MINUTES;
  return {
    enabled: stored?.enabled === true,
    intervalMinutes: (AUTO_SYNC_INTERVAL_OPTIONS as readonly number[]).includes(
      minutes,
    )
      ? minutes
      : DEFAULT_REPOSITORY_AUTO_SYNC_INTERVAL_MINUTES,
  };
}

export function formatAutoSyncInterval(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return Number.isInteger(hours)
    ? `${hours} hour${hours === 1 ? '' : 's'}`
    : `${minutes} minutes`;
}
