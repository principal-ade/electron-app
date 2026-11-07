import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PushToRemoteModal } from './PushToRemoteModal';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#111111',
        backgroundTertiary: '#222222',
        border: '#333333',
        info: '#4488ff',
        primary: '#4488ff',
        text: '#eeeeee',
        textSecondary: '#aaaaaa',
      },
      fonts: { body: 'sans-serif', monospace: 'monospace' },
      fontSizes: [10, 12, 14, 16],
      fontWeights: { semibold: 600 },
    },
  }),
}));

test('starts the push and closes the confirmation immediately', () => {
  const onPush = jest.fn();
  const TestHarness = () => {
    const [isOpen, setIsOpen] = React.useState(true);
    return (
      <PushToRemoteModal
        isOpen={isOpen}
        repoName="app"
        aheadCount={2}
        onPush={onPush}
        onClose={() => setIsOpen(false)}
      />
    );
  };
  render(<TestHarness />);

  fireEvent.click(screen.getByRole('button', { name: 'Push to remote' }));

  expect(onPush).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('app')).toBeNull();
});
