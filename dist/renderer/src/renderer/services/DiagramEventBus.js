// Simple event bus for diagram-related events
class DiagramEventBus {
    listeners = new Map();
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }
    emit(event, ...args) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach((callback) => {
                try {
                    callback(...args);
                }
                catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    off(event, callback) {
        if (!callback) {
            // Remove all listeners for this event
            this.listeners.delete(event);
        }
        else {
            // Remove specific listener
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.delete(callback);
            }
        }
    }
}
export const diagramEventBus = new DiagramEventBus();
// Event names
export const DIAGRAM_EVENTS = {
    DIAGRAM_SAVED: 'diagram:saved',
    DIAGRAM_CREATED: 'diagram:created',
    DIAGRAM_DELETED: 'diagram:deleted',
};
