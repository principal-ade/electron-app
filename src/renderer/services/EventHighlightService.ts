/**
 * EventHighlightService - Convert agent events into File City highlight layers
 *
 * This service listens to agent events and creates highlight layers for the File City visualization.
 * It maintains an in-memory history of events and allows navigation through them.
 */

import { EventEmitter } from 'events';
import type { HighlightLayer } from '@principal-ai/file-city-react';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { FileOperation } from '@principal-ai/agent-monitoring';

export interface EventHighlightConfig {
  maxHistorySize: number;
  defaultOpacity: number;
  defaultPriority: number;
}

interface EventHistoryEntry {
  event: RepoNormalizedUniversalAgentSessionEvent;
  layer: HighlightLayer | null;
  timestamp: number;
  index: number;
}

export class EventHighlightService extends EventEmitter {
  private config: EventHighlightConfig;
  private currentRepositoryRoot: string | null = null;
  private eventHistory: EventHistoryEntry[] = [];
  private eventCounter = 0;
  private currentIndex: number = -1; // -1 = live mode, >= 0 = history navigation

  constructor(config?: Partial<EventHighlightConfig>) {
    super();
    this.config = {
      maxHistorySize: 100,
      defaultOpacity: 0.8,
      defaultPriority: 50,
      ...config,
    };
  }

  /**
   * Set the current repository context
   * Clears history when repository changes
   */
  setRepository(repositoryRoot: string): void {
    if (this.currentRepositoryRoot !== repositoryRoot) {
      this.currentRepositoryRoot = repositoryRoot;
      this.clear();
      this.emit('repository-changed', repositoryRoot);
    }
  }

  /**
   * Process incoming agent event
   * Events now come pre-filtered via direct MessagePort per repository
   */
  processEvent(event: RepoNormalizedUniversalAgentSessionEvent): void {
    // Events are already filtered by repository at the source (utility process)
    // Just verify we have a repository context set
    if (!this.currentRepositoryRoot) {
      return;
    }

    // Create highlight layer
    const layer = this.createHighlightLayer(event);

    // Add to history
    const entry: EventHistoryEntry = {
      event,
      layer,
      timestamp: Date.now(),
      index: this.eventCounter++,
    };

    this.eventHistory.push(entry);

    // Maintain max size (circular buffer)
    if (this.eventHistory.length > this.config.maxHistorySize) {
      this.eventHistory.shift();
    }

    // If in live mode, emit the new layer
    if (this.currentIndex === -1) {
      this.emitCurrentLayers();
    }
  }

  /**
   * Create a highlight layer from an event
   * Returns null if no files to highlight
   */
  private createHighlightLayer(
    event: RepoNormalizedUniversalAgentSessionEvent,
  ): HighlightLayer | null {
    // Extract file paths from event
    const paths = this.extractFilePaths(event);

    if (paths.length === 0) {
      return null;
    }

    return {
      id: `event-highlight-${event.sessionId}-${event.timestamp}`,
      name: this.getEventDisplayName(event),
      enabled: true,
      color: this.getEventColor(event),
      opacity: this.config.defaultOpacity,
      priority: this.config.defaultPriority,
      items: paths.map((path) => ({
        path,
        type: 'file' as const,
        renderStrategy: 'fill' as const,
      })),
      timestamp: event.timestamp,
    };
  }

  /**
   * Extract repository-relative file paths from event
   * Includes any file with repository info and relative path
   * Excludes system/temp files unless they're in the repo
   */
  private extractFilePaths(
    event: RepoNormalizedUniversalAgentSessionEvent,
  ): string[] {
    if (!event.files || event.files.length === 0) {
      return [];
    }

    // Filter to files with repository info and extract relative paths
    const paths = event.files
      .filter((file) => {
        // Must have repository info with relative path
        if (!file.repository?.relativePath) {
          return false;
        }

        // Skip system files (node_modules, etc.) - these shouldn't be in Code City anyway
        if (file.context === 'system_file') {
          return false;
        }

        // Include repo_file, user_file, config_file - anything with a relative path
        return true;
      })
      .map((file) => file.repository!.relativePath);

    return paths;
  }

  /**
   * Get display name for event
   */
  private getEventDisplayName(
    event: RepoNormalizedUniversalAgentSessionEvent,
  ): string {
    const toolOrType = event.toolName || event.eventType;

    // If there's exactly one file, include its name
    const files = event.files?.filter(f => f.repository?.relativePath) || [];
    if (files.length === 1) {
      const fileName = files[0].repository!.relativePath.split('/').pop();
      return `${toolOrType}: ${fileName}`;
    }

    return toolOrType;
  }

