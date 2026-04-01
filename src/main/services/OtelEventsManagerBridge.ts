/**
 * OtelEventsManagerBridge - Bridge for communicating with otel-events-manager
 *
 * Handles:
 * - Forwarding traces for persistence
 * - Syncing workspace/FileTree data for trace matching
 */

import { app } from 'electron';
import type { OTLPTraceRequest } from '@principal-ai/otel-collector-server';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

// Type alias for clarity
type OTLPTraceData = OTLPTraceRequest;

// Configuration
const DEFAULT_EVENTS_MANAGER_URL = 'http://localhost:4321';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const WORKSPACE_SYNC_DEBOUNCE = 500; // 500ms debounce for workspace updates

// API Endpoints
const ENDPOINTS = {
  TRACES: '/v1/traces',
  REGISTRY_SYNC: '/api/registry/sync',
  HEALTH: '/health',
} as const;

export interface WorkspaceSyncPayload {
  id: string;
  rootPath: string;
  name?: string;
  fileTree?: FileTree;
}

export interface SyncResult {
  success: boolean;
  registeredScopes?: string[];
  error?: string;
}

export interface BridgeStatus {
  enabled: boolean;
  connected: boolean;
  lastHealthCheck: number | null;
  lastSuccessfulSync: number | null;
  syncedWorkspaces: string[];
  traceForwardCount: number;
}

interface RegistrySyncRequest {
  action: 'update' | 'remove';
  workspace: {
    id: string;
    rootPath: string;
    name?: string;
    sha?: string;
  };
  scopeNames: string[];
  timestamp: number;
}

export class OtelEventsManagerBridge {
  private static instance: OtelEventsManagerBridge | null = null;

  private readonly baseUrl: string;
  private enabled: boolean = true;
  private connected: boolean = false;
  private lastHealthCheck: number | null = null;
  private lastSuccessfulSync: number | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private syncedWorkspaces: Set<string> = new Set();
  private traceForwardCount: number = 0;

  // Debounce timers for workspace sync
  private workspaceSyncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private constructor() {
    this.baseUrl = process.env.OTEL_EVENTS_MANAGER_URL || DEFAULT_EVENTS_MANAGER_URL;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OtelEventsManagerBridge {
    if (!OtelEventsManagerBridge.instance) {
      OtelEventsManagerBridge.instance = new OtelEventsManagerBridge();
    }
    return OtelEventsManagerBridge.instance;
  }

  /**
   * Initialize the bridge and start health checking
   */
  async initialize(): Promise<void> {
    console.log(`[OtelEventsManagerBridge] Initializing with base URL: ${this.baseUrl}`);

    // Initial health check
    await this.checkHealth();

    // Start periodic health checks
    this.healthCheckTimer = setInterval(() => {
      this.checkHealth().catch((err) => {
        console.debug('[OtelEventsManagerBridge] Health check error:', err);
      });
    }, HEALTH_CHECK_INTERVAL);

    console.log('[OtelEventsManagerBridge] Initialized');
  }

  /**
   * Check if the events manager is reachable
   */
  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}${ENDPOINTS.HEALTH}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      this.connected = response.ok;
      this.lastHealthCheck = Date.now();

      if (this.connected) {
        console.debug('[OtelEventsManagerBridge] Health check passed');
      }

