console.log('[Preload] Script starting...');
import { contextBridge, ipcRenderer } from 'electron';
console.log('[Preload] Electron imports successful');
console.log('[Preload] Type imports successful');
import { mcpToolsAPI } from './main-process-api-implementations/mcpToolsApi';
import { terminalAPI } from './main-process-api-implementations/terminalApi';
import { typeExtractionApi } from './main-process-api-implementations/typeExtractionApi';
import { typeSchemaApi } from './main-process-api-implementations/typeSchemaApi';
import { packageManagerApi } from './main-process-api-implementations/packageManagerApi';
import { agentConfigAPI } from './main-process-api-implementations/agentConfigApi';
import { agentSessionApi } from './main-process-api-implementations/agentSessionApi';
import { agentInstallationAPI } from './main-process-api-implementations/agentInstallationApi';
import { agentSessionEventsAPI } from './main-process-api-implementations/agentSessionEventsApi';
import { agentSessionArchiveAPI } from './main-process-api-implementations/agentSessionArchiveApi';
import { agentUpdateAPI } from './main-process-api-implementations/agentUpdateApi';
import { authenticationAPI } from './main-process-api-implementations/authenticationApi';
import { clipboardAPI } from './main-process-api-implementations/clipboardApi';
import { excalidrawAPI } from './main-process-api-implementations/excalidrawApi';
import { fileSystemAPI } from './main-process-api-implementations/fileSystemApi';
import { gitAPI } from './main-process-api-implementations/gitApi';
import { gitWatcherAPI } from './main-process-api-implementations/gitWatcherApi';
import { violationsAPI } from './main-process-api-implementations/violationsApi';
import { githubAPI } from './main-process-api-implementations/githubApi';
import { storeAPI } from './main-process-api-implementations/storeApi';
import { repositoryAPI } from './main-process-api-implementations/repositoryApi';
import { alexandriaAPI } from './main-process-api-implementations/alexandriaApi';
import { shellAPI } from './main-process-api-implementations/shellApi';
import { systemAPI } from './main-process-api-implementations/systemApi';
import { userPromptAPI } from './main-process-api-implementations/userPromptApi';
import { userPreferencesAPI } from './main-process-api-implementations/userPreferencesApi';
import { windowManagerAPI } from './main-process-api-implementations/windowManagerApi';
import { a24zAPI } from './main-process-api-implementations/a24zApi';
import { repositoryNotesApi } from './main-process-api-implementations/repositoryNotesApi';
import { secretsAPI } from './main-process-api-implementations/secretsApi';
import { apiProxyApi } from './main-process-api-implementations/apiProxyApi';
import { appVersionManagerApi } from './main-process-api-implementations/appVersionManagerApi';
import { orbitAPI } from './main-process-api-implementations/orbitApi';
import { knipAPI } from './main-process-api-implementations/knipApi';
import { testCoverageAPI } from './main-process-api-implementations/testCoverageApi';
import { dockerAPI } from './main-process-api-implementations/dockerApi';
import { gitSyncAPI } from './main-process-api-implementations/gitSyncApi';
import { windowAPI } from './main-process-api-implementations/windowApi';
import { planningAPI } from './main-process-api-implementations/planningApi';
import { feedbackAPI } from './main-process-api-implementations/feedbackApi';
import { sessionViewApi } from './main-process-api-implementations/sessionViewApi';
import { llmModelsAPI } from './main-process-api-implementations/llmModelsApi';
import { testDebugAPI } from './main-process-api-implementations/testDebugApi';
import { documentSearchAPI } from './main-process-api-implementations/documentSearchApi';
// Wrap all exposures in try-catch for debugging
console.log('[Preload] Starting API exposure...');
// Expose the new mainProcess API
const mainProcessExposure = {
    agentInstallation: agentInstallationAPI,
    agentConfig: agentConfigAPI,
    alexandria: alexandriaAPI,
    agentSession: agentSessionApi,
    agentSessionArchive: agentSessionArchiveAPI,
    agentSessionEvents: agentSessionEventsAPI,
    agentUpdate: agentUpdateAPI,
    appVersionManager: appVersionManagerApi,
    authentication: authenticationAPI,
    clipboard: clipboardAPI,
    excalidraw: excalidrawAPI,
    repository: repositoryAPI,
    github: githubAPI,
    git: gitAPI,
    gitWatcher: gitWatcherAPI,
    violations: violationsAPI,
    fileSystem: fileSystemAPI,
    store: storeAPI,
    repositoryNotes: repositoryNotesApi,
    secrets: secretsAPI,
    shell: shellAPI,
    system: systemAPI,
    terminal: terminalAPI,
    userPreferences: userPreferencesAPI,
    userPrompt: userPromptAPI,
    apiProxy: apiProxyApi,
    windowManager: windowManagerAPI,
    orbit: orbitAPI,
    a24z: a24zAPI,
    mcpTools: mcpToolsAPI,
    packageManager: packageManagerApi,
    typeExtraction: typeExtractionApi,
    typeSchema: typeSchemaApi,
    knip: knipAPI,
    testCoverage: testCoverageAPI,
    docker: dockerAPI,
    gitSync: gitSyncAPI,
    window: windowAPI,
    planning: planningAPI,
    feedback: feedbackAPI,
    sessionView: sessionViewApi,
    llmModels: llmModelsAPI,
    testDebug: testDebugAPI,
    documentSearch: documentSearchAPI,
};
// Mermaid removed from preload - will be loaded in renderer instead
// try {
//   contextBridge.exposeInMainWorld('mermaid', mermaid);
//   console.log('[Preload] ✅ Mermaid exposed');
// } catch (error) {
//   console.error('[Preload] ❌ Failed to expose mermaid:', error);
// }
try {
    contextBridge.exposeInMainWorld('mainProcess', mainProcessExposure);
    console.log('[Preload] ✅ MainProcess API exposed');
}
catch (error) {
    console.error('[Preload] ❌ Failed to expose mainProcess API:', error);
}
// Expose custom titlebar API
try {
    contextBridge.exposeInMainWorld('electronTitlebar', {
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close'),
        isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
        onMaximizeChange: (callback) => {
            ipcRenderer.on('window-maximized-changed', (_, isMaximized) => callback(isMaximized));
        }
    });
    console.log('[Preload] ✅ Electron Titlebar API exposed');
}
catch (error) {
    console.error('[Preload] ❌ Failed to expose titlebar API:', error);
}
try {
    contextBridge.exposeInMainWorld('appName', 'Specktor');
    console.log('[Preload] ✅ AppName exposed');
}
catch (error) {
    console.error('[Preload] ❌ Failed to expose appName:', error);
}
// Enhanced debugging for preload issues
try {
    // Test if contextBridge is working
    const testObj = { test: 'working' };
    contextBridge.exposeInMainWorld('__preloadTest', testObj);
    console.log('[Preload] ✅ Context bridge is working');
    console.log('[Preload] ✅ Exposed APIs:', {
        mainProcess: Object.keys(mainProcessExposure),
        appName: 'Specktor'
    });
    console.log('[Preload] 🚀 Preload script executed successfully - APIs exposed to renderer');
}
catch (error) {
    console.error('[Preload] ❌ Failed to expose APIs:', error);
    console.error('[Preload] Stack trace:', error.stack);
}
