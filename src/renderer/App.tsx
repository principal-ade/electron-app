import React, { Suspense } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { useTheme } from 'themed-markdown';

// import { ElectronPlatformAdapters } from './adapters'; // No longer needed

import { GlobalFeedbackProvider } from './GlobalFeedbackProvider';
import { UserPromptProvider } from './components/mcp/UserPromptProvider';
import { CustomThemeProvider } from './providers/CustomThemeProvider';
// Titlebars are now integrated into each component
import { SettingsModal } from './components/landing-page/SettingsModal';

import {
  AgentConfigurationService,
  AgentInstallationStatus,
} from './main-process-api/AgentConfigurationService';
import { AppVersionManagerService } from './main-process-api/AppVersionManagerService';
import { UserPreferencesService } from './main-process-api/UserPreferencesService';

// Import MarkdownView directly (not lazy loaded)
import { MarkdownView } from './pages/MarkdownView';

// Lazy load all page components
const LandingPage = React.lazy(() =>
  import('./pages/LandingPage/LandingPage').then((m) => ({
    default: m.LandingPage,
  })),
);
const StandaloneTerminal = React.lazy(() =>
  import('./pages/StandaloneTerminal').then((m) => ({
    default: m.StandaloneTerminal,
  })),
);
const StoreViewer = React.lazy(() =>
  import('./pages/StoreViewer').then((m) => ({ default: m.StoreViewer })),
);
const RepositoryManager = React.lazy(() =>
  import('./pages/RepoManager/RepositoryManager').then((m) => ({
    default: m.RepositoryManager,
  })),
);
const MultiFileEditorWindow = React.lazy(() =>
  import('./pages/MultiFileEditorWindow').then((m) => ({
    default: m.MultiFileEditorWindow,
  })),
);
const CallimachusWindow = React.lazy(() =>
  import('./pages/CallimachusWindow').then((m) => ({
    default: m.CallimachusWindow,
  })),
);
const SearchWindow = React.lazy(() =>
  import('./pages/SearchWindow').then((m) => ({
    default: m.SearchWindow,
  })),
);

