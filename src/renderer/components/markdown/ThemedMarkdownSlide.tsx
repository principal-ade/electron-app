import React from 'react';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { useTheme } from 'themed-markdown';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';

/**
 * ThemedMarkdownSlide - A wrapper around IndustryMarkdownSlide that applies theming
 * 
 * This component:
 * 1. By default uses the current application theme
 * 2. Can optionally use a custom markdown theme from user preferences
 * 3. Updates when preferences change
 * 
 * Use this instead of importing IndustryMarkdownSlide directly.
 */

// Re-export the original component's props type and add our custom prop
export type ThemedMarkdownSlideProps = React.ComponentProps<typeof IndustryMarkdownSlide> & {
  useCustomTheme?: boolean; // If true, use custom markdown theme from preferences
};

export const ThemedMarkdownSlide: React.FC<ThemedMarkdownSlideProps> = ({ 
  useCustomTheme = false,
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
        if (useCustomTheme && prefs.useCustomMarkdownTheme && prefs.customMarkdownTheme) {
          setMarkdownTheme(prefs.customMarkdownTheme);
          setShouldUseCustom(true);
        } else {
          setShouldUseCustom(false);
        }
      } catch (error) {
        console.error('[ThemedMarkdownSlide] Failed to load preferences:', error);
        setShouldUseCustom(false);
      }
    };
    
    if (useCustomTheme) {
      loadPreferences();
    }
  }, [useCustomTheme]);
  
  // Determine which theme to use
  const themeToUse = (shouldUseCustom && markdownTheme) ? markdownTheme : appTheme;
  
  // Apply theme-specific styles
  const themedProps = {
    ...props,
    // You can add theme-specific overrides here
    style: {
      ...props.style,
      '--md-theme-primary': themeToUse.colors.primary,
      '--md-theme-secondary': themeToUse.colors.secondary,
      '--md-theme-accent': themeToUse.colors.accent,
      '--md-theme-text': themeToUse.colors.text,
      '--md-theme-background': themeToUse.colors.background,
      '--md-theme-code-bg': themeToUse.colors.backgroundSecondary,
      '--md-theme-code-text': themeToUse.colors.text,
      '--md-theme-link': themeToUse.colors.primary,
      '--md-theme-border': themeToUse.colors.border,
      '--md-theme-heading': themeToUse.colors.text,
      '--md-theme-quote-bg': themeToUse.colors.backgroundLight,
      '--md-theme-quote-border': themeToUse.colors.primary,
    } as React.CSSProperties,
    // Pass theme colors as props if the component accepts them
    theme: themeToUse,
  };
  
  return (
    <div 
      className="themed-markdown-container"
      style={{
        // Container styles that respect the theme
        color: themeToUse.colors.text,
        backgroundColor: 'transparent',
        // CSS variables for child elements
        ...themedProps.style
      }}
    >
      <style>
        {`
          .themed-markdown-container {
            /* Base text styling */
            color: var(--md-theme-text);
            line-height: 1.6;
          }
          
          .themed-markdown-container h1,
          .themed-markdown-container h2,
          .themed-markdown-container h3,
          .themed-markdown-container h4,
          .themed-markdown-container h5,
          .themed-markdown-container h6 {
            color: var(--md-theme-heading);
            font-weight: 600;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }
          
          .themed-markdown-container a {
            color: var(--md-theme-link);
            text-decoration: none;
            transition: opacity 0.2s;
          }
          
          .themed-markdown-container a:hover {
            opacity: 0.8;
            text-decoration: underline;
          }
          
          .themed-markdown-container code {
            background-color: var(--md-theme-code-bg);
            color: var(--md-theme-code-text);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
            font-size: 0.9em;
          }
          
          .themed-markdown-container pre {
            background-color: var(--md-theme-code-bg);
            border: 1px solid var(--md-theme-border);
            border-radius: 6px;
            padding: 12px;
            overflow-x: auto;
          }
          
          .themed-markdown-container pre code {
            background-color: transparent;
            padding: 0;
          }
          
          .themed-markdown-container blockquote {
            border-left: 4px solid var(--md-theme-quote-border);
            background-color: var(--md-theme-quote-bg);
            margin: 1em 0;
            padding: 0.5em 1em;
            font-style: italic;
          }
          
          .themed-markdown-container table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
          }
          
          .themed-markdown-container th,
          .themed-markdown-container td {
            border: 1px solid var(--md-theme-border);
            padding: 8px 12px;
            text-align: left;
          }
          
          .themed-markdown-container th {
            background-color: var(--md-theme-code-bg);
            font-weight: 600;
          }
          
          .themed-markdown-container tr:nth-child(even) {
            background-color: var(--md-theme-code-bg);
            opacity: 0.5;
          }
          
          .themed-markdown-container hr {
            border: none;
            border-top: 1px solid var(--md-theme-border);
            margin: 2em 0;
          }
          
          .themed-markdown-container img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
          }
          
          .themed-markdown-container ul,
          .themed-markdown-container ol {
            padding-left: 2em;
            margin: 1em 0;
          }
          
          .themed-markdown-container li {
            margin: 0.5em 0;
          }
          
          /* Syntax highlighting adjustments for different themes */
          .themed-markdown-container .hljs {
            background-color: var(--md-theme-code-bg) !important;
            color: var(--md-theme-code-text) !important;
          }
          
          /* Task list styling */
          .themed-markdown-container input[type="checkbox"] {
            margin-right: 0.5em;
          }
          
          .themed-markdown-container .task-list-item {
            list-style-type: none;
            margin-left: -1.5em;
          }
        `}
      </style>
      <IndustryMarkdownSlide {...props} />
    </div>
  );
};

// Export a hook for accessing the markdown theme based on user preferences
export const useMarkdownTheme = (useCustom: boolean = false) => {
  const { theme: appTheme } = useTheme();
  const [customTheme, setCustomTheme] = React.useState<any>(null);
  
  React.useEffect(() => {
    if (useCustom) {
      UserPreferencesService.getPreferences()
        .then(prefs => {
          if (prefs.useCustomMarkdownTheme && prefs.customMarkdownTheme) {
            setCustomTheme(prefs.customMarkdownTheme);
          }
        })
        .catch(console.error);
    }
  }, [useCustom]);
  
  // Return custom theme if available and requested, otherwise app theme
  return (useCustom && customTheme) ? customTheme : appTheme;
};