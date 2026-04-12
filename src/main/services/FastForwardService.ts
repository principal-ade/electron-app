/**
 * FastForwardService
 *
 * Handles automatic fast-forward pulls when webhook events indicate
 * new commits are available on tracked repositories.
 *
 * - Matches webhook repo/branch to locally registered repositories
 * - Auto-pulls if working tree is clean and can fast-forward
 * - Stores pending pull notifications in mailbox if dirty/conflicting
 */

import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { electronCLI } from '../electron-cli-bridge';
import { getManager } from '../repository-monitoring/ipcHandlers';
import { getSkillLockFileService } from '../skills/skillLockFile';
import {
  FastForwardEvent,
  PendingPull,
  PendingPullReason,
  PullResult,
  WebhookNotification,
} from '../../shared/main-process-api-interfaces/FastForwardAPI';

interface WebhookEventData {
  eventId: string;
  event: string;
  deliveryId: string;
  repository: string; // e.g., "owner/repo"
  branch?: string;
  processed: boolean;
  message?: string;
  pusher?: string;
  commitMessage?: string;
}

/**
 * In-memory mailbox for pending pulls and webhook notifications
 */
class PullMailbox {
  private pendingPulls: Map<string, PendingPull> = new Map();
  private pullHistory: PullResult[] = [];
  private webhookNotifications: WebhookNotification[] = [];
  private maxHistorySize = 50;
  private maxNotifications = 100;

  addPending(pull: PendingPull): void {
    // Use repoPath + branch as key to avoid duplicates
    const key = `${pull.repoPath}:${pull.branch}`;
    this.pendingPulls.set(key, pull);
  }

  getPending(): PendingPull[] {
    return Array.from(this.pendingPulls.values());
  }

  removePending(id: string): boolean {
    const entries = Array.from(this.pendingPulls.entries());
    for (const [key, pull] of entries) {
      if (pull.id === id) {
        this.pendingPulls.delete(key);
        return true;
      }
    }
    return false;
  }

  removePendingByRepo(repoPath: string, branch: string): boolean {
    const key = `${repoPath}:${branch}`;
    return this.pendingPulls.delete(key);
  }

  clearAll(): void {
    this.pendingPulls.clear();
  }

  addToHistory(result: PullResult): void {
    this.pullHistory.unshift(result);
    if (this.pullHistory.length > this.maxHistorySize) {
      this.pullHistory = this.pullHistory.slice(0, this.maxHistorySize);
    }
  }

  getHistory(): PullResult[] {
    return [...this.pullHistory];
  }

  // Webhook notification methods
  addNotification(notification: WebhookNotification): void {
    this.webhookNotifications.unshift(notification);
    if (this.webhookNotifications.length > this.maxNotifications) {
      this.webhookNotifications = this.webhookNotifications.slice(
        0,
        this.maxNotifications,
      );
    }
  }

  getNotifications(): WebhookNotification[] {
    return [...this.webhookNotifications];
  }

  removeNotification(id: string): boolean {
    const index = this.webhookNotifications.findIndex((n) => n.id === id);
    if (index >= 0) {
      this.webhookNotifications.splice(index, 1);
      return true;
    }
    return false;
  }

  markNotificationRead(id: string): boolean {
    const notification = this.webhookNotifications.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
      return true;
    }
    return false;
  }
}

class FastForwardService extends EventEmitter {
  private static instance: FastForwardService | null = null;
  private mailbox = new PullMailbox();
  private repoRemoteCache = new Map<string, { owner: string; repo: string }>();

  private constructor() {
    super();
    console.log('[FastForwardService] Initialized');
  }

  static getInstance(): FastForwardService {
    if (!FastForwardService.instance) {
      FastForwardService.instance = new FastForwardService();
    }
    return FastForwardService.instance;
  }

