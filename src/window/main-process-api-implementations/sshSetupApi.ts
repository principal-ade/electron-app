import { ipcRenderer } from 'electron';
import { SSHSetupAPI } from '../../shared/main-process-api-interfaces/SSHSetupAPI';

export const sshSetupAPI: SSHSetupAPI = {
  hasExistingKey: () => ipcRenderer.invoke('ssh-setup:has-existing-key'),

  generateKey: () => ipcRenderer.invoke('ssh-setup:generate-key'),

  configureSSH: () => ipcRenderer.invoke('ssh-setup:configure-ssh'),

  addToAgent: () => ipcRenderer.invoke('ssh-setup:add-to-agent'),

  testConnection: () => ipcRenderer.invoke('ssh-setup:test-connection'),

  completeSetup: () => ipcRenderer.invoke('ssh-setup:complete-setup'),
};
