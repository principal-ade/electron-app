/**
 * Simple EventEmitter implementation for browser environment
 * Replaces Node.js EventEmitter in renderer process
 */
export class EventEmitter {
    events = {};
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }
    off(event, listener) {
        if (!this.events[event])
            return this;
        const index = this.events[event].indexOf(listener);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
        return this;
    }
    emit(event, ...args) {
        if (!this.events[event])
            return false;
        this.events[event].forEach(listener => {
            listener(...args);
        });
        return true;
    }
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        }
        else {
            this.events = {};
        }
        return this;
    }
    once(event, listener) {
        const onceWrapper = (...args) => {
            this.off(event, onceWrapper);
            listener(...args);
        };
        return this.on(event, onceWrapper);
    }
    listenerCount(event) {
        return this.events[event]?.length || 0;
    }
}
// Default export to match Node.js events module
export default EventEmitter;
