import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { HomeTabEntry } from './homeTabEntries';
import { HomeTabRow, PinnedTabIcon } from './HomeTabItems';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14] },
  }),
}));

const profile: HomeTabEntry = {
  id: 'profile-app',
  kind: 'repo-tab',
  variant: 'project-info',
  label: 'owner/app',
  purl: 'pkg:github/owner/app',
};

test.each([true, false])(
  'shows Clone profile with a distinct icon when open=%s',
  (open) => {
    const activate = jest.fn();
    const pin = jest.fn();
    const { container } = render(
      <HomeTabRow
        entry={profile}
        open={open}
        pinned={!open}
        onActivate={activate}
        onTogglePin={pin}
      />,
    );
    expect(screen.getByText('Clone profile')).toBeTruthy();
    expect(screen.queryByText('owner/app')).toBeNull();
    expect(container.querySelector('.lucide-id-card')).not.toBeNull();
    fireEvent.click(screen.getByTitle('Open Clone profile'));
    expect(activate).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: /^(Pin|Unpin) Clone profile$/ }),
    ).toBeNull();
    expect(pin).not.toHaveBeenCalled();
  },
);

test('preserves explorer pin activation and unpinning', () => {
  const activate = jest.fn();
  const unpin = jest.fn();
  const { container } = render(
    <PinnedTabIcon
      entry={{ ...profile, variant: 'repo-explorer' }}
      active={false}
      onActivate={activate}
      onUnpin={unpin}
    />,
  );
  const button = screen.getByRole('button', {
    name: 'Reopen pinned tab Clone explorer',
  });
  expect(container.querySelector('.lucide-folder-search')).not.toBeNull();
  fireEvent.click(button);
  fireEvent.contextMenu(button);
  expect(activate).toHaveBeenCalledTimes(1);
  expect(unpin).toHaveBeenCalledTimes(1);
  expect(profile.label).toBe('owner/app');
});

test.each(['repo-explorer', 'file-city-guide'] as const)(
  'uses the appropriate label and icon for %s tabs',
  (variant) => {
    const { container } = render(
      <HomeTabRow
        entry={{ ...profile, variant }}
        open
        pinned={false}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
      />,
    );
    expect(
      screen.getByText(
        variant === 'repo-explorer' ? 'Clone explorer' : 'owner/app',
      ),
    ).toBeTruthy();
    expect(container.querySelector('.lucide-id-card')).toBeNull();
    expect(
      container.querySelector(
        variant === 'repo-explorer'
          ? '.lucide-folder-search'
          : '.lucide-building-2',
      ),
    ).not.toBeNull();
  },
);

test('uses Clone explorer for existing persisted explorer pins', () => {
  render(
    <PinnedTabIcon
      entry={{ ...profile, variant: 'repo-explorer' }}
      active={false}
      onActivate={jest.fn()}
      onUnpin={jest.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Reopen pinned tab Clone explorer' }),
  ).toBeTruthy();
});

test('keeps Clone explorer individually pinnable', () => {
  const pin = jest.fn();
  const activate = jest.fn();
  render(
    <HomeTabRow
      entry={{ ...profile, variant: 'repo-explorer' }}
      open
      pinned={false}
      onActivate={activate}
      onTogglePin={pin}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Pin Clone explorer' }));
  expect(pin).toHaveBeenCalledTimes(1);
  expect(activate).not.toHaveBeenCalled();
});

test.each(['project-info', 'repo-explorer'] as const)(
  'shows the current tab number for an open %s entry and updates after reordering',
  (variant) => {
    const activate = jest.fn();
    const props = {
      entry: { ...profile, variant },
      open: true,
      pinned: false,
      onActivate: activate,
      onTogglePin: jest.fn(),
    };
    const { rerender } = render(<HomeTabRow {...props} tabNumber={3} />);
    fireEvent.click(screen.getByText('Tab 3'));
    expect(activate).toHaveBeenCalledTimes(1);
    rerender(<HomeTabRow {...props} tabNumber={1} />);
    expect(screen.getByText('Tab 1')).toBeTruthy();
    expect(screen.queryByText('Tab 3')).toBeNull();
    rerender(<HomeTabRow {...props} open={false} pinned tabNumber={1} />);
    expect(screen.queryByText('Tab 1')).toBeNull();
  },
);

test('does not invent a tab number for a profile with no open tab position', () => {
  render(
    <HomeTabRow
      entry={profile}
      open
      pinned={false}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.queryByText(/^Tab /)).toBeNull();
});

test('shows a standalone terminal cwd instead of its tab number', () => {
  render(
    <HomeTabRow
      entry={{
        id: 'terminal-1',
        kind: 'terminal',
        label: 'Tab 2',
        path: '/Users/pat/code/scratch',
      }}
      open
      tabNumber={2}
      pinned={false}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.getByText('~/code/scratch')).toBeTruthy();
  expect(screen.queryByText('Tab 2')).toBeNull();
  expect(
    screen.getByTitle('Open terminal in /Users/pat/code/scratch'),
  ).toBeTruthy();
});

test('keeps the tab-number label for a repo-rooted terminal', () => {
  render(
    <HomeTabRow
      entry={{
        id: 'terminal-1',
        kind: 'terminal',
        label: 'Tab 2',
        path: '/work/app',
        repoPath: '/work/app',
      }}
      open
      pinned={false}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.getByText('Tab 2')).toBeTruthy();
  expect(screen.queryByText('/work/app')).toBeNull();
});

test('does not add a tab-number badge to other repository tab kinds', () => {
  render(
    <HomeTabRow
      entry={{ ...profile, variant: 'file-city-guide' }}
      open
      tabNumber={2}
      pinned={false}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.queryByText('Tab 2')).toBeNull();
});
