/**
 * Post-Update Detection
 * Detects whether the current app launch is following an update
 */

import { app } from 'electron';
import Store from 'electron-store';
import log from 'electron-log';

interface UpdateTrackingData {
  lastLaunchedVersion: string;
  pendingUpdateVersion: string | null;
  lastUpdateTimestamp: number | null;
}

interface PostUpdateInfo {
  isPostUpdate: boolean;
  previousVersion: string | null;
  currentVersion: string;
}

const store = new Store<UpdateTrackingData>({
  name: 'update-tracking',
  defaults: {
    lastLaunchedVersion: '',
    pendingUpdateVersion: null,
    lastUpdateTimestamp: null,
  },
});

class PostUpdateDetector {
  private currentVersion: string;
  private _isPostUpdate: boolean | null = null;
  private _previousVersion: string | null = null;

  constructor() {
    this.currentVersion = app.getVersion();
  }

  /**
   * Check if this is a post-update launch
   * Should be called early in app startup
   */
  public checkForPostUpdate(): PostUpdateInfo {
    if (this._isPostUpdate !== null) {
      // Already checked
      return {
        isPostUpdate: this._isPostUpdate,
        previousVersion: this._previousVersion,
        currentVersion: this.currentVersion,
      };
    }

    const lastLaunchedVersion = store.get('lastLaunchedVersion', '');
    const pendingUpdateVersion = store.get('pendingUpdateVersion', null);

    log.info(
      `[PostUpdateDetector] Checking: current=${this.currentVersion}, last=${lastLaunchedVersion}, pending=${pendingUpdateVersion}`,
    );

    // Determine if this is a post-update launch
    // It's a post-update if:
    // 1. We have a stored lastLaunchedVersion
    // 2. The current version is different from the last launched version
    // 3. Either: pending version matches current OR versions just differ (manual update)
    if (lastLaunchedVersion && lastLaunchedVersion !== this.currentVersion) {
      this._isPostUpdate = true;
      this._previousVersion = lastLaunchedVersion;
      log.info(
        `[PostUpdateDetector] Post-update detected: ${lastLaunchedVersion} → ${this.currentVersion}`,
      );
    } else {
      this._isPostUpdate = false;
      this._previousVersion = null;
      log.info('[PostUpdateDetector] Not a post-update launch');
    }

    return {
      isPostUpdate: this._isPostUpdate,
      previousVersion: this._previousVersion,
      currentVersion: this.currentVersion,
    };
  }

  /**
   * Mark that an update is pending (called before quitAndInstall)
   */
  public markPendingUpdate(version: string): void {
    log.info(`[PostUpdateDetector] Marking pending update to version ${version}`);
    store.set('pendingUpdateVersion', version);
  }

  /**
   * Mark that this version has been launched
   * Should be called after splash screen is shown (or skipped)
   */
  public markVersionLaunched(): void {
    log.info(
      `[PostUpdateDetector] Marking version ${this.currentVersion} as launched`,
    );
    store.set('lastLaunchedVersion', this.currentVersion);
    store.set('pendingUpdateVersion', null);

    if (this._isPostUpdate) {
      store.set('lastUpdateTimestamp', Date.now());
    }
  }

  /**
   * Get update info for splash screen
   */
  public getUpdateInfo(): PostUpdateInfo {
    // Ensure we've checked
    if (this._isPostUpdate === null) {
      return this.checkForPostUpdate();
    }

    return {
      isPostUpdate: this._isPostUpdate,
      previousVersion: this._previousVersion,
      currentVersion: this.currentVersion,
    };
  }

  /**
   * Get the timestamp of the last update
   */
  public getLastUpdateTimestamp(): number | null {
    return store.get('lastUpdateTimestamp', null);
  }
}

// Singleton instance
let postUpdateDetectorInstance: PostUpdateDetector | null = null;

export function getPostUpdateDetector(): PostUpdateDetector {
  if (!postUpdateDetectorInstance) {
    postUpdateDetectorInstance = new PostUpdateDetector();
  }
  return postUpdateDetectorInstance;
}

export function hasPostUpdateDetectorInstance(): boolean {
  return postUpdateDetectorInstance !== null;
}

export type { PostUpdateInfo };
