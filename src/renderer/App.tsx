import React, { Suspense } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { useTheme } from 'themed-markdown';

// import { ElectronPlatformAdapters } from './adapters'; // No longer needed

import { GlobalFeedbackProvider } from './GlobalFeedbackProvider';
import { UserPromptProvider } from './components/mcp/UserPromptProvider';
import { AgentUpdateNotifications } from './components/AgentUpdateNotifications';
import { CustomThemeProvider } from './providers/CustomThemeProvider';
import { CustomTitlebar } from './components/CustomTitlebar/CustomTitlebar';

import { AgentConfigurationService, AgentInstallationStatus } from './main-process-api/AgentConfigurationService';
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

function AppContent() {
  const { theme } = useTheme();

  const [currentView, setCurrentView] = React.useState<
    'landing' | 'ArchivedSessionsViewer' | 'terminal' | 'storeViewer' | 'markdownView' | 'repositoryMaps' | 'multiFileEditor'
  >('landing');
  // const [useNewUI, setUseNewUI] = React.useState(false); // No longer needed
  const [windowInitData, setWindowInitData] = React.useState<unknown>(null);
  const [agentStatus, setAgentStatus] = React.useState<AgentInstallationStatus | undefined>(undefined);


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
        setCurrentView('terminal' as unknown as typeof currentView);
      } else if (hash.startsWith('#session-details')) {
        // Session details view route
        if (hash.includes('/')) {
          try {
            const encodedData = hash.substring('#session-details/'.length);
            const data = JSON.parse(decodeURIComponent(encodedData));
            setWindowInitData(data);
          } catch (e) {
            console.error('Failed to parse session details data:', e);
          }
        }
        setCurrentView('ArchivedSessionsViewer');
      } else if (hash.startsWith('#markdown-view')) {
        // Markdown view route
        if (hash.includes('/')) {
          try {
            const encodedData = hash.substring('#markdown-view/'.length);
            const data = JSON.parse(decodeURIComponent(encodedData));
            setWindowInitData(data);
          } catch (e) {
            console.error('Failed to parse markdown view data:', e);
          }
        }
        setCurrentView('markdownView' as unknown as typeof currentView);
      } else if (hash === '#store-viewer' || hash.startsWith('#store-viewer?')) {
        // Store Viewer route (with or without query parameters)
        setCurrentView('storeViewer');
      } else if (hash.startsWith('#multi-file-editor/')) {
        // Multi-file editor route
        try {
          const encodedData = hash.substring('#multi-file-editor/'.length);
          const data = JSON.parse(decodeURIComponent(encodedData));
          setWindowInitData(data);
          setCurrentView('multiFileEditor');
        } catch (e) {
          console.error('Failed to parse multi-file editor data:', e);
        }
      } else if (hash.startsWith('#repository-maps')) {
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
          } catch (e) {
            console.error('Failed to parse repository maps data:', e);
          }
        }
        setCurrentView('repositoryMaps');
      } else {
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
  const LoadingFallback = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: theme.colors.background,
      color: theme.colors.text
    }}>
      <div>Loading...</div>
    </div>
  );

  if (currentView === 'landing') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        {/* We need to consume the context inside the provider */}
        {agentStatus && <LandingPage initialAgentStatus={agentStatus}/>}
      </Suspense>
    );
  }

  if (currentView === 'terminal') {
    // For terminal view, use hash-based routing
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MemoryRouter initialEntries={[window.location.hash.substring(1)]}>
          <Routes>
            <Route path="/terminal/:sessionId" element={<StandaloneTerminal />} />
          </Routes>
        </MemoryRouter>
      </Suspense>
    );
  }

  if (currentView === 'ArchivedSessionsViewer') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ArchivedSessionsViewer
          initialSessionId={windowInitData?.sessionId}
          initialDirectory={windowInitData?.directory}
        />
      </Suspense>
    );
  }


  if (currentView === 'markdownView') {
    return (
      <MarkdownView
        filePath={windowInitData?.filePath || ''}
      />
    );
  }

  if (currentView === 'storeViewer') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <StoreViewer />
      </Suspense>
    );
  }


  if (currentView === 'multiFileEditor') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MultiFileEditorWindow {...(windowInitData || {})} />
      </Suspense>
    );
  }

  if (currentView === 'repositoryMaps') {
    // Pass windowInitData to the window object so RepositoryManager can access mode
    if (windowInitData) {
      (window as unknown as { windowInitData: unknown }).windowInitData = windowInitData;
    }
    
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RepositoryManager 
          repository={windowInitData?.repository}
          onBack={() => window.close()}
        />
      </Suspense>
    );
  }
  
  return null;
}


function App() {
  // Add platform class to body for CSS targeting
  React.useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) {
      document.body.classList.add('platform-darwin');
    } else if (platform.includes('win')) {
      document.body.classList.add('platform-win32');
    } else {
      document.body.classList.add('platform-linux');
    }
    document.body.classList.add('has-custom-titlebar');
  }, []);

  return (
    <CustomThemeProvider>
      <GlobalFeedbackProvider>
        <UserPromptProvider>
          <CustomTitlebar />
          <AppContent />
          <AgentUpdateNotifications />
        </UserPromptProvider>
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
}
export default App;

