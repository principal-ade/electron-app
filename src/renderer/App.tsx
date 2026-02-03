import React, { Suspense } from 'react';

import { useTheme } from '@principal-ade/industry-theme';

// import { ElectronPlatformAdapters } from './adapters'; // No longer needed

import { GlobalFeedbackProvider } from './GlobalFeedbackProvider';
import { CustomThemeProvider } from './providers/CustomThemeProvider';
// Titlebars are now integrated into each component

import { AppVersionManagerService } from './main-process-api/AppVersionManagerService';

// Import MarkdownView directly (not lazy loaded)
import { MarkdownView } from './pages/MarkdownView';

// Type definitions for window init data
interface MarkdownViewData {
  filePath?: string;
  viewMode?: 'single' | 'book';
  projectName?: string;
}

interface MultiFileEditorData {
  [key: string]: unknown;
}

// Extend window interface for markdown project name
declare global {
  interface Window {
    markdownProjectName?: string | null;
  }
}

// Lazy load all page components
// LandingPage removed - functionality migrated to RepositoryExplorer in principal-window
const StoreViewer = React.lazy(() =>
  import('./pages/StoreViewer').then((m) => ({ default: m.StoreViewer })),
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
const RemoteTerminalViewer = React.lazy(() =>
  import('./pages/RemoteTerminalViewer').then((m) => ({
    default: m.RemoteTerminalViewer,
  })),
);

function AppContent({
  _setHasUpdateAvailable,
  _hasUpdateAvailable,
}: {
  _setHasUpdateAvailable: (hasUpdate: boolean) => void;
  _hasUpdateAvailable?: boolean;
  // onLandingPageMounted removed - add project buttons now in repository list header
}) {
  const { theme } = useTheme();

  const [currentView, setCurrentView] = React.useState<
    | 'storeViewer'
    | 'markdownView'
    | 'multiFileEditor'
    | 'callimachus'
    | 'search'
    | 'remoteTerminalViewer'
    | null
  >(null);
  // const [useNewUI, setUseNewUI] = React.useState(false); // No longer needed
  const [windowInitData, setWindowInitData] = React.useState<
    MarkdownViewData | MultiFileEditorData | null
  >(null);

  // Platform adapters no longer needed for SimplifiedWorkspace
  // const platformAdapters = React.useMemo(
  //   () => new ElectronPlatformAdapters(),
  //   [],
  // );

  // Check for updates on app startup (only for main windows, not utility windows)
  React.useEffect(() => {
    const { hash } = window.location;
    // Skip update check for utility windows like remote terminal viewer
    if (!hash.startsWith('#/remote-terminal-viewer')) {
      AppVersionManagerService.checkForUpdateSilently();
    }
  }, []);
  // Check for special routes in hash
  React.useEffect(() => {
    const checkHash = () => {
      const { hash } = window.location;

      if (hash.startsWith('#markdown-view')) {
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
      } else if (hash === '#/callimachus' || hash.startsWith('#/callimachus')) {
        // Callimachus Pattern Discovery route
        setCurrentView('callimachus');
      } else if (hash === '#/search' || hash.startsWith('#/search')) {
        // Alexandria Search route
        setCurrentView('search');
      } else if (hash === '#/remote-terminal-viewer' || hash.startsWith('#/remote-terminal-viewer')) {
        // Remote Terminal Viewer route (for testing WebSocket terminal streaming)
        setCurrentView('remoteTerminalViewer');
      }
      // No default view - windows should have specific hashes
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => {
      window.removeEventListener('hashchange', checkHash);
    };
  }, []);

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

  if (currentView === 'markdownView') {
    // Get project name from parent App component
    const projectName = window.markdownProjectName;
    const markdownData = windowInitData as MarkdownViewData | null;
    return (
      <MarkdownView
        filePath={markdownData?.filePath || ''}
        projectName={projectName || undefined}
        initialViewMode={markdownData?.viewMode}
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
    const editorData = windowInitData as MultiFileEditorData | null;
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MultiFileEditorWindow {...(editorData || {})} />
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

  if (currentView === 'remoteTerminalViewer') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RemoteTerminalViewer />
      </Suspense>
    );
  }

  return null;
}

function App() {
  const [hasUpdateAvailable, setHasUpdateAvailable] = React.useState(false);
  const [markdownProjectName, setMarkdownProjectName] = React.useState<
    string | null
  >(null);
  // Removed landingPageActions as add project buttons are now in the repository list header

  // Store project name on window for AppContent to access
  React.useEffect(() => {
    window.markdownProjectName = markdownProjectName;
  }, [markdownProjectName]);

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

    // Track markdown project name from hash for AppContent to use
    const checkMarkdownView = () => {
      const { hash } = window.location;
      if (hash.startsWith('#markdown-view')) {
        // Extract project name from hash
        if (hash.includes('/')) {
          try {
            const encodedData = hash.substring('#markdown-view/'.length);
            const data = JSON.parse(decodeURIComponent(encodedData));
            if (data?.projectName) {
              setMarkdownProjectName(data.projectName);
            }
          } catch (e) {
            console.error('Failed to parse markdown view data:', e);
          }
        }
      } else {
        setMarkdownProjectName(null);
      }
    };

    checkMarkdownView();
    window.addEventListener('hashchange', checkMarkdownView);

    return () => {
      window.removeEventListener('hashchange', checkMarkdownView);
    };
  }, []);

  return (
    <CustomThemeProvider>
      <GlobalFeedbackProvider>
        <AppContent
          _setHasUpdateAvailable={setHasUpdateAvailable}
          _hasUpdateAvailable={hasUpdateAvailable}
          // onLandingPageMounted removed - add project buttons now in repository list header
        />
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
}
export default App;
