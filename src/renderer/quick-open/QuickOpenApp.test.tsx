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

type ItemsCallback = (event: unknown, items: unknown[]) => void;

let itemsCallback: ItemsCallback | null = null;

const selectQuickOpenItem = jest.fn();
const cloneGitHubRepo = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  itemsCallback = null;
  Element.prototype.scrollIntoView = jest.fn();
  Object.assign(window, {
    electronAPI: {
      onQuickOpenItems: jest.fn((callback: ItemsCallback) => {
        itemsCallback = callback;
        return () => {};
      }),
      requestQuickOpenItems: jest.fn(),
      selectQuickOpenItem,
      closeQuickOpen: jest.fn(),
      isAuthenticated: jest.fn().mockResolvedValue(true),
      cloneGitHubRepo,
      searchGitHub: jest.fn().mockResolvedValue([
        {
          id: 1,
          full_name: 'acme/widgets',
          description: 'Widgets',
          owner: { login: 'acme', avatar_url: 'https://github.com/acme.png' },
          stargazers_count: 42,
          clone_url: 'https://github.com/acme/widgets.git',
          html_url: 'https://github.com/acme/widgets',
        },
      ]),
    },
  });
});

afterEach(() => {
  jest.useRealTimers();
});

/** Render and push an item list down from "main", optionally switching mode. */
async function renderQuickOpen(items: unknown[], mode?: 'Clones' | 'Orgs') {
  await act(async () => {
    render(<QuickOpenApp />);
  });
  await act(async () => {
    itemsCallback?.(null, items);
  });
  if (mode) {
    fireEvent.click(screen.getByRole('button', { name: mode }));
  }
  return screen.getByPlaceholderText(
    mode === 'Orgs'
      ? 'Search owner folders...'
      : 'Search cloned repositories...',
  );
}

const ownerDirectoryItem = {
  id: 'owner-directory:/dev/acme',
  type: 'ownerDirectory',
  name: 'acme',
  description: '/dev/acme',
  localPath: '/dev/acme',
  isOpen: false,
  cloneCount: 2,
};

const repositoryItem = {
  id: '/dev/acme/widgets',
  type: 'repository',
  name: 'widgets',
  description: '/dev/acme/widgets',
  localPath: '/dev/acme/widgets',
  isOpen: false,
};

describe('GitHub Quick Open', () => {
  it.each(['click', 'Enter'])(
    'selects a GitHub repo for Explorer using %s without cloning',
    async (method) => {
      await act(async () => {
        render(<QuickOpenApp />);
      });
      fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));
      const input = screen.getByPlaceholderText(
        'Search GitHub repositories...',
      );
      fireEvent.change(input, { target: { value: 'widgets' } });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

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
      expect(
        screen.queryByText('Cloning repository...'),
      ).not.toBeInTheDocument();
    },
  );
});

describe('Quick Open modes', () => {
  it('offers Clones, Orgs and GitHub in that order', async () => {
    await renderQuickOpen([repositoryItem, ownerDirectoryItem]);
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Clones', 'Orgs', 'GitHub']);
  });

  it('lists only cloned repositories in Clones', async () => {
    await renderQuickOpen([ownerDirectoryItem, repositoryItem], 'Clones');
    expect(screen.getByText('widgets')).toBeInTheDocument();
    expect(screen.queryByText('acme')).not.toBeInTheDocument();
  });

  it('opens a terminal at the owner folder from Orgs', async () => {
    const input = await renderQuickOpen(
      [repositoryItem, ownerDirectoryItem],
      'Orgs',
    );
    expect(screen.getByText('acme')).toBeInTheDocument();
    expect(screen.queryByText('widgets')).not.toBeInTheDocument();
    expect(screen.getByText('Enter Terminal')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(selectQuickOpenItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ownerDirectory',
        localPath: '/dev/acme',
        name: 'acme',
      }),
    );
  });

  it('shows how many clones live in each owner folder', async () => {
    await renderQuickOpen([ownerDirectoryItem], 'Orgs');
    expect(screen.getByText(/2 clones · terminal/)).toBeInTheDocument();
  });

  it('filters owner folders by name', async () => {
    const input = await renderQuickOpen(
      [ownerDirectoryItem, repositoryItem],
      'Orgs',
    );
    fireEvent.change(input, { target: { value: 'wid' } });

    expect(screen.getByText('No owner folders found')).toBeInTheDocument();
    expect(screen.queryByText('acme')).not.toBeInTheDocument();
  });

  it('cycles Clones → Orgs → GitHub with Tab', async () => {
    const input = await renderQuickOpen([ownerDirectoryItem, repositoryItem]);
    expect(
      screen.getByPlaceholderText('Search cloned repositories...'),
    ).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Tab' });
    expect(screen.getByText('acme')).toBeInTheDocument();
    expect(screen.queryByText('widgets')).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Tab' });
    expect(
      screen.getByPlaceholderText('Search GitHub repositories...'),
    ).toBeInTheDocument();
  });

  it('opens a repository from Clones on Enter', async () => {
    const input = await renderQuickOpen([ownerDirectoryItem, repositoryItem]);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(selectQuickOpenItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'repository',
        localPath: '/dev/acme/widgets',
      }),
    );
  });
});
