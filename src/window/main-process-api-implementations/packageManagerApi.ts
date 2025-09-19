import { ipcRenderer } from 'electron';
import {
  PackageManagerAPI,
  PackageManagerAPIEvent,
  CheckVersionsParams,
} from '../../shared/main-process-api-interfaces/PackageManagerAPI';

export const packageManagerApi: PackageManagerAPI = {
  checkVersions: (params: CheckVersionsParams) => {
    return ipcRenderer.invoke(PackageManagerAPIEvent.CHECK_VERSIONS, params);
  },

  checkVulnerabilities: (params: CheckVersionsParams) => {
    return ipcRenderer.invoke(
      PackageManagerAPIEvent.CHECK_VULNERABILITIES,
      params,
    );
  },

  checkLicenses: (params: CheckVersionsParams) => {
    return ipcRenderer.invoke(PackageManagerAPIEvent.CHECK_LICENSES, params);
  },

  onVersionCheckProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(PackageManagerAPIEvent.VERSION_CHECK_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(
        PackageManagerAPIEvent.VERSION_CHECK_PROGRESS,
        handler,
      );
    };
  },

  onVulnerabilityCheckProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(
      PackageManagerAPIEvent.VULNERABILITY_CHECK_PROGRESS,
      handler,
    );
    return () => {
      ipcRenderer.removeListener(
        PackageManagerAPIEvent.VULNERABILITY_CHECK_PROGRESS,
        handler,
      );
    };
  },

  onLicenseCheckProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(PackageManagerAPIEvent.LICENSE_CHECK_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(
        PackageManagerAPIEvent.LICENSE_CHECK_PROGRESS,
        handler,
      );
    };
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners(
      PackageManagerAPIEvent.VERSION_CHECK_PROGRESS,
    );
    ipcRenderer.removeAllListeners(
      PackageManagerAPIEvent.VULNERABILITY_CHECK_PROGRESS,
    );
    ipcRenderer.removeAllListeners(
      PackageManagerAPIEvent.LICENSE_CHECK_PROGRESS,
    );
  },
};
