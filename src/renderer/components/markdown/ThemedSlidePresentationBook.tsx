import React from 'react';
import {
  SlidePresentationBook,
  SlidePresentationBookProps,
} from 'themed-markdown';
import { useTheme } from '@principal-ade/industry-theme';
import type { Theme } from '@principal-ade/industry-theme';

/**
 * ThemedSlidePresentationBook - A wrapper around SlidePresentationBook with theme support
 *
 * This component provides the new book view mode for presentations where:
 * - 'single' mode shows one slide at a time (traditional presentation)
 * - 'book' mode shows two slides side-by-side like pages in a book
 */
export type ThemedSlidePresentationBookProps = Omit<
  SlidePresentationBookProps,
  'theme'
> & {
  theme?: Theme; // Optional explicit theme override
};

export const ThemedSlidePresentationBook: React.FC<
  ThemedSlidePresentationBookProps
> = ({ theme, ...props }) => {
  const { theme: appTheme } = useTheme();

  // Use explicit theme if provided, otherwise use app theme
  const themeToUse = theme || appTheme;

  return <SlidePresentationBook {...props} theme={themeToUse} />;
};
