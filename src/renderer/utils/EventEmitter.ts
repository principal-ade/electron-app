/**
 * Simple EventEmitter implementation for browser environment
 * Replaces Node.js EventEmitter in renderer process
 */
export class EventEmitter {
  private events: Record<string, Array<(...args: unknown[]) => void>> = {};

  on(event: string, listener: (...args: unknown[]) => void): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    if (!this.events[event]) return this;

    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    if (!this.events[event]) return false;

    this.events[event].forEach((listener) => {
      listener(...args);
    });
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  once(event: string, listener: (...args: unknown[]) => void): this {
    const onceWrapper = (...args: unknown[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  listenerCount(event: string): number {
    return this.events[event]?.length || 0;
  }
}

// Default export to match Node.js events module
export default EventEmitter;