  /**
   * Get color based on event operation or tool name
   */
  private getEventColor(
    event: RepoNormalizedUniversalAgentSessionEvent,
  ): string {
    // Use operation if available (most accurate)
    if (event.operation) {
      const operationColors: Record<string, string> = {
        [FileOperation.READ]: '#3b82f6', // Blue
        [FileOperation.WRITE]: '#22c55e', // Green
        [FileOperation.CREATE]: '#10b981', // Emerald
        [FileOperation.EDIT]: '#f59e0b', // Amber
        [FileOperation.DELETE]: '#ef4444', // Red
        [FileOperation.SEARCH]: '#8b5cf6', // Purple
        [FileOperation.LIST]: '#6366f1', // Indigo
      };

      const color = operationColors[event.operation];
      if (color) return color;
    }

    // Fallback to tool name
    const toolName = event.toolName?.toLowerCase() || '';
    if (toolName.includes('read')) return '#3b82f6';
    if (toolName.includes('write')) return '#22c55e';
    if (toolName.includes('edit')) return '#f59e0b';
    if (toolName.includes('grep') || toolName.includes('search'))
      return '#8b5cf6';
    if (toolName.includes('glob') || toolName.includes('ls')) return '#6366f1';

    // Fallback to event type
    if (event.eventType === 'session-start') return '#10b981';
    if (event.eventType === 'stop') return '#6366f1';

    return '#6b7280'; // Gray default
  }

  /**
   * Navigate to previous event in history
   */
  navigatePrevious(): void {
    const maxIndex = this.eventHistory.length - 1;

    if (this.currentIndex === -1) {
      // Switch from live mode to last event
      this.currentIndex = maxIndex;
    } else if (this.currentIndex > 0) {
      this.currentIndex--;
    }

    this.emitCurrentLayers();
  }

  /**
   * Navigate to next event in history
   */
  navigateNext(): void {
    const maxIndex = this.eventHistory.length - 1;

    if (this.currentIndex >= 0 && this.currentIndex < maxIndex) {
      this.currentIndex++;
      this.emitCurrentLayers();
    } else if (this.currentIndex === maxIndex) {
      // Switch back to live mode
      this.goLive();
    }
  }

  /**
   * Return to live mode
   */
  goLive(): void {
    this.currentIndex = -1;
    this.emitCurrentLayers();
  }

  /**
   * Get current highlight layers based on navigation state
   */
  getCurrentHighlightLayers(): HighlightLayer[] {
    if (this.currentIndex === -1) {
      // Live mode - show last N events
      return this.getLiveHighlightLayers();
    }

    // History mode - show single event
    const entry = this.eventHistory[this.currentIndex];
    return entry && entry.layer ? [entry.layer] : [];
  }

  /**
   * Get live highlight layers (last 5 events)
   */
  private getLiveHighlightLayers(): HighlightLayer[] {
    const recentCount = 5;
    const startIndex = Math.max(0, this.eventHistory.length - recentCount);
    const recentEntries = this.eventHistory.slice(startIndex);

    const layers = recentEntries
      .map((entry) => entry.layer)
      .filter((layer): layer is HighlightLayer => layer !== null);

    // Add border to most recent layer
    if (layers.length > 0) {
      const mostRecentLayer = layers[layers.length - 1];
      mostRecentLayer.items = mostRecentLayer.items.map((item) => ({
        ...item,
        renderStrategy: 'border' as const,
      }));
    }

    return layers;
  }

  /**
   * Emit current highlight layers
   */
  private emitCurrentLayers(): void {
    const layers = this.getCurrentHighlightLayers();
    this.emit('highlight-update', layers);

    // Emit current event if in history mode
    if (this.currentIndex >= 0) {
      const entry = this.eventHistory[this.currentIndex];
      if (entry) {
        this.emit('event-selected', entry.event, this.currentIndex);
      }
    }
  }

  /**
   * Get current navigation state
   */
  getNavigationState() {
    return {
      currentIndex: this.currentIndex,
      totalEvents: this.eventHistory.length,
      isLive: this.currentIndex === -1,
    };
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.eventHistory = [];
    this.eventCounter = 0;
    this.currentIndex = -1;
    this.emit('highlight-update', []);
  }

  /**
   * Get event history (for debugging)
   */
  getHistory(): EventHistoryEntry[] {
    return [...this.eventHistory];
  }
}
