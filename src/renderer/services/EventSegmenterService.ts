/**
 * EventSegmenterService - Groups session events by todos or stop events
 * Provides meaningful segmentation for event history visualization
 */

import { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';

export interface TodoInfo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface EventSegment {
  type: 'todo' | 'stop' | 'orphaned' | 'setup';
  todoInfo?: TodoInfo;
  startIndex: number;
  endIndex: number;
  events: RepoNormalizedUniversalAgentSessionEvent[];
  timestamp: number;
  summary: string;
  stats: {
    duration: number;
    toolCounts: Record<string, number>;
    filesAccessed: string[];
    fileWrites: string[];
  };
}

export type SegmentationMode = 'todo' | 'stop' | 'hybrid';

export class EventSegmenterService {
  /**
   * Main segmentation method - choose strategy based on mode
   */
  segmentEvents(
    events: RepoNormalizedUniversalAgentSessionEvent[],
    mode: SegmentationMode = 'hybrid',
  ): EventSegment[] {
    switch (mode) {
      case 'todo':
        return this.segmentByTodos(events);
      case 'stop':
        return this.segmentByStops(events);
      case 'hybrid':
        return this.segmentHybrid(events);
      default:
        return this.segmentHybrid(events);
    }
  }

  /**
   * Segment events based on todo transitions
   */
  private segmentByTodos(
    events: RepoNormalizedUniversalAgentSessionEvent[],
  ): EventSegment[] {
    const segments: EventSegment[] = [];
    let currentTodo: TodoInfo | null = null;
    let segmentStart = 0;
    let orphanedStart = 0;

    events.forEach((event, index) => {
      if (event.toolName === 'TodoWrite' && event.toolInput) {
        const todos = (event.toolInput as any).todos as TodoInfo[];
        const activeTodo = todos.find((t) => t.status === 'in_progress');

        // Check if active todo changed
        if (activeTodo?.id !== currentTodo?.id) {
          // Close previous segment
          if (currentTodo && index > segmentStart) {
            segments.push(
              this.createSegment(
                events.slice(segmentStart, index),
                segmentStart,
                index - 1,
                'todo',
                currentTodo,
              ),
            );
          } else if (!currentTodo && index > orphanedStart) {
            // Create orphaned segment for events before first todo
            segments.push(
              this.createSegment(
                events.slice(orphanedStart, index),
                orphanedStart,
                index - 1,
                orphanedStart === 0 ? 'setup' : 'orphaned',
              ),
            );
          }

          // Update current todo
          currentTodo = activeTodo || null;
          segmentStart = index;
        }
      }
    });

    // Handle remaining events
    if (currentTodo && events.length > segmentStart) {
      segments.push(
        this.createSegment(
          events.slice(segmentStart),
          segmentStart,
          events.length - 1,
          'todo',
          currentTodo,
        ),
      );
    } else if (!currentTodo && events.length > segmentStart) {
      segments.push(
        this.createSegment(
          events.slice(segmentStart),
          segmentStart,
          events.length - 1,
          'orphaned',
        ),
      );
    }

    return segments;
  }

  /**
   * Segment events based on stop events
   */
  private segmentByStops(
    events: NormalizedAgentSessionEvent[],
  ): EventSegment[] {
    const segments: EventSegment[] = [];
    let segmentStart = 0;

    events.forEach((event, index) => {
      if (event.eventType === 'stop' || event.eventType === 'subagent-stop') {
        // Create segment up to and including stop event
        segments.push(
          this.createSegment(
            events.slice(segmentStart, index + 1),
            segmentStart,
            index,
            'stop',
          ),
        );
        segmentStart = index + 1;
      }
    });

    // Handle remaining events after last stop
    if (segmentStart < events.length) {
      segments.push(
        this.createSegment(
          events.slice(segmentStart),
          segmentStart,
          events.length - 1,
          'stop',
        ),
      );
    }

    return segments;
  }

  /**
   * Hybrid segmentation - combines todo and stop events
   */
  private segmentHybrid(events: NormalizedAgentSessionEvent[]): EventSegment[] {
    const segments: EventSegment[] = [];
    let currentTodo: TodoInfo | null = null;
    let segmentStart = 0;

    events.forEach((event, index) => {
      // Check for stop events first (higher priority)
      if (event.eventType === 'stop' || event.eventType === 'subagent-stop') {
        if (index > segmentStart) {
          segments.push(
            this.createSegment(
              events.slice(segmentStart, index + 1),
              segmentStart,
              index,
              'stop',
              currentTodo,
            ),
          );
        }
        segmentStart = index + 1;
        currentTodo = null; // Reset todo tracking after stop
      }
      // Check for todo changes
      else if (event.toolName === 'TodoWrite' && event.toolInput) {
        const todos = (event.toolInput as any).todos as TodoInfo[];
        const activeTodo = todos.find((t) => t.status === 'in_progress');

        if (activeTodo?.id !== currentTodo?.id) {
          // Only create segment if we have events
          if (index > segmentStart) {
            segments.push(
              this.createSegment(
                events.slice(segmentStart, index),
                segmentStart,
                index - 1,
                currentTodo
                  ? 'todo'
                  : segmentStart === 0
                    ? 'setup'
                    : 'orphaned',
                currentTodo,
              ),
            );
          }

          currentTodo = activeTodo || null;
          segmentStart = index;
        }
      }
    });

    // Handle remaining events
    if (segmentStart < events.length) {
      segments.push(
        this.createSegment(
          events.slice(segmentStart),
          segmentStart,
          events.length - 1,
          currentTodo ? 'todo' : 'orphaned',
          currentTodo,
        ),
      );
    }

    return segments;
  }

  /**
   * Create a segment with computed statistics
   */
  private createSegment(
    events: RepoNormalizedUniversalAgentSessionEvent[],
    startIndex: number,
    endIndex: number,
    type: 'todo' | 'stop' | 'orphaned' | 'setup',
    todoInfo?: TodoInfo | null,
  ): EventSegment {
    const stats = this.computeStats(events);
    const summary = this.generateSummary(events, type, todoInfo);

    return {
      type,
      todoInfo: todoInfo || undefined,
      startIndex,
      endIndex,
      events,
      timestamp: events[0]?.timestamp || Date.now(),
      summary,
      stats,
    };
  }

  /**
   * Compute statistics for a segment
   */
  private computeStats(
    events: NormalizedAgentSessionEvent[],
  ): EventSegment['stats'] {
    const toolCounts: Record<string, number> = {};
    const filesAccessed = new Set<string>();
    const fileWrites = new Set<string>();

    let startTime = events[0]?.timestamp || 0;
    let endTime = events[events.length - 1]?.timestamp || 0;

    events.forEach((event) => {
      // Count tool usage
      if (event.toolName) {
        toolCounts[event.toolName] = (toolCounts[event.toolName] || 0) + 1;
      }

      // Track file access
      if (event.files && event.files.length > 0) {
        event.files.forEach((file) => {
          if (file.absolutePath) {
            filesAccessed.add(file.absolutePath);

            // Track writes specifically
            if (['Write', 'Edit', 'MultiEdit'].includes(event.toolName || '')) {
              fileWrites.add(file.absolutePath);
            }
          }
        });
      }
    });

    return {
      duration: endTime - startTime,
      toolCounts,
      filesAccessed: Array.from(filesAccessed),
      fileWrites: Array.from(fileWrites),
    };
  }

  /**
   * Generate a human-readable summary for a segment
   */
  private generateSummary(
    events: NormalizedAgentSessionEvent[],
    type: 'todo' | 'stop' | 'orphaned' | 'setup',
    todoInfo?: TodoInfo | null,
  ): string {
    if (type === 'todo' && todoInfo) {
      return `Working on: ${todoInfo.content}`;
    }

    if (type === 'setup') {
      return 'Initial setup and exploration';
    }

    if (type === 'stop') {
      const todoContent = todoInfo?.content || 'general tasks';
      return `Session segment for ${todoContent}`;
    }

    if (type === 'orphaned') {
      const eventCount = events.filter((e) => e.toolName).length;
      return `${eventCount} events without todo context`;
    }

    // Fallback
    const mainTool = this.getMostUsedTool(events);
    return mainTool ? `${mainTool} operations` : 'Mixed operations';
  }

  /**
   * Get the most frequently used tool in a set of events
   */
  private getMostUsedTool(
    events: NormalizedAgentSessionEvent[],
  ): string | null {
    const toolCounts: Record<string, number> = {};

    events.forEach((event) => {
      if (event.toolName) {
        toolCounts[event.toolName] = (toolCounts[event.toolName] || 0) + 1;
      }
    });

    const entries = Object.entries(toolCounts);
    if (entries.length === 0) return null;

    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  /**
   * Get a color for segment type (for UI)
   */
  getSegmentColor(type: EventSegment['type']): string {
    switch (type) {
      case 'todo':
        return '#10b981'; // green
      case 'stop':
        return '#ef4444'; // red
      case 'setup':
        return '#3b82f6'; // blue
      case 'orphaned':
        return '#6b7280'; // gray
      default:
        return '#6b7280';
    }
  }

  /**
   * Get an icon name for segment type (for UI)
   */
  getSegmentIcon(type: EventSegment['type']): string {
    switch (type) {
      case 'todo':
        return 'CheckSquare';
      case 'stop':
        return 'StopCircle';
      case 'setup':
        return 'Settings';
      case 'orphaned':
        return 'HelpCircle';
      default:
        return 'Circle';
    }
  }
}

// Export singleton instance
export const eventSegmenter = new EventSegmenterService();
