/**
 * Simple EventEmitter implementation for browser environment
 * Replaces Node.js EventEmitter in renderer process
 */
export class EventEmitter {
  private events: Record<string, Array<(...args: any[]) => void>> = {};

  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    if (!this.events[event]) return this;

    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
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

  once(event: string, listener: (...args: any[]) => void): this {
    const onceWrapper = (...args: any[]) => {
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

// Named exports to match Node.js events module
export { EventEmitter as EventEmitter };
