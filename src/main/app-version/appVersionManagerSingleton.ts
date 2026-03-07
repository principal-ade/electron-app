/**
 * Singleton AppVersionManager
 *
 * Provides a single shared instance of AppVersionManager
 * for use by both TIPC router and legacy handlers.
 */

import AppVersionManager from '../AppVersionManager';

let instance: AppVersionManager | null = null;

export function getAppVersionManagerInstance(): AppVersionManager {
  if (!instance) {
    instance = new AppVersionManager();
  }
  return instance;
}

export function hasAppVersionManagerInstance(): boolean {
  return instance !== null;
}
