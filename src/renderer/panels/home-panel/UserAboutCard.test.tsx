import React from 'react';
import { render, screen } from '@testing-library/react';
import { UserAboutCard } from './UserAboutCard';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {},
      fonts: {},
      fontSizes: [10, 12, 14, 16, 18],
      fontWeights: {},
    },
  }),
}));

test.each(['git', 'github'] as const)(
  'shows the %s identity without hover tooltips',
  (source) => {
    const { container } = render(
      <UserAboutCard info={{ source, login: 'owner', name: 'Owner' }} />,
    );
    expect(container.querySelector('[title]')).toBeNull();
    if (source === 'github') {
      expect(
        screen.getByRole('button', { name: 'Authenticated with GitHub CLI' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('link', { name: 'Open @owner on GitHub' }),
      ).toBeTruthy();
    }
  },
);
