import React, { Suspense } from 'react';

import { useTheme } from '@principal-ade/industry-theme';

// import { ElectronPlatformAdapters } from './adapters'; // No longer needed

import { GlobalFeedbackProvider } from './GlobalFeedbackProvider';
import { CustomThemeProvider } from './providers/CustomThemeProvider';
// Titlebars are now integrated into each component

import { AppVersionManagerService } from './main-process-api/AppVersionManagerService';

// Lazy load all page components
// LandingPage removed - functionality migrated to RepositoryExplorer in principal-window
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
    | 'remoteTerminalViewer'
    | null
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

      if (hash === '#/remote-terminal-viewer' || hash.startsWith('#/remote-terminal-viewer')) {
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
  // Removed landingPageActions as add project buttons are now in the repository list header

  // Add platform class to body for CSS targeting and initialize services
  React.useEffect(() => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) {
      document.body.classList.add('platform-darwin');
    } else if (platform.includes('win')) {
      document.body.classList.add('platform-win32');
    } else {
      document.body.classList.add('platform-linux');
    }
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