  /**
   * Handle incoming webhook event from GitSyncWebSocketManager
   */
  async handleWebhookEvent(data: WebhookEventData): Promise<void> {
    console.log(
      `[FastForwardService] Handling webhook: ${data.event} for ${data.repository}${data.branch ? `:${data.branch}` : ''}`,
    );

    // Create notification for ALL webhook events
    const notification = this.createNotification(data);
    this.mailbox.addNotification(notification);
    this.broadcastToRenderers(
      FastForwardEvent.ON_WEBHOOK_NOTIFICATION,
      notification,
    );

    // Check for skill updates on push events
    if (data.event === 'push') {
      await this.checkSkillUpdatesForWebhook(data);
    }

    // Only process push events for fast-forward functionality
    if (data.event !== 'push') {
      console.log(
        `[FastForwardService] Non-push event stored: ${data.event}`,
      );
      return;
    }

    if (!data.branch) {
      console.log('[FastForwardService] No branch in webhook, skipping fast-forward');
      return;
    }

    // Find matching local repositories
    const matchingRepos = await this.findMatchingRepos(
      data.repository,
      data.branch,
    );

    if (matchingRepos.length === 0) {
      console.log(
        `[FastForwardService] No matching local repos for ${data.repository}`,
      );
      return;
    }

    console.log(
      `[FastForwardService] Found ${matchingRepos.length} matching repo(s)`,
    );

    // Process each matching repo for fast-forward
    for (const repoPath of matchingRepos) {
      await this.processRepo(repoPath, data, notification.id);
    }
  }

