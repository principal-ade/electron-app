/**
 * Extension Window Main Process API
 *
 * Defines the minimal API surface exposed to the extension browser window.
 */

import type { ExtensionAPI } from './ExtensionAPI';
import type { UserPreferencesAPI } from './UserPreferencesAPI';

export interface ExtensionWindowMainProcessAPI {
  extension: ExtensionAPI;
  userPreferences: UserPreferencesAPI;
}
