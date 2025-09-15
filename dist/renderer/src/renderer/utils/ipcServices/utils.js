// Utility functions for IPC services
// Check if we're in an Electron environment with required APIs exposed
export const isElectronEnvironment = () => {
    const hasElectron = !!window.electron;
    const hasMainProcess = !!window.mainProcess;
    const hasAgentConfig = !!window.mainProcess?.agentConfig;
    return hasElectron && hasMainProcess && hasAgentConfig;
};
// Initialize window APIs with a timeout
export const waitForWindowAPIs = (timeout = 5000) => {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkAPIs = () => {
            if (isElectronEnvironment()) {
                resolve(true);
                return;
            }
            if (Date.now() - startTime > timeout) {
                console.warn('Window APIs not available after timeout');
                resolve(false);
                return;
            }
            setTimeout(checkAPIs, 100);
        };
        checkAPIs();
    });
};
