import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Suspense } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useTheme } from 'themed-markdown';
// import { ElectronPlatformAdapters } from './adapters'; // No longer needed
import { GlobalFeedbackProvider } from './GlobalFeedbackProvider';
import { UserPromptProvider } from './components/mcp/UserPromptProvider';
import { AgentUpdateNotifications } from './components/AgentUpdateNotifications';
import { CustomThemeProvider } from './providers/CustomThemeProvider';
import { CustomTitlebar } from './pages/CustomTitlebar/CustomTitlebar';
import { SettingsModal } from './components/landing-page/SettingsModal';
import { AgentConfigurationService } from './main-process-api/AgentConfigurationService';
import { AppVersionManagerService } from './main-process-api/AppVersionManagerService';
// Import MarkdownView directly (not lazy loaded)
import { MarkdownView } from './pages/MarkdownView';
// Lazy load all page components
const LandingPage = React.lazy(() => import('./pages/LandingPage/LandingPage').then(m => ({ default: m.LandingPage })));
const ArchivedSessionsViewer = React.lazy(() => import('./pages/ArchivedSessionsViewer').then(m => ({ default: m.ArchivedSessionsViewer })));
const StandaloneTerminal = React.lazy(() => import('./pages/StandaloneTerminal').then(m => ({ default: m.StandaloneTerminal })));
const StoreViewer = React.lazy(() => import('./pages/StoreViewer').then(m => ({ default: m.StoreViewer })));
const RepositoryManager = React.lazy(() => import('./pages/RepoManager/RepositoryManager').then(m => ({ default: m.RepositoryManager })));
const MultiFileEditorWindow = React.lazy(() => import('./pages/MultiFileEditorWindow').then(m => ({ default: m.MultiFileEditorWindow })));
function AppContent({ setHasUpdateAvailable }) {
    const { theme } = useTheme();
    const [currentView, setCurrentView] = React.useState('landing');
    // const [useNewUI, setUseNewUI] = React.useState(false); // No longer needed
    const [windowInitData, setWindowInitData] = React.useState(null);
    const [agentStatus, setAgentStatus] = React.useState(undefined);
    // Platform adapters no longer needed for SimplifiedWorkspace
    // const platformAdapters = React.useMemo(
    //   () => new ElectronPlatformAdapters(),
    //   [],
    // );
    // Check for updates on app startup
    React.useEffect(() => {
        AppVersionManagerService.checkForUpdateSilently();
    }, []);
    // Check for special routes in hash
    React.useEffect(() => {
        const checkHash = () => {
            const { hash } = window.location;
            if (hash.startsWith('#/terminal/')) {
                // This is a terminal route, render the standalone terminal
                setCurrentView('terminal');
            }
            else if (hash.startsWith('#session-details')) {
                // Session details view route
                if (hash.includes('/')) {
                    try {
                        const encodedData = hash.substring('#session-details/'.length);
                        const data = JSON.parse(decodeURIComponent(encodedData));
                        setWindowInitData(data);
                    }
                    catch (e) {
                        console.error('Failed to parse session details data:', e);
                    }
                }
                setCurrentView('ArchivedSessionsViewer');
            }
            else if (hash.startsWith('#markdown-view')) {
                // Markdown view route
                if (hash.includes('/')) {
                    try {
                        const encodedData = hash.substring('#markdown-view/'.length);
                        const data = JSON.parse(decodeURIComponent(encodedData));
                        setWindowInitData(data);
                    }
                    catch (e) {
                        console.error('Failed to parse markdown view data:', e);
                    }
                }
                setCurrentView('markdownView');
            }
            else if (hash === '#store-viewer' || hash.startsWith('#store-viewer?')) {
                // Store Viewer route (with or without query parameters)
                setCurrentView('storeViewer');
            }
            else if (hash.startsWith('#multi-file-editor/')) {
                // Multi-file editor route
                try {
                    const encodedData = hash.substring('#multi-file-editor/'.length);
                    const data = JSON.parse(decodeURIComponent(encodedData));
                    setWindowInitData(data);
                    setCurrentView('multiFileEditor');
                }
                catch (e) {
                    console.error('Failed to parse multi-file editor data:', e);
                }
            }
            else if (hash.startsWith('#repository-maps')) {
                // Repository Maps route
                if (hash.includes('/')) {
                    try {
                        const hashPart = hash.substring('#repository-maps/'.length);
                        // Check if there are URL parameters
                        const [encodedData, queryString] = hashPart.split('?');
                        const data = JSON.parse(decodeURIComponent(encodedData));
                        // Parse mode from query parameters
                        if (queryString) {
                            const params = new URLSearchParams(queryString);
                            const mode = params.get('mode');
                            if (mode) {
                                data.mode = mode;
                            }
                        }
                        setWindowInitData(data);
                    }
                    catch (e) {
                        console.error('Failed to parse repository maps data:', e);
                    }
                }
                setCurrentView('repositoryMaps');
            }
            else {
                AgentConfigurationService.checkAgentInstallations().then(status => {
                    setAgentStatus(status);
                    setCurrentView('landing');
                });
            }
        };
        checkHash();
        window.addEventListener('hashchange', checkHash);
        return () => {
            window.removeEventListener('hashchange', checkHash);
        };
    }, []);
    // const goToLanding = () => setCurrentView('landing');
    // TODO: This is a temporary solution to get the file system tree for the simplified workspace
    // buildFileSystemTree no longer needed for SimplifiedWorkspace
    // const buildFileSystemTree = useMemo(
    //   () => async (path: string, filters?: any[]) => {
    //     // Lazy load FilesystemService
    //     // FilesystemService import removed - now using core
    //     // Use proper FilesystemService with mandatory filtering
    //     const filesystemService = new FilesystemService(
    //       platformAdapters.fileSystem,
    //     );
    //     // For GitHub repos, we always build from the root directory
    //     const rootPath = '';
    //     // This will apply all mandatory filters including fixture filtering
    //     const tree = await filesystemService.buildFileSystemTreeFromPath(
    //       rootPath,
    //       filters,
    //     );
    //     return tree;
    //   },
    //   [platformAdapters.fileSystem],
    // );
    // Loading component
    const LoadingFallback = () => (_jsx("div", { style: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: theme.colors.background,
            color: theme.colors.text
        }, children: _jsx("div", { children: "Loading..." }) }));
    if (currentView === 'landing') {
        return (_jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: agentStatus && _jsx(LandingPage, { initialAgentStatus: agentStatus, onUpdateAvailable: setHasUpdateAvailable }) }));
    }
    if (currentView === 'terminal') {
        // For terminal view, use hash-based routing
        return (_jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(MemoryRouter, { initialEntries: [window.location.hash.substring(1)], children: _jsx(Routes, { children: _jsx(Route, { path: "/terminal/:sessionId", element: _jsx(StandaloneTerminal, {}) }) }) }) }));
    }
    if (currentView === 'ArchivedSessionsViewer') {
        return (_jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(ArchivedSessionsViewer, { initialSessionId: windowInitData?.sessionId, initialDirectory: windowInitData?.directory }) }));
    }
    if (currentView === 'markdownView') {
        return (_jsx(MarkdownView, { filePath: windowInitData?.filePath || '' }));
    }
    if (currentView === 'storeViewer') {
        return (_jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(StoreViewer, {}) }));
    }
    if (currentView === 'multiFileEditor') {
        return (_jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(MultiFileEditorWindow, { ...(windowInitData || {}) }) }));
    }
    if (currentView === 'repositoryMaps') {
        // Pass windowInitData to the window object so RepositoryManager can access mode
        if (windowInitData) {
            window.windowInitData = windowInitData;
        }
        return (_jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(RepositoryManager, { repository: windowInitData?.repository, onBack: () => window.close() }) }));
    }
    return null;
}
function App() {
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [hasUpdateAvailable, setHasUpdateAvailable] = React.useState(false);
    // Add platform class to body for CSS targeting
    React.useEffect(() => {
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('mac')) {
            document.body.classList.add('platform-darwin');
        }
        else if (platform.includes('win')) {
            document.body.classList.add('platform-win32');
        }
        else {
            document.body.classList.add('platform-linux');
        }
        document.body.classList.add('has-custom-titlebar');
    }, []);
    return (_jsx(CustomThemeProvider, { children: _jsx(GlobalFeedbackProvider, { children: _jsxs(UserPromptProvider, { children: [_jsx(SettingsModal, { isOpen: isSettingsOpen, onClose: () => setIsSettingsOpen(false) }), _jsx(CustomTitlebar, { onSettingsClick: () => setIsSettingsOpen(true), hasUpdateAvailable: hasUpdateAvailable }), _jsx(AppContent, { setHasUpdateAvailable: setHasUpdateAvailable }), _jsx(AgentUpdateNotifications, {})] }) }) }));
}
export default App;
