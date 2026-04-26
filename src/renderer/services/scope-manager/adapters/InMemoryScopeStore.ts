import type { RawCanvas } from '../canvasIo';
import type { EventsCanvasFile, ScopeStore } from '../ScopeStore';

/**
 * In-memory adapter. Convenient for tests, storybook, and the localStorage
 * Phase-1 path where we want the manager to "feel" like it's persisting
 * without hitting the filesystem yet.
 */
export class InMemoryScopeStore implements ScopeStore {
  private scopesCanvas: RawCanvas | null;
  private eventsCanvases: Map<string, RawCanvas>;

  constructor(initial?: {
    scopesCanvas?: RawCanvas | null;
    eventsCanvases?: Iterable<EventsCanvasFile>;
  }) {
    this.scopesCanvas = initial?.scopesCanvas
      ? cloneJson(initial.scopesCanvas)
      : null;
    this.eventsCanvases = new Map();
    for (const entry of initial?.eventsCanvases ?? []) {
      this.eventsCanvases.set(entry.scopeName, cloneJson(entry.canvas));
    }
  }

  async readScopesCanvas(): Promise<RawCanvas | null> {
    return this.scopesCanvas ? cloneJson(this.scopesCanvas) : null;
  }

  async writeScopesCanvas(canvas: RawCanvas): Promise<void> {
    this.scopesCanvas = cloneJson(canvas);
  }

  async listEventsCanvases(): Promise<EventsCanvasFile[]> {
    return Array.from(this.eventsCanvases.entries()).map(
      ([scopeName, canvas]) => ({ scopeName, canvas: cloneJson(canvas) }),
    );
  }

  async writeEventsCanvas(file: EventsCanvasFile): Promise<void> {
    this.eventsCanvases.set(file.scopeName, cloneJson(file.canvas));
  }

  async deleteEventsCanvas(scopeName: string): Promise<void> {
    this.eventsCanvases.delete(scopeName);
  }

  /** Test helper. */
  snapshot(): { scopesCanvas: RawCanvas | null; events: EventsCanvasFile[] } {
    return {
      scopesCanvas: this.scopesCanvas ? cloneJson(this.scopesCanvas) : null,
      events: Array.from(this.eventsCanvases.entries()).map(
        ([scopeName, canvas]) => ({ scopeName, canvas: cloneJson(canvas) }),
      ),
    };
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
