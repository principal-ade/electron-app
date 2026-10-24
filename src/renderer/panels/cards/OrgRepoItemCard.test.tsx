import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrgRepoItemCard } from './OrgRepoItemCard';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14] },
  }),
}));

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
