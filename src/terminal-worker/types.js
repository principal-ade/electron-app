/**
 * Message types for terminal worker <-> main process communication
 */
// =============================================================================
// Type Guards
// =============================================================================
export function isMainToWorkerMessage(msg) {
    return (msg !== null &&
        typeof msg === 'object' &&
        'type' in msg &&
        'id' in msg &&
        'timestamp' in msg);
}
export function isCreateSessionMessage(msg) {
    return msg.type === 'CREATE_SESSION';
}
export function isDestroySessionMessage(msg) {
    return msg.type === 'DESTROY_SESSION';
}
export function isWriteToSessionMessage(msg) {
    return msg.type === 'WRITE';
}
export function isResizeSessionMessage(msg) {
    return msg.type === 'RESIZE';
}
export function isRefreshSessionMessage(msg) {
    return msg.type === 'REFRESH';
}
export function isRegisterPortMessage(msg) {
    return msg.type === 'REGISTER_PORT';
}
export function isUnregisterPortMessage(msg) {
    return msg.type === 'UNREGISTER_PORT';
}
export function isSetOwnerMessage(msg) {
    return msg.type === 'SET_OWNER';
}
export function isShutdownMessage(msg) {
    return msg.type === 'SHUTDOWN';
}