  /**
   * Create a webhook notification from event data
   */
  private createNotification(data: WebhookEventData): WebhookNotification {
    const { title, description } = this.getEventTitleAndDescription(data);

    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event: data.event,
      repository: data.repository,
      branch: data.branch,
      timestamp: Date.now(),
      read: false,
      title,
      description,
      url: this.getEventUrl(data),
      actor: data.pusher,
    };
  }

  /**
   * Generate human-readable title and description for different event types
   */
  private getEventTitleAndDescription(data: WebhookEventData): {
    title: string;
    description?: string;
  } {
    const repo = data.repository.split('/')[1] || data.repository;

    switch (data.event) {
      case 'push':
        return {
          title: `Push to ${repo}`,
          description: data.commitMessage || `New commits on ${data.branch || 'branch'}`,
        };
      case 'pull_request':
        return {
          title: `PR on ${repo}`,
          description: data.message || 'Pull request activity',
        };
      case 'issues':
        return {
          title: `Issue on ${repo}`,
          description: data.message || 'Issue activity',
        };
      case 'create':
        return {
          title: `Created ${data.branch ? `branch ${data.branch}` : 'ref'} on ${repo}`,
          description: `New ${data.branch ? 'branch' : 'reference'} created`,
        };
      case 'delete':
        return {
          title: `Deleted ref on ${repo}`,
          description: data.message || 'Reference deleted',
        };
      case 'installation':
        return {
          title: 'App Installation',
          description: data.message || 'GitHub App installation updated',
        };
      case 'installation_repositories':
        return {
          title: 'Repository Access Changed',
          description: data.message || 'Repository access updated',
        };
      case 'release':
        return {
          title: `Release on ${repo}`,
          description: data.message || 'New release published',
        };
      case 'workflow_run':
        return {
          title: `Workflow on ${repo}`,
          description: data.message || 'GitHub Actions workflow',
        };
      case 'check_run':
        return {
          title: `Check on ${repo}`,
          description: data.message || 'Check run completed',
        };
      case 'check_suite':
        return {
          title: `Check Suite on ${repo}`,
          description: data.message || 'Check suite completed',
        };
      default:
        return {
          title: `${data.event} on ${repo}`,
          description: data.message,
        };
    }
  }

  /**
   * Generate GitHub URL for the event (if possible)
   */
  private getEventUrl(data: WebhookEventData): string | undefined {
    if (!data.repository) return undefined;

    const baseUrl = `https://github.com/${data.repository}`;

    switch (data.event) {
      case 'push':
        return data.branch ? `${baseUrl}/tree/${data.branch}` : baseUrl;
      case 'pull_request':
        return `${baseUrl}/pulls`;
      case 'issues':
        return `${baseUrl}/issues`;
      case 'release':
        return `${baseUrl}/releases`;
      default:
        return baseUrl;
    }
  }

  /**
   * Check if webhook push event affects any installed skills
   */
  private async checkSkillUpdatesForWebhook(
    data: WebhookEventData,
  ): Promise<void> {
    try {
      const lockService = getSkillLockFileService();
      const lockFile = await lockService.readLockFile();

      // Find skills from this repository
      const affectedSkills = Object.entries(lockFile.skills)
        .filter(([_, skill]) => skill.source === data.repository)
        .map(([name, skill]) => ({ name, skill }));

      if (affectedSkills.length === 0) return;

      console.log(
        `[FastForwardService] Webhook affects ${affectedSkills.length} installed skill(s)`,
      );

      // Create skill update notification for each
      for (const { name } of affectedSkills) {
        const notification: WebhookNotification = {
          id: `skill_update_${Date.now()}_${name}_${Math.random().toString(36).substr(2, 9)}`,
          event: 'push',
          repository: data.repository,
          branch: data.branch,
          timestamp: Date.now(),
          read: false,
          type: 'skill_update',
          skillName: name,
          title: `Update available for skill: ${name}`,
          description: data.commitMessage || `New commits on ${data.repository}`,
          url: this.getEventUrl(data),
          actor: data.pusher,
          message: `Update available for skill: ${name}`,
        };

        this.mailbox.addNotification(notification);
        this.broadcastToRenderers(
          FastForwardEvent.ON_WEBHOOK_NOTIFICATION,
          notification,
        );

        console.log(
          `[FastForwardService] Created skill update notification for: ${name}`,
        );
      }
    } catch (error) {
      console.error(
        '[FastForwardService] Error checking skill updates:',
        error,
      );
    }
  }

  /**
   * Find local repos that match the webhook's repository
   */
  private async findMatchingRepos(
    webhookRepo: string,
    webhookBranch: string,
  ): Promise<string[]> {
    const manager = getManager();
    const matching: string[] = [];

    try {
      // Get monitoring status to find all registered repos
      const status = await manager.getMonitoringStatus();

      for (const repo of status.repositories) {
        const repoPath = repo.path;

        // Check if this repo's remote matches the webhook
        const remoteInfo = await this.getRepoRemote(repoPath);
        if (!remoteInfo) continue;

        const repoFullName = `${remoteInfo.owner}/${remoteInfo.repo}`;
        if (repoFullName.toLowerCase() === webhookRepo.toLowerCase()) {
          // Check if current branch matches
          const currentBranch = await this.getCurrentBranch(repoPath);
          if (currentBranch === webhookBranch) {
            matching.push(repoPath);
          } else {
            console.log(
              `[FastForwardService] Repo ${repoPath} on different branch: ${currentBranch} vs ${webhookBranch}`,
            );
          }
        }
      }
    } catch (error) {
      console.error('[FastForwardService] Error finding matching repos:', error);
    }

    return matching;
  }

  /**
   * Get remote owner/repo for a local repository
   */
  private async getRepoRemote(
    repoPath: string,
  ): Promise<{ owner: string; repo: string } | null> {
    // Check cache
    const cached = this.repoRemoteCache.get(repoPath);
    if (cached) return cached;

    try {
      await electronCLI.initialize();
      const remotes = await electronCLI.git.getRemotes(repoPath);
      const origin = remotes.find((r) => r.name === 'origin');

      if (origin?.owner && origin?.repo) {
        const result = { owner: origin.owner, repo: origin.repo };
        this.repoRemoteCache.set(repoPath, result);
        return result;
      }
    } catch (error) {
      console.error(
        `[FastForwardService] Error getting remote for ${repoPath}:`,
        error,
      );
    }

    return null;
  }

  /**
   * Get current branch for a repository
   */
  private async getCurrentBranch(repoPath: string): Promise<string | null> {
    try {
      await electronCLI.initialize();
      return await electronCLI.git.getCurrentBranch(repoPath);
    } catch (error) {
      console.error(
        `[FastForwardService] Error getting branch for ${repoPath}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Process a single repo for potential fast-forward
   */
  private async processRepo(
    repoPath: string,
    webhookData: WebhookEventData,
    notificationId?: string,
  ): Promise<void> {
    console.log(`[FastForwardService] Processing repo: ${repoPath}`);

    try {
      await electronCLI.initialize();
      const git = electronCLI.git;

      // 1. Check git status for uncommitted changes
      const status = await git.getStatus(repoPath);
      // GitStatusWithFiles provides isDirty field
      const isDirty = status.isDirty;

      if (isDirty) {
        console.log(
          `[FastForwardService] Repo ${repoPath} is dirty, adding to mailbox`,
        );
        await this.addPendingPull(repoPath, webhookData, 'dirty', 'Uncommitted changes in working tree', notificationId);
        return;
      }

      // 2. Fetch latest from remote
      console.log(`[FastForwardService] Fetching ${repoPath}...`);
      const fetchSuccess = await git.fetch(repoPath, { timeout: 30000 });

      if (!fetchSuccess) {
        console.log(`[FastForwardService] Fetch failed for ${repoPath}`);
        await this.addPendingPull(repoPath, webhookData, 'fetch_failed', 'Failed to fetch from remote', notificationId);
        return;
      }

      // 3. Check ahead/behind status
      const currentBranch = await git.getCurrentBranch(repoPath);
      if (!currentBranch) {
        console.log(`[FastForwardService] Cannot determine branch for ${repoPath}`);
        return;
      }

      const tracking = await git.getBranchTracking(repoPath, currentBranch);
      if (!tracking) {
        console.log(`[FastForwardService] No tracking branch for ${repoPath}`);
        return;
      }

      const aheadBehind = await git.getAheadBehind(repoPath, currentBranch, tracking);
      if (!aheadBehind) {
        console.log(`[FastForwardService] Cannot get ahead/behind for ${repoPath}`);
        return;
      }

      console.log(
        `[FastForwardService] ${repoPath}: ahead=${aheadBehind.ahead}, behind=${aheadBehind.behind}`,
      );

      // 4. Check if we can fast-forward
      if (aheadBehind.behind === 0) {
        console.log(`[FastForwardService] ${repoPath} is already up to date`);
        return;
      }

      if (aheadBehind.ahead > 0) {
        console.log(
          `[FastForwardService] ${repoPath} has local commits, adding to mailbox`,
        );
        await this.addPendingPull(
          repoPath,
          webhookData,
          'ahead',
          `${aheadBehind.ahead} local commit(s) would need merge/rebase`,
          notificationId,
        );
        return;
      }

      // 5. Fast-forward pull!
      console.log(
        `[FastForwardService] Auto-pulling ${repoPath} (${aheadBehind.behind} commits behind)`,
      );

      const pullResult = await git.pull(repoPath);

      if (pullResult.success) {
        console.log(`[FastForwardService] Successfully pulled ${repoPath}`);

        // Record in history
        const result: PullResult = {
          id: `pull_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          repoPath,
          repoFullName: webhookData.repository,
          branch: webhookData.branch || currentBranch,
          success: true,
          message: `Fast-forwarded ${aheadBehind.behind} commit(s)`,
          commitsBehind: aheadBehind.behind,
          completedAt: Date.now(),
          wasAutomatic: true,
        };
        this.mailbox.addToHistory(result);

        // Notify renderers
        this.broadcastToRenderers(FastForwardEvent.ON_PULL_COMPLETE, result);

        // Refresh the repository in monitoring
        const manager = getManager();
        await manager.refreshRepository(repoPath);
      } else {
        console.error(
          `[FastForwardService] Pull failed for ${repoPath}:`,
          pullResult.stderr,
        );

        await this.addPendingPull(
          repoPath,
          webhookData,
          'unknown',
          `Pull failed: ${pullResult.stderr || 'Unknown error'}`,
          notificationId,
        );
      }
    } catch (error) {
      console.error(`[FastForwardService] Error processing ${repoPath}:`, error);
      await this.addPendingPull(
        repoPath,
        webhookData,
        'unknown',
        error instanceof Error ? error.message : 'Unknown error',
        notificationId,
      );
    }
  }

  /**
   * Add a pending pull to the mailbox and notify renderers
   */
  private async addPendingPull(
    repoPath: string,
    webhookData: WebhookEventData,
    reason: PendingPullReason,
    reasonDetail: string,
    notificationId?: string,
  ): Promise<void> {
    const pull: PendingPull = {
      id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      repoPath,
      repoFullName: webhookData.repository,
      branch: webhookData.branch || 'unknown',
      reason,
      reasonDetail,
      webhookEvent: webhookData.event,
      webhookDeliveryId: webhookData.deliveryId,
      createdAt: Date.now(),
      pusher: webhookData.pusher,
      commitMessage: webhookData.commitMessage,
    };

    this.mailbox.addPending(pull);
    this.broadcastToRenderers(FastForwardEvent.ON_PENDING_PULL, pull);

    // Link the notification to the pending pull
    if (notificationId) {
      this.linkNotificationToPendingPull(notificationId, pull.id);
    }
  }

  /**
   * Link a webhook notification to its pending pull
   */
  private linkNotificationToPendingPull(
    notificationId: string,
    pendingPullId: string,
  ): void {
    const notifications = this.mailbox.getNotifications();
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.pendingPullId = pendingPullId;
    }
  }

  /**
   * Manually pull a pending item
   */
  async pullNow(id: string): Promise<{ success: boolean; message: string; error?: string }> {
    const pending = this.mailbox.getPending().find((p) => p.id === id);
    if (!pending) {
      return { success: false, message: 'Pending pull not found', error: 'Not found' };
    }

    try {
      await electronCLI.initialize();
      const git = electronCLI.git;

      // Fetch first
      await git.fetch(pending.repoPath);

      // Try to pull
      const pullResult = await git.pull(pending.repoPath);

      if (pullResult.success) {
        // Remove from pending
        this.mailbox.removePending(id);

        // Add to history
        const result: PullResult = {
          id: `pull_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          repoPath: pending.repoPath,
          repoFullName: pending.repoFullName,
          branch: pending.branch,
          success: true,
          message: 'Pull completed successfully',
          completedAt: Date.now(),
          wasAutomatic: false,
        };
        this.mailbox.addToHistory(result);

        // Notify renderers
        this.broadcastToRenderers(FastForwardEvent.ON_PULL_COMPLETE, result);

        // Refresh repository monitoring
        const manager = getManager();
        await manager.refreshRepository(pending.repoPath);

        return { success: true, message: 'Pull completed successfully' };
      } else {
        const error = pullResult.stderr || 'Pull failed';

        // Add failed result to history
        const result: PullResult = {
          id: `pull_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          repoPath: pending.repoPath,
          repoFullName: pending.repoFullName,
          branch: pending.branch,
          success: false,
          message: 'Pull failed',
          error,
          completedAt: Date.now(),
          wasAutomatic: false,
        };
        this.mailbox.addToHistory(result);
        this.broadcastToRenderers(FastForwardEvent.ON_PULL_FAILED, result);

        return { success: false, message: 'Pull failed', error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: 'Pull failed', error: errorMsg };
    }
  }

  /**
   * Dismiss a pending pull notification
   */
  dismiss(id: string): boolean {
    return this.mailbox.removePending(id);
  }

  /**
   * Dismiss all pending pulls
   */
  dismissAll(): void {
    this.mailbox.clearAll();
  }

  /**
   * Get all pending pulls
   */
  getPendingPulls(): PendingPull[] {
    return this.mailbox.getPending();
  }

  /**
   * Get pull history
   */
  getPullHistory(): PullResult[] {
    return this.mailbox.getHistory();
  }

  /**
   * Get all webhook notifications
   */
  getWebhookNotifications(): WebhookNotification[] {
    return this.mailbox.getNotifications();
  }

  /**
   * Dismiss a webhook notification
   */
  dismissNotification(id: string): boolean {
    return this.mailbox.removeNotification(id);
  }

  /**
   * Mark a webhook notification as read
   */
  markNotificationRead(id: string): boolean {
    return this.mailbox.markNotificationRead(id);
  }

  /**
   * Clear the remote cache (call when repos change)
   */
  clearRemoteCache(): void {
    this.repoRemoteCache.clear();
  }

  /**
   * Broadcast event to all renderer windows
   */
  private broadcastToRenderers(event: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(event, data);
      }
    });
  }
}

export const fastForwardService = FastForwardService.getInstance();
