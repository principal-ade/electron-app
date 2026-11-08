import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Theme } from '@principal-ade/industry-theme';
import { useWorkspaceTabs } from '../../principal-window/PortalTabsContext';
import { OpenBotHeaderButton } from './OpenBotHeaderButton';

jest.mock('../../principal-window/PortalTabsContext', () => ({
  useWorkspaceTabs: jest.fn(),
}));

const theme = {
  colors: {
    backgroundSecondary: '#222',
    backgroundTertiary: '#333',
    border: '#444',
    text: '#fff',
    textSecondary: '#aaa',
  },
  fontSizes: [10, 12],
  fonts: { body: 'sans-serif' },
} as unknown as Theme;

test('opens the native OpenBot chat tab', () => {
  const openOpenBotChat = jest.fn();
  jest.mocked(useWorkspaceTabs).mockReturnValue({
    openOpenBotChat,
  } as unknown as ReturnType<typeof useWorkspaceTabs>);

  render(<OpenBotHeaderButton theme={theme} />);
  fireEvent.click(screen.getByRole('button', { name: 'OpenBot' }));

  expect(openOpenBotChat).toHaveBeenCalled();
});