function AppContent({
  setHasUpdateAvailable,
  onLandingPageMounted,
  onSettingsClick,
  hasUpdateAvailable,
}: {
  setHasUpdateAvailable: (hasUpdate: boolean) => void;
  onSettingsClick?: () => void;
  hasUpdateAvailable?: boolean;
  // onLandingPageMounted removed - add project buttons now in repository list header
}) {
  const { theme } = useTheme();

  const [currentView, setCurrentView] = React.useState<
    | 'landing'
    | 'terminal'
    | 'storeViewer'
    | 'markdownView'
    | 'repositoryMaps'
    | 'multiFileEditor'
    | 'callimachus'
    | 'search'
  >('landing');
  // const [useNewUI, setUseNewUI] = React.useState(false); // No longer needed
  const [windowInitData, setWindowInitData] = React.useState<unknown>(null);
  const [agentStatus, setAgentStatus] = React.useState<
    AgentInstallationStatus | undefined
  >(undefined);

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
      } else if (
        hash === '#store-viewer' ||
        hash.startsWith('#store-viewer?')
      ) {
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
      } else if (hash === '#/callimachus' || hash.startsWith('#/callimachus')) {
        // Callimachus Pattern Discovery route
        setCurrentView('callimachus');
      } else if (hash === '#/search' || hash.startsWith('#/search')) {
        // Alexandria Search route
        setCurrentView('search');
      } else {
        AgentConfigurationService.checkAgentInstallations().then((status) => {
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
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
      }}
    >
      <div>Loading...</div>
    </div>
  );

  if (currentView === 'landing') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        {/* We need to consume the context inside the provider */}
        {agentStatus && (
          <LandingPage
            initialAgentStatus={agentStatus}
            onUpdateAvailable={setHasUpdateAvailable}
            onSettingsClick={onSettingsClick}
            hasUpdateAvailable={hasUpdateAvailable}
            // onMountActions prop removed - add project buttons now in repository list header
          />
        )}
      </Suspense>
    );
  }

  if (currentView === 'terminal') {
    // For terminal view, use hash-based routing
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MemoryRouter initialEntries={[window.location.hash.substring(1)]}>
          <Routes>
            <Route
              path="/terminal/:sessionId"
              element={<StandaloneTerminal />}
            />
          </Routes>
        </MemoryRouter>
      </Suspense>
    );
  }

  if (currentView === 'markdownView') {
    // Get fontSizeScale and other props from parent App component
    const fontSizeScale = (window as any).markdownFontSizeScale || 1.0;
    const projectName = (window as any).markdownProjectName;
    const onFontSizeIncrease = (window as any).handleMarkdownFontIncrease;
    const onFontSizeDecrease = (window as any).handleMarkdownFontDecrease;
    return (
      <MarkdownView
        filePath={(windowInitData as any)?.filePath || ''}
        fontSizeScale={fontSizeScale}
        projectName={projectName}
        onFontSizeIncrease={onFontSizeIncrease}
        onFontSizeDecrease={onFontSizeDecrease}
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
        <MultiFileEditorWindow {...((windowInitData as any) || {})} />
      </Suspense>
    );
  }

  if (currentView === 'callimachus') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <CallimachusWindow />
      </Suspense>
    );
  }

  if (currentView === 'search') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SearchWindow />
      </Suspense>
    );
  }

  if (currentView === 'repositoryMaps') {
    // Pass windowInitData to the window object so RepositoryManager can access mode
    if (windowInitData) {
      (window as unknown as { windowInitData: unknown }).windowInitData =
        windowInitData;
    }

    return (
      <Suspense fallback={<LoadingFallback />}>
        <RepositoryManager
          repository={(windowInitData as any)?.repository}
          onBack={() => window.close()}
          onSettingsClick={onSettingsClick}
          hasUpdateAvailable={hasUpdateAvailable}
        />
      </Suspense>
    );
  }

  return null;
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [hasUpdateAvailable, setHasUpdateAvailable] = React.useState(false);
  const [currentView, setCurrentView] = React.useState<string>('');
  const [repositoryData, setRepositoryData] = React.useState<{
    owner?: string;
    name?: string;
  } | null>(null);
  const [markdownFilePath, setMarkdownFilePath] = React.useState<string | null>(null);
  const [markdownProjectName, setMarkdownProjectName] = React.useState<string | null>(null);
  const [markdownFontSizeScale, setMarkdownFontSizeScale] = React.useState<number>(1.0);
  // Removed landingPageActions as add project buttons are now in the repository list header

  // Load markdown font size preference
  React.useEffect(() => {
    if (currentView === 'markdown-view') {
      UserPreferencesService.getPreferences().then(prefs => {
        if (prefs?.markdownFontSizeScale) {
          setMarkdownFontSizeScale(prefs.markdownFontSizeScale);
        }
      }).catch(err => {
        console.error('Error loading font size preference:', err);
      });
    }
  }, [currentView]);

  // Handle font size changes
  const handleMarkdownFontIncrease = React.useCallback(async () => {
    const newScale = Math.min(markdownFontSizeScale + 0.1, 3.0);
    setMarkdownFontSizeScale(newScale);
    try {
      await UserPreferencesService.updatePreferences({
        markdownFontSizeScale: newScale,
      });
    } catch (err) {
      console.error('Error saving font size preference:', err);
    }
  }, [markdownFontSizeScale]);

  const handleMarkdownFontDecrease = React.useCallback(async () => {
    const newScale = Math.max(markdownFontSizeScale - 0.1, 0.5);
    setMarkdownFontSizeScale(newScale);
    try {
      await UserPreferencesService.updatePreferences({
        markdownFontSizeScale: newScale,
      });
    } catch (err) {
      console.error('Error saving font size preference:', err);
    }
  }, [markdownFontSizeScale]);

  // Store fontSizeScale and handlers on window for AppContent to access
  React.useEffect(() => {
    (window as any).markdownFontSizeScale = markdownFontSizeScale;
    (window as any).markdownProjectName = markdownProjectName;
    (window as any).handleMarkdownFontIncrease = handleMarkdownFontIncrease;
    (window as any).handleMarkdownFontDecrease = handleMarkdownFontDecrease;
  }, [markdownFontSizeScale, markdownProjectName, handleMarkdownFontIncrease, handleMarkdownFontDecrease]);

  // Add platform class to body for CSS targeting and track current view
  React.useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) {
      document.body.classList.add('platform-darwin');
    } else if (platform.includes('win')) {
      document.body.classList.add('platform-win32');
    } else {
      document.body.classList.add('platform-linux');
    }

    // Track current view from hash
    const checkView = () => {
      const { hash } = window.location;
      if (hash.startsWith('#repository-maps')) {
        setCurrentView('repository-maps');
        // Extract repository data from hash
        if (hash.includes('/')) {
          try {
            const hashPart = hash.substring('#repository-maps/'.length);
            const [encodedData] = hashPart.split('?');
            const data = JSON.parse(decodeURIComponent(encodedData));
            if (data?.repository) {
              setRepositoryData(data.repository);
            }
          } catch (e) {
            console.error('Failed to parse repository data:', e);
          }
        }
      } else if (hash === '#/search' || hash.startsWith('#/search')) {
        setCurrentView('search');
      } else if (hash.startsWith('#markdown-view')) {
        setCurrentView('markdown-view');
        // Extract markdown file path and project name from hash
        if (hash.includes('/')) {
          try {
            const encodedData = hash.substring('#markdown-view/'.length);
            const data = JSON.parse(decodeURIComponent(encodedData));
            if (data?.filePath) {
              setMarkdownFilePath(data.filePath);
            }
            if (data?.projectName) {
              setMarkdownProjectName(data.projectName);
            }
          } catch (e) {
            console.error('Failed to parse markdown view data:', e);
          }
        }
      } else {
        setCurrentView('');
        setRepositoryData(null);
        setMarkdownFilePath(null);
        setMarkdownProjectName(null);
      }
    };

    checkView();
    window.addEventListener('hashchange', checkView);

    return () => {
      window.removeEventListener('hashchange', checkView);
    };
  }, []);

  return (
    <CustomThemeProvider>
      <GlobalFeedbackProvider>
        <UserPromptProvider>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
          <AppContent
            setHasUpdateAvailable={setHasUpdateAvailable}
            onSettingsClick={() => setIsSettingsOpen(true)}
            hasUpdateAvailable={hasUpdateAvailable}
            // onLandingPageMounted removed - add project buttons now in repository list header
          />
        </UserPromptProvider>
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
}
export default App;
