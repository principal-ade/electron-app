/**
 * The one renderer-side boundary to Electron's generic IPC transport.
 * Domain clients use this module; UI code should go through renderer services.
 */
export const ipcInvoke: typeof Electron.ipcRenderer.invoke = (...args) => {
  const invoke = window.electron?.ipcRenderer?.invoke;
  if (!invoke) {
    throw new Error('IPC transport is unavailable in this window');
  }
  return invoke(...args);
};

export function ipcOn(
  channel: string,
  handler: (...args: unknown[]) => void,
): () => void {
  const on = window.electron?.ipcRenderer?.on;
  return on ? on(channel, handler) : () => {};
}
