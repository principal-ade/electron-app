import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ProcessEntry } from '../../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import { ProcessRegistryService } from '../../main-process-api/ProcessRegistryService';
import { LocalhostDetectionService } from '../../main-process-api/LocalhostDetectionService';
import { useWorkspaceTabs } from '../../principal-window/PortalTabsContext';
import { HomeProcessRow } from './HomeProcessRow';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: { body: 'sans-serif' }, fontSizes: [10, 12] },
  }),
}));
jest.mock('../../principal-window/PortalTabsContext', () => ({
  useWorkspaceTabs: jest.fn(),
}));
jest.mock('../../main-process-api/ProcessRegistryService', () => ({
  ProcessRegistryService: {
    setPinned: jest.fn(),
    restart: jest.fn(),
    stop: jest.fn(),
    list: jest.fn(),
  },
}));
jest.mock('../../main-process-api/LocalhostDetectionService', () => ({
  LocalhostDetectionService: {
    killServer: jest.fn(),
    detectRunningServers: jest.fn(),
  },
}));

const entry: ProcessEntry = {
  id: 'server-1',
  label: 'Dev server',
  command: 'npm run dev',
  cwd: '/repo',
  kind: 'dev-server',
  origin: 'managed',
  status: 'running',
  startedAt: 1,
  port: 5173,
};
const openBrowser = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useWorkspaceTabs).mockReturnValue({
    openLocalhostBrowser: openBrowser,
  } as unknown as ReturnType<typeof useWorkspaceTabs>);
  jest
    .mocked(ProcessRegistryService.setPinned)
    .mockResolvedValue({ success: true });
  jest
    .mocked(ProcessRegistryService.restart)
    .mockResolvedValue({ success: true });
  jest.mocked(ProcessRegistryService.stop).mockResolvedValue({ success: true });
  jest.mocked(ProcessRegistryService.list).mockResolvedValue([entry]);
  jest
    .mocked(LocalhostDetectionService.killServer)
    .mockResolvedValue({ success: true });
  jest
    .mocked(LocalhostDetectionService.detectRunningServers)
    .mockResolvedValue({
      servers: [{ port: 5173, pid: 123, protocol: 'http', responsive: true }],
      scannedPorts: [5173],
      scanDuration: 1,
    });
});

test('clicking the process label opens its linked browser once', () => {
  render(<HomeProcessRow entry={entry} />);
  fireEvent.click(screen.getByText('Dev server'));
  expect(openBrowser).toHaveBeenCalledTimes(1);
  expect(openBrowser).toHaveBeenCalledWith(5173, '/', 'Dev server', 'server-1');
});

test('shows the open tab number and focuses that tab without navigating it', () => {
  const activate = jest.fn();
  const { rerender } = render(
    <HomeProcessRow
      entry={entry}
      openTab={{ id: 'browser', number: 3 }}
      onActivateTab={activate}
    />,
  );
  fireEvent.click(screen.getByText('Tab 3'));
  expect(activate).toHaveBeenCalledWith('browser');
  expect(openBrowser).not.toHaveBeenCalled();
  rerender(
    <HomeProcessRow
      entry={entry}
      openTab={{ id: 'browser', number: 1 }}
      onActivateTab={activate}
    />,
  );
  expect(screen.getByText('Tab 1')).toBeTruthy();
  expect(screen.queryByText('Tab 3')).toBeNull();
});

test('pin and stop controls do not focus an already-open browser', async () => {
  const activate = jest.fn();
  render(
    <HomeProcessRow
      entry={entry}
      openTab={{ id: 'browser', number: 2 }}
      onActivateTab={activate}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Pin Dev server' }));
  await waitFor(() =>
    expect(ProcessRegistryService.setPinned).toHaveBeenCalled(),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Stop Dev server',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Stop Dev server' }));
  await waitFor(() => expect(ProcessRegistryService.stop).toHaveBeenCalled());
  expect(activate).not.toHaveBeenCalled();
  expect(openBrowser).not.toHaveBeenCalled();
});

test('a stopped process can focus its existing tab without running again', () => {
  const activate = jest.fn();
  render(
    <HomeProcessRow
      entry={{ ...entry, status: 'stopped', pinned: true }}
      openTab={{ id: 'browser', number: 2 }}
      onActivateTab={activate}
    />,
  );
  fireEvent.click(screen.getByText('Tab 2'));
  expect(activate).toHaveBeenCalledWith('browser');
  expect(ProcessRegistryService.restart).not.toHaveBeenCalled();
  expect(openBrowser).not.toHaveBeenCalled();
});

test.each(['Enter', ' '])('opens the process row using the %s key', (key) => {
  render(<HomeProcessRow entry={entry} />);
  fireEvent.keyDown(
    screen.getByRole('button', { name: 'Open Dev server in browser' }),
    { key },
  );
  expect(openBrowser).toHaveBeenCalledTimes(1);
});

test('managed processes can be pinned without stopping or restarting them', async () => {
  render(<HomeProcessRow entry={entry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Pin Dev server' }));
  await waitFor(() =>
    expect(ProcessRegistryService.setPinned).toHaveBeenCalledWith(
      'server-1',
      true,
    ),
  );
  expect(ProcessRegistryService.restart).not.toHaveBeenCalled();
  expect(ProcessRegistryService.stop).not.toHaveBeenCalled();
  expect(openBrowser).not.toHaveBeenCalled();
});

test('stopping a process does not activate the row browser', async () => {
  render(<HomeProcessRow entry={entry} />);
  const stop = screen.getByRole('button', { name: 'Stop Dev server' });
  fireEvent.keyDown(stop, { key: 'Enter' });
  fireEvent.keyDown(stop, { key: ' ' });
  fireEvent.click(stop);
  await waitFor(() =>
    expect(ProcessRegistryService.stop).toHaveBeenCalledWith('server-1'),
  );
  expect(openBrowser).not.toHaveBeenCalled();
});

test('external processes remain visible and openable but have no pin or Run action', () => {
  render(<HomeProcessRow entry={{ ...entry, origin: 'detected' }} />);
  expect(screen.queryByText('External')).toBeNull();
  expect(screen.getByText('Dev server')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Pin|Run|Stop/ })).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Open Dev server in browser' }),
  );
  expect(openBrowser).toHaveBeenCalledWith(5173, '/', 'Dev server', undefined);
});

