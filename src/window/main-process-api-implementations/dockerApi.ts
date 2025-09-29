import { ipcRenderer } from 'electron';
import { DockerAPI } from '../../shared/main-process-api-interfaces/DockerAPI';

export const dockerAPI: DockerAPI = {
  checkStatus: () => ipcRenderer.invoke('docker:check-status'),

  hasKnipImage: () => ipcRenderer.invoke('docker:has-knip-image'),

  pullImage: (imageName) => ipcRenderer.invoke('docker:pull-image', imageName),

  runKnip: (projectPath, options) =>
    ipcRenderer.invoke('docker:run-knip', projectPath, options),

  createKnipImage: () => ipcRenderer.invoke('docker:create-knip-image'),

  startKnipContainer: (projectPath) =>
    ipcRenderer.invoke('docker:start-knip-container', projectPath),

  execInContainer: (command) =>
    ipcRenderer.invoke('docker:exec-in-container', command),

  stopKnipContainer: () => ipcRenderer.invoke('docker:stop-knip-container'),

  getInstallInstructions: () =>
    ipcRenderer.invoke('docker:get-install-instructions'),

  onPullProgress: (callback) => {
    const subscription = (
      _event: unknown,
      data: { imageName: string; message: string },
    ) => callback(data);
    ipcRenderer.on('docker:pull-progress', subscription);
    return () =>
      ipcRenderer.removeListener('docker:pull-progress', subscription);
  },
};
