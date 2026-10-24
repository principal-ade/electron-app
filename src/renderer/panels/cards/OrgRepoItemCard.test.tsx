import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrgRepoItemCard } from './OrgRepoItemCard';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14] },
  }),
}));

test.each([undefined, true])(
  'uses square edges only when flush=%s',
  (flush) => {
    render(
      <OrgRepoItemCard
        repo={{ name: 'app' }}
        flush={flush}
        onClick={jest.fn()}
      />,
    );
    const row = screen.getByRole('button');
    expect(row.style.borderRadius).toBe(flush ? '0' : '6px');
    expect(row.style.paddingLeft).toBe('14px');
    expect(row.style.paddingTop).toBe(flush ? '8px' : '6px');
    expect(row.style.paddingBottom).toBe(flush ? '8px' : '6px');
  },
);

test('can hide all repository tooltips while keeping accessible action labels', () => {
  const { container } = render(
    <OrgRepoItemCard
      repo={{ name: 'app' }}
      title="Open repository"
      showTooltips={false}
      isCloned
      isDirty
      isPrivate
      watching
      sync={{ ahead: 2, behind: 1 }}
      onClick={jest.fn()}
      onOpenTerminal={jest.fn()}
      onRemove={jest.fn()}
      offConvention
      onRelocate={jest.fn()}
      onTogglePin={jest.fn()}
      onPushAhead={jest.fn()}
    />,
  );
  expect(container.querySelector('[title]')).toBeNull();
  expect(screen.getByRole('button', { name: 'Pin app to Home' })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Push 2 commits to remote' }),
  ).toBeTruthy();
  expect(screen.getByLabelText('Has uncommitted changes')).toBeTruthy();
});

test.each([false, true])(
  'orders the row as eye, remote status, then pin when pinned=%s',
  (pinned) => {
    const onClick = jest.fn();
    const onTogglePin = jest.fn();
    const { container } = render(
      <OrgRepoItemCard
        repo={{ name: 'app' }}
        isCloned
        sync={{ ahead: 2, behind: 1 }}
        watching
        pinned={pinned}
        onClick={onClick}
        onTogglePin={onTogglePin}
      />,
    );
    const pin = screen.getByRole('button', {
      name: pinned ? 'Unpin app from Home' : 'Pin app to Home',
    });
    const row = container.firstElementChild;
    const watch = screen.getByLabelText('Watching for live changes');
    expect(row?.lastElementChild).toBe(pin);
    expect(watch.nextElementSibling).toBe(pin.previousElementSibling);
    expect(
      watch.nextElementSibling?.contains(
        screen.getByTitle('2 commits ahead of remote'),
      ),
    ).toBe(true);
    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  },
);
