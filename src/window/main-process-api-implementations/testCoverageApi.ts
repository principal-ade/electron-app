import { ipcRenderer } from 'electron';
import { TestCoverageAPI } from '../../shared/main-process-api-interfaces/TestCoverageAPI';

export const testCoverageAPI: TestCoverageAPI = {
  collectCoverage: (rootPath, packages, options) =>
    ipcRenderer.invoke('collect-test-coverage', rootPath, packages, options),
    
  cancelCoverage: (packageName) =>
    ipcRenderer.invoke('cancel-test-coverage', packageName),
    
  cancelAllCoverage: () =>
    ipcRenderer.invoke('cancel-all-test-coverage'),
};