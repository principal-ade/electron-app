/**
 * Main → renderer event for build-configuration secret requests.
 *
 * Emitted when an agent hits POST /api/build-configurations/:id/request-secrets.
 * Carries names only — never values.
 */

export const BUILD_SECRETS_REQUESTED = 'build-config:secrets-requested';

export interface BuildSecretsRequestedEvent {
  configId: string;
  configName: string;
  missing: string[];
}
