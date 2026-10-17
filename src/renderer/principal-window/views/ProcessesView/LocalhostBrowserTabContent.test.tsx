/// <reference types="jest" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocalhostBrowserTabContent } from './LocalhostBrowserTabContent';
import { ProcessRegistryService } from '../../../main-process-api/ProcessRegistryService';

jest.mock('@principal-ade/panel-framework-core', () => ({
  PanelEventBus: class {},
}));
jest.mock('@industry-theme/localhost-panels', () => {
  const React = require('react');
  return {
    panels: [
      {
        metadata: { id: 'principal-ade.localhost-browser' },
        component: ({
          initialPort,
          initialPath,
        }: {
          initialPort: number;
          initialPath: string;
        }) =>
          React.createElement(
            'div',
            { 'data-testid': 'browser' },
            `${initialPort}${initialPath}`,
          ),
      },
    ],
  };
});
jest.mock('../../../main-process-api/ProcessRegistryService', () => ({
  ProcessRegistryService: {
    logs: jest.fn(),
    stop: jest.fn(),
    restart: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (ProcessRegistryService.logs as jest.Mock).mockResolvedValue([
    'server output',
  ]);
  (ProcessRegistryService.stop as jest.Mock).mockResolvedValue({
    success: true,
  });
  (ProcessRegistryService.restart as jest.Mock).mockResolvedValue({
    success: true,
  });
});

test('linked tabs show unavailable servers and resume at a new port', () => {
  const { rerender } = render(
    <LocalhostBrowserTabContent
      port={5173}
      path="/docs"
      processId="server-1"
      processStatus="stopped"
      processReady={false}
    />,
  );
  expect(screen.queryByTestId('browser')).toBeNull();
  expect(screen.getByText(/Server unavailable/)).toBeTruthy();
  rerender(
    <LocalhostBrowserTabContent
      port={6006}
      path="/docs"
      processId="server-1"
      processStatus="running"
      processReady
    />,
  );
  expect(screen.getByTestId('browser').textContent).toBe('6006/docs');
});

test('controls are explicit and unmounting does not stop a process', async () => {
  const { unmount } = render(
    <LocalhostBrowserTabContent
      port={5173}
      processId="server-1"
      processStatus="running"
      processReady
    />,
  );
  expect(ProcessRegistryService.stop).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Logs' }));
  await waitFor(() => expect(screen.getByText('server output')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await waitFor(() =>
    expect(ProcessRegistryService.stop).toHaveBeenCalledWith('server-1'),
  );
  unmount();
  expect(ProcessRegistryService.stop).toHaveBeenCalledTimes(1);
});

test('unassociated URL tabs render without process controls', () => {
  render(<LocalhostBrowserTabContent port={5173} path="/" />);
  expect(screen.getByTestId('browser')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
});
