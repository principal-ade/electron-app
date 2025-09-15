import { ipcRenderer } from 'electron';
import { PackageManagerAPIEvent } from '../../shared/main-process-api-interfaces/PackageManagerAPI';
export const packageManagerApi = {
    checkVersions: (params) => {
        return ipcRenderer.invoke(PackageManagerAPIEvent.CHECK_VERSIONS, params);
    },
    checkVulnerabilities: (params) => {
        return ipcRenderer.invoke(PackageManagerAPIEvent.CHECK_VULNERABILITIES, params);
    },
    checkLicenses: (params) => {
        return ipcRenderer.invoke(PackageManagerAPIEvent.CHECK_LICENSES, params);
    },
    onVersionCheckProgress: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on(PackageManagerAPIEvent.VERSION_CHECK_PROGRESS, handler);
        return () => {
            ipcRenderer.removeListener(PackageManagerAPIEvent.VERSION_CHECK_PROGRESS, handler);
        };
    },
    onVulnerabilityCheckProgress: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on(PackageManagerAPIEvent.VULNERABILITY_CHECK_PROGRESS, handler);
        return () => {
            ipcRenderer.removeListener(PackageManagerAPIEvent.VULNERABILITY_CHECK_PROGRESS, handler);
        };
    },
    onLicenseCheckProgress: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on(PackageManagerAPIEvent.LICENSE_CHECK_PROGRESS, handler);
        return () => {
            ipcRenderer.removeListener(PackageManagerAPIEvent.LICENSE_CHECK_PROGRESS, handler);
        };
    },
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners(PackageManagerAPIEvent.VERSION_CHECK_PROGRESS);
        ipcRenderer.removeAllListeners(PackageManagerAPIEvent.VULNERABILITY_CHECK_PROGRESS);
        ipcRenderer.removeAllListeners(PackageManagerAPIEvent.LICENSE_CHECK_PROGRESS);
    },
};
