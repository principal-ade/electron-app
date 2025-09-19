import { contextBridge, ipcRenderer } from 'electron';

// Expose Git Sync APIs to the renderer
contextBridge.exposeInMainWorld('gitSync', {
  // Authentication
  authenticate: () => ipcRenderer.invoke('git-sync:authenticate'),

  // Server configuration
  getServerUrl: () => ipcRenderer.invoke('git-sync:get-server-url'),

  // Repository access
  checkRepoAccess: (repoUrl: string, token: string) =>
    ipcRenderer.invoke('git-sync:check-repo-access', repoUrl, token),
});

// Add type definitions
declare global {
  interface Window {
    gitSync: {
      authenticate: () => Promise<string | null>;
      getServerUrl: () => Promise<string>;
      checkRepoAccess: (repoUrl: string, token: string) => Promise<boolean>;
    };
  }
}
