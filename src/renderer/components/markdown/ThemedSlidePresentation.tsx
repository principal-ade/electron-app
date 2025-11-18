import React from 'react';
import { SlidePresentation, SlidePresentationProps } from 'themed-markdown';
import { useTheme } from '@principal-ade/industry-theme';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';

/**
 * ThemedSlidePresentation - A wrapper around SlidePresentation that applies theming
 *
 * This component:
 * 1. By default uses the current application theme
 * 2. Can optionally use a custom markdown theme from user preferences
 * 3. Updates when preferences change
 * 4. Provides theme via ThemeProvider context (new pattern in themed-markdown v0.1.24+)
 *
 * Use this instead of importing SlidePresentation directly when you need theme support.
 */

// Re-export the original component's props type and add our custom props
export type ThemedSlidePresentationProps = SlidePresentationProps & {
  useCustomTheme?: boolean; // If true, use custom markdown theme from preferences
  theme?: any; // Optional explicit theme override
};

export const ThemedSlidePresentation: React.FC<
  ThemedSlidePresentationProps
> = ({ useCustomTheme = false, theme: explicitTheme, ...props }) => {
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
          '[ThemedSlidePresentation] Failed to load preferences:',
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
  const themeToUse =
    explicitTheme ||
    (shouldUseCustom && markdownTheme ? markdownTheme : appTheme);

  return <SlidePresentation {...props} theme={themeToUse} />;
};
