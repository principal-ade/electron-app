import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@principal-ade/industry-theme';
import QuickOpenApp from './QuickOpenApp';
import { ThemeService } from '../services/ThemeService';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

// Get the current theme from ThemeService
// Note: ThemeService is already the singleton instance, not the class
ThemeService.getActiveTheme()
  .then((activeTheme) => {
    if (!activeTheme) {
      throw new Error('[Quick Open] Failed to load theme - theme is required');
    }

    console.log('[Quick Open] Theme loaded successfully:', activeTheme);
    root.render(
      <ThemeProvider theme={activeTheme}>
        <QuickOpenApp />
      </ThemeProvider>,
    );
  })
  .catch((error) => {
    console.error('[Quick Open] Fatal error loading theme:', error);
    throw error;
  });
