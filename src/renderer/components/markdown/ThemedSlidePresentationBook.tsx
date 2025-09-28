import React from 'react';
import { SlidePresentationBook, SlidePresentationBookProps, ThemeProvider, useTheme } from 'themed-markdown';
import type { Theme } from 'themed-markdown';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';

/**
 * ThemedSlidePresentationBook - A wrapper around SlidePresentationBook with theme support
 *
 * This component provides the new book view mode for presentations where:
 * - 'single' mode shows one slide at a time (traditional presentation)
 * - 'book' mode shows two slides side-by-side like pages in a book
 */
export type ThemedSlidePresentationBookProps = SlidePresentationBookProps & {
  useCustomTheme?: boolean; // If true, use custom markdown theme from preferences
  theme?: Theme; // Optional explicit theme override
};

export const ThemedSlidePresentationBook: React.FC<ThemedSlidePresentationBookProps> = ({
  useCustomTheme = false,
  theme: explicitTheme,
  ...props
}) => {
  const { theme: appTheme } = useTheme();
  const [markdownTheme, setMarkdownTheme] = React.useState<any>(null);
  const [shouldUseCustom, setShouldUseCustom] = React.useState(false);

  React.useEffect(() => {
    // Load user preferences
    const loadPreferences = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();

        // Check if user wants to use custom markdown theme
        if (
          useCustomTheme &&
          prefs.useCustomMarkdownTheme &&
          prefs.customMarkdownTheme
        ) {
          setMarkdownTheme(prefs.customMarkdownTheme);
          setShouldUseCustom(true);
        } else {
          setShouldUseCustom(false);
        }
      } catch (error) {
        console.error(
          '[ThemedSlidePresentationBook] Failed to load preferences:',
          error,
        );
        setShouldUseCustom(false);
      }
    };

    if (useCustomTheme) {
      loadPreferences();
    }
  }, [useCustomTheme]);

  // Determine which theme to use: explicit > custom > app
  const themeToUse = explicitTheme || (shouldUseCustom && markdownTheme ? markdownTheme : appTheme);

  return (
    <ThemeProvider theme={themeToUse}>
      <SlidePresentationBook {...props} />
    </ThemeProvider>
  );
};