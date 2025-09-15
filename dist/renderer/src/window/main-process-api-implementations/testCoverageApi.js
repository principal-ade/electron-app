import { ipcRenderer } from 'electron';
export const testCoverageAPI = {
    collectCoverage: (rootPath, packages, options) => ipcRenderer.invoke('collect-test-coverage', rootPath, packages, options),
    cancelCoverage: (packageName) => ipcRenderer.invoke('cancel-test-coverage', packageName),
    cancelAllCoverage: () => ipcRenderer.invoke('cancel-all-test-coverage'),
};
