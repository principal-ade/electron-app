/**
 * Simple EventEmitter implementation for browser environment
 * Replaces Node.js EventEmitter in renderer process
 */
export declare class EventEmitter {
    private events;
    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(event?: string): this;
    once(event: string, listener: (...args: any[]) => void): this;
    listenerCount(event: string): number;
}
export default EventEmitter;
export { EventEmitter as EventEmitter };
//# sourceMappingURL=EventEmitter.d.ts.map