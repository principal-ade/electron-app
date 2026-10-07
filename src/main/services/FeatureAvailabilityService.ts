import type { UserPreferences } from '../../shared/types/userPreferences.types';
import { USER_PREFERENCE_DEFAULTS } from '../../shared/types/userPreferences.types';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';

export type HostedFeature = keyof NonNullable<
  UserPreferences['featureAvailability']
>;

export class FeatureUnavailableError extends Error {
  constructor(feature: HostedFeature) {
    super(`This feature is currently disabled in Settings: ${feature}`);
    this.name = 'FeatureUnavailableError';
  }
}

export async function isHostedFeatureEnabled(
  feature: HostedFeature,
): Promise<boolean> {
  try {
    const preferences =
      await UserPreferencesHandler.getInstance().getUserPreferences();
    return (
      preferences.featureAvailability?.[feature] ??
      USER_PREFERENCE_DEFAULTS.featureAvailability[feature]
    );
  } catch {
    // Services can be constructed before preference initialization (including
    // in isolated tests). Respect the same safe default as a fresh install.
    return USER_PREFERENCE_DEFAULTS.featureAvailability[feature];
  }
}

export async function requireHostedFeature(
  feature: HostedFeature,
): Promise<void> {
  if (!(await isHostedFeatureEnabled(feature))) {
    throw new FeatureUnavailableError(feature);
  }
}