      return this.connected;
    } catch {
      this.connected = false;
      this.lastHealthCheck = Date.now();
      return false;
    }
  }

  /**
   * Forward trace data to otel-events-manager for persistence
   * Fire-and-forget - does not block trace processing
   */
  async forwardTrace(traceData: OTLPTraceData): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}${ENDPOINTS.TRACES}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(traceData),
      });

      if (response.ok) {
        this.traceForwardCount++;
        this.connected = true;
      } else {
        console.warn(`[OtelEventsManagerBridge] Failed to forward trace: ${response.status}`);
      }
    } catch (err) {
      // Silently fail - events manager might not be running
      // Only log in development for debugging
      if (!app.isPackaged) {
        console.debug(
          '[OtelEventsManagerBridge] Events manager not available:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  /**
   * Push workspace FileTree to events manager for trace matching
   * Debounced to avoid flooding during rapid file changes
   */
  async pushWorkspace(workspace: WorkspaceSyncPayload): Promise<SyncResult> {
    if (!this.enabled) {
      return { success: false, error: 'Bridge is disabled' };
    }

    // Clear existing debounce timer for this workspace
    const existingTimer = this.workspaceSyncTimers.get(workspace.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Return a promise that resolves after debounce
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.workspaceSyncTimers.delete(workspace.id);
        const result = await this.executePushWorkspace(workspace);
        resolve(result);
      }, WORKSPACE_SYNC_DEBOUNCE);

      this.workspaceSyncTimers.set(workspace.id, timer);
    });
  }

  /**
   * Execute the actual workspace push (after debounce)
   */
  private async executePushWorkspace(workspace: WorkspaceSyncPayload): Promise<SyncResult> {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('otel.events_manager.workspace_sync');

    try {
      // Discover scope names from FileTree if available
      const scopeNames = this.discoverScopeNames(workspace.fileTree);

      const request: RegistrySyncRequest = {
        action: 'update',
        workspace: {
          id: workspace.id,
          rootPath: workspace.rootPath,
          name: workspace.name || this.deriveWorkspaceName(workspace.rootPath),
          sha: workspace.fileTree?.sha,
        },
        scopeNames,
        timestamp: Date.now(),
      };

      span.addEvent('otel.events_manager.workspace_sync_start', {
        'workspace.id': workspace.id,
        'workspace.path': workspace.rootPath,
        'scopes.count': scopeNames.length,
      });

      const response = await fetch(`${this.baseUrl}${ENDPOINTS.REGISTRY_SYNC}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorText });
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = (await response.json()) as SyncResult;

      if (result.success) {
        this.syncedWorkspaces.add(workspace.id);
        this.lastSuccessfulSync = Date.now();
        this.connected = true;

        span.addEvent('otel.events_manager.workspace_sync_complete', {
          'workspace.id': workspace.id,
          'registered.scopes': result.registeredScopes?.join(',') || '',
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      console.log(
        `[OtelEventsManagerBridge] Workspace synced: ${workspace.rootPath} (${scopeNames.length} scopes)`,
      );

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });

      if (!app.isPackaged) {
        console.debug('[OtelEventsManagerBridge] Workspace sync failed:', errorMessage);
      }

      return { success: false, error: errorMessage };
    } finally {
      span.end();
    }
  }

  /**
   * Notify events manager that a workspace was removed/closed
   */
  async removeWorkspace(workspaceId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Cancel any pending sync for this workspace
    const pendingTimer = this.workspaceSyncTimers.get(workspaceId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.workspaceSyncTimers.delete(workspaceId);
    }

    try {
      const request: RegistrySyncRequest = {
        action: 'remove',
        workspace: {
          id: workspaceId,
          rootPath: workspaceId,
        },
        scopeNames: [],
        timestamp: Date.now(),
      };

      const response = await fetch(`${this.baseUrl}${ENDPOINTS.REGISTRY_SYNC}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        this.syncedWorkspaces.delete(workspaceId);
        console.log(`[OtelEventsManagerBridge] Workspace removed: ${workspaceId}`);
      }
    } catch (err) {
      if (!app.isPackaged) {
        console.debug(
          '[OtelEventsManagerBridge] Workspace removal failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  /**
   * Discover scope names from FileTree
   * Looks for library.yaml in .principal-views directory
   */
  private discoverScopeNames(fileTree?: FileTree): string[] {
    if (!fileTree) {
      return [];
    }

    // Look for library.yaml files to extract scope names
    // For now, return empty array - the events manager can do its own discovery
    // TODO: Parse library.yaml if needed for performance optimization
    return [];
  }

  /**
   * Derive workspace name from path
   */
  private deriveWorkspaceName(rootPath: string): string {
    const parts = rootPath.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  /**
   * Check if events manager is reachable
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current bridge status
   */
  getStatus(): BridgeStatus {
    return {
      enabled: this.enabled,
      connected: this.connected,
      lastHealthCheck: this.lastHealthCheck,
      lastSuccessfulSync: this.lastSuccessfulSync,
      syncedWorkspaces: Array.from(this.syncedWorkspaces),
      traceForwardCount: this.traceForwardCount,
    };
  }

  /**
   * Enable or disable the bridge
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[OtelEventsManagerBridge] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Check if bridge is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    console.log('[OtelEventsManagerBridge] Destroying...');

    // Stop health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Clear all pending sync timers
    for (const timer of this.workspaceSyncTimers.values()) {
      clearTimeout(timer);
    }
    this.workspaceSyncTimers.clear();

    this.syncedWorkspaces.clear();
    console.log('[OtelEventsManagerBridge] Destroyed');
  }
}

// Export singleton instance for convenience
export const otelEventsManagerBridge = OtelEventsManagerBridge.getInstance();
