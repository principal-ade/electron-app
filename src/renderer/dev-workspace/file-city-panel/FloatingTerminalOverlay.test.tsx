import React from 'react';
import { render } from '@testing-library/react';
import { TerminalSession } from '@industry-theme/xterm-terminal-panel';
import { useTerminalImplementation } from '../../hooks/useTerminalImplementation';
import { useTerminalLinkRouting } from '../../hooks/useTerminalLinkRouting';
import { FloatingTerminalOverlay } from './FloatingTerminalOverlay';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({ theme: { colors: {}, fonts: { body: 'monospace' } } }),
}));
jest.mock('@industry-theme/xterm-terminal-panel', () => ({
  TerminalSession: jest.fn(() => null),
  getTerminalDirectory: () => '/repo',
}));
jest.mock('../../hooks/useTerminalImplementation');
jest.mock('../../hooks/useTerminalLinkRouting');

test.each(['xterm', 'ghostty'])(
  'wires floating %s links to the shared router',
  (renderer) => {
    const openLink = jest.fn();
    (useTerminalImplementation as jest.Mock).mockReturnValue(renderer);
    (useTerminalLinkRouting as jest.Mock).mockReturnValue(openLink);
    const props = {
      context: {},
      actions: {},
      defaultCollapsed: false,
    } as React.ComponentProps<typeof FloatingTerminalOverlay>;
    render(<FloatingTerminalOverlay {...props} />);
    const sessionCalls = (TerminalSession as unknown as jest.Mock).mock.calls;
    const session = sessionCalls[sessionCalls.length - 1][0];
    expect(session.renderer).toBe(renderer);
    expect(session.onLinkClick).toBe(openLink);
    session.onLinkClick('http://localhost:5173/');
    expect(openLink).toHaveBeenCalledWith('http://localhost:5173/');
  },
);
