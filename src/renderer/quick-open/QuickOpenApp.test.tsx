import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import QuickOpenApp from './QuickOpenApp';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {},
      fonts: { body: 'sans-serif' },
      fontSizes: [12, 14, 16, 18, 20],
    },
  }),
}));

describe('GitHub Quick Open', () => {
  const selectQuickOpenItem = jest.fn();
  const cloneGitHubRepo = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Element.prototype.scrollIntoView = jest.fn();
    Object.assign(window, {
      electronAPI: {
        onQuickOpenItems: jest.fn(),
        requestQuickOpenItems: jest.fn(),
        selectQuickOpenItem,
        closeQuickOpen: jest.fn(),
        isAuthenticated: jest.fn().mockResolvedValue(true),
        cloneGitHubRepo,
        searchGitHub: jest.fn().mockResolvedValue([{
          id: 1,
          full_name: 'acme/widgets',
          description: 'Widgets',
          owner: { login: 'acme', avatar_url: 'https://github.com/acme.png' },
          stargazers_count: 42,
          clone_url: 'https://github.com/acme/widgets.git',
          html_url: 'https://github.com/acme/widgets',
        }]),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['click', 'Enter'])(
    'selects a GitHub repo for Explorer using %s without cloning',
    async (method) => {
      await act(async () => { render(<QuickOpenApp />); });
      fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));
      const input = screen.getByPlaceholderText('Search GitHub repositories...');
      fireEvent.change(input, { target: { value: 'widgets' } });
      await act(async () => { jest.advanceTimersByTime(300); });

      expect(screen.getByText('Enter Explore')).toBeInTheDocument();
      if (method === 'click') {
        fireEvent.click(screen.getByAltText('acme/widgets'));
      } else {
        fireEvent.keyDown(input, { key: 'Enter' });
      }
      expect(selectQuickOpenItem).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'github', fullName: 'acme/widgets' }),
      );
      expect(cloneGitHubRepo).not.toHaveBeenCalled();
      expect(screen.queryByText('Cloning repository...')).not.toBeInTheDocument();
    },
  );
});