test('stopped pins only run when explicitly requested and never open stale ports', async () => {
  render(
    <HomeProcessRow entry={{ ...entry, pinned: true, status: 'stopped' }} />,
  );
  expect(ProcessRegistryService.restart).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /in browser/ })).toBeNull();
  fireEvent.click(screen.getByText('Dev server'));
  expect(ProcessRegistryService.restart).not.toHaveBeenCalled();
  expect(openBrowser).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Run Dev server' }));
  await waitFor(() =>
    expect(ProcessRegistryService.restart).toHaveBeenCalledWith('server-1'),
  );
});

test('a managed process without a port has no browser row action', () => {
  render(<HomeProcessRow entry={{ ...entry, port: undefined }} />);
  expect(screen.queryByRole('button', { name: /in browser/ })).toBeNull();
  fireEvent.click(screen.getByText('Dev server'));
  expect(openBrowser).not.toHaveBeenCalled();
});

test('reports failed persistence without hiding the process row', async () => {
  jest.mocked(ProcessRegistryService.setPinned).mockResolvedValue({
    success: false,
    error: 'Secure storage is locked.',
  });
  render(<HomeProcessRow entry={entry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Pin Dev server' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      'Secure storage is locked.',
    ),
  );
  expect(screen.getByText('Dev server')).toBeTruthy();
});

test('kill requires confirmation and cancelling does not kill or open the browser', () => {
  render(<HomeProcessRow entry={entry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kill Dev server' }));
  expect(screen.getByRole('dialog', { name: 'Kill process' })).toBeTruthy();
  expect(ProcessRegistryService.stop).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(ProcessRegistryService.stop).not.toHaveBeenCalled();
  expect(openBrowser).not.toHaveBeenCalled();
});

test('confirming kill terminates a managed process and refreshes the process list', async () => {
  const refresh = jest.fn();
  const activate = jest.fn();
  render(
    <HomeProcessRow
      entry={entry}
      openTab={{ id: 'browser', number: 1 }}
      onActivateTab={activate}
      onProcessKilled={refresh}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Kill Dev server' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Kill process',
    }),
  );
  await waitFor(() =>
    expect(ProcessRegistryService.stop).toHaveBeenCalledWith('server-1'),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(activate).not.toHaveBeenCalled();
  expect(openBrowser).not.toHaveBeenCalled();
});

test('confirmed external kill checks the current port owner before signalling its PID', async () => {
  const refresh = jest.fn();
  render(
    <HomeProcessRow
      entry={{ ...entry, origin: 'detected', pid: 123 }}
      onProcessKilled={refresh}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Kill Dev server' }));
  expect(screen.getByRole('dialog').textContent).toContain('PID 123');
  expect(screen.getByRole('dialog').textContent).toContain('port 5173');
  expect(LocalhostDetectionService.killServer).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Kill process',
    }),
  );
  await waitFor(() =>
    expect(LocalhostDetectionService.killServer).toHaveBeenCalledWith(123),
  );
  expect(LocalhostDetectionService.detectRunningServers).toHaveBeenCalledWith({
    ports: [5173],
  });
  expect(ProcessRegistryService.stop).not.toHaveBeenCalled();
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
});

test('does not kill an external process if the port owner changed during confirmation', async () => {
  jest
    .mocked(LocalhostDetectionService.detectRunningServers)
    .mockResolvedValue({
      servers: [{ port: 5173, pid: 456, protocol: 'http', responsive: true }],
      scannedPorts: [5173],
      scanDuration: 1,
    });
  render(<HomeProcessRow entry={{ ...entry, origin: 'detected', pid: 123 }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kill Dev server' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Kill process',
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'no longer listening',
    ),
  );
  expect(LocalhostDetectionService.killServer).not.toHaveBeenCalled();
});

test('keeps the confirmation open and reports termination failures', async () => {
  jest
    .mocked(ProcessRegistryService.stop)
    .mockResolvedValueOnce({ success: false, error: 'Permission denied.' });
  render(<HomeProcessRow entry={entry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kill Dev server' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Kill process',
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe('Permission denied.'),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
});

test('disables kill when an external PID is unavailable and hides it for stopped processes', () => {
  const { rerender } = render(
    <HomeProcessRow entry={{ ...entry, origin: 'detected' }} />,
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Kill Dev server',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  rerender(
    <HomeProcessRow entry={{ ...entry, status: 'stopped', pinned: true }} />,
  );
  expect(screen.queryByRole('button', { name: 'Kill Dev server' })).toBeNull();
});

test('does not kill a managed process that restarted during confirmation', async () => {
  jest
    .mocked(ProcessRegistryService.list)
    .mockResolvedValue([{ ...entry, pid: 456 }]);
  render(<HomeProcessRow entry={{ ...entry, pid: 123 }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kill Dev server' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Kill process',
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'changed or stopped',
    ),
  );
  expect(ProcessRegistryService.stop).not.toHaveBeenCalled();
});
