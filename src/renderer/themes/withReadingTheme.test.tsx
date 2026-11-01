/// <reference types="jest" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  ThemeProvider,
  slateNeonTheme,
  slatePeachTheme,
  useTheme,
} from '@principal-ade/industry-theme';
import { withReadingTheme } from './withReadingTheme';

const ThemeProbe = ({ label }: { label: string }) => {
  const { theme } = useTheme();
  return (
    <div
      data-testid={label}
      data-primary={theme.colors.primary}
      data-accent={theme.colors.accent}
    >
      {label}
    </div>
  );
};

const ReadingProbe = withReadingTheme(ThemeProbe);

test('scopes Slate Peach to the wrapped reading surface and forwards props', () => {
  render(
    <ThemeProvider theme={slateNeonTheme}>
      <ThemeProbe label="before" />
      <ReadingProbe label="reading" />
      <ThemeProbe label="after" />
    </ThemeProvider>,
  );
  expect(screen.getByTestId('reading').getAttribute('data-primary')).toBe(
    slatePeachTheme.colors.primary,
  );
  expect(screen.getByTestId('reading').getAttribute('data-accent')).toBe(
    slatePeachTheme.colors.accent,
  );
  for (const label of ['before', 'after']) {
    expect(screen.getByTestId(label).getAttribute('data-primary')).toBe(
      slateNeonTheme.colors.primary,
    );
    expect(screen.getByTestId(label).getAttribute('data-accent')).toBe(
      slateNeonTheme.colors.accent,
    );
  }
});

test('can render a reading surface without an outer theme provider', () => {
  render(<ReadingProbe label="standalone" />);
  expect(screen.getByTestId('standalone').getAttribute('data-primary')).toBe(
    '#e6a080',
  );
  expect(screen.getByTestId('standalone').getAttribute('data-accent')).toBe(
    '#7ccf9a',
  );
});
