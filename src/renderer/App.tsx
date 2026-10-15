import React from 'react';

// import { ElectronPlatformAdapters } from './adapters'; // No longer needed

import { GlobalFeedbackProvider } from './GlobalFeedbackProvider';
import { CustomThemeProvider } from './providers/CustomThemeProvider';
// Titlebars are now integrated into each component

import { AppVersionManagerService } from './main-process-api/AppVersionManagerService';

function AppContent({
  _setHasUpdateAvailable,
  _hasUpdateAvailable,
}: {
  _setHasUpdateAvailable: (hasUpdate: boolean) => void;
  _hasUpdateAvailable?: boolean;
  // onLandingPageMounted removed - add project buttons now in repository list header
}) {
  // Check for updates on app startup (only for main windows, not utility windows)
  React.useEffect(() => {
    AppVersionManagerService.checkForUpdateSilently();
  }, []);

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
