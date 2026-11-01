import React from 'react';
import { ThemeProvider, slatePeachTheme } from '@principal-ade/industry-theme';

/** Keep reading surfaces on Slate Peach without changing the surrounding app theme. */
export function withReadingTheme<Props extends object>(
  Component: React.ComponentType<Props>,
): React.FC<Props> {
  const ReadingSurface: React.FC<Props> = (props) => (
    <ThemeProvider theme={slatePeachTheme}>
      <Component {...props} />
    </ThemeProvider>
  );
  ReadingSurface.displayName = `withReadingTheme(${Component.displayName || Component.name || 'Component'})`;
  return ReadingSurface;
}
