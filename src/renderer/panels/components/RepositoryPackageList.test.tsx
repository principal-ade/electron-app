import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { ProcessEntry } from '../../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import { RepositoryPackageList } from './RepositoryPackageList';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { ProcessRegistryService } from '../../main-process-api/ProcessRegistryService';
import { useProcessRegistry } from '../../hooks/useProcessRegistry';
import { findAvailablePort } from '../../utils/portDetection';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({ theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14] } }),
}));
jest.mock('../../hooks/useProcessRegistry', () => ({ useProcessRegistry: jest.fn() }));
jest.mock('../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: { getPackages: jest.fn(), onCacheSync: jest.fn() },
}));
jest.mock('../../main-process-api/ProcessRegistryService', () => ({
  ProcessRegistryService: { list: jest.fn(), start: jest.fn(), restart: jest.fn() },
}));
jest.mock('../../utils/portDetection', () => ({ findAvailablePort: jest.fn() }));
jest.mock('../home-panel/HomeProcessRow', () => ({
  HomeProcessRow: ({ entry }: { entry: ProcessEntry }) => <div>{entry.label}: {entry.status}</div>,
}));

const pkg: PackageLayer = {
  id: 'components',
  name: 'components',
  type: 'node',
  enabled: true,
  derivedFrom: { fileSets: [], derivationType: 'content', description: 'Package manifest' },
  packageData: {
    name: '@org/components',
    version: '1.2.3',
    path: 'packages/components',
    manifestPath: 'packages/components/package.json',
    packageManager: 'npm',
    dependencies: { react: '^19' },
    devDependencies: { '@storybook/react': '^9' },
    peerDependencies: {},
    availableCommands: [{ name: 'storybook', command: 'storybook dev' }],
    isMonorepoRoot: false,
    isWorkspace: true,
  },
};
const process: ProcessEntry = {
  id: 'storybook-1',
  command: 'npm run storybook -- --port 6006',
  label: 'Storybook · components',
  cwd: '/repo/packages/components',
  kind: 'dev-server',
  status: 'running',
  origin: 'managed',
  startedAt: 1,
  port: 6006,
};
const refresh = jest.fn();
const openBrowser = jest.fn();
const unsubscribe = jest.fn();
let cacheChanged: Parameters<typeof RepositoryMonitoringService.onCacheSync>[0];

function setProcesses(entries: ProcessEntry[], loading = false) {
  jest.mocked(useProcessRegistry).mockReturnValue({
    entries, loading, error: null, refresh,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setProcesses([]);
  refresh.mockResolvedValue(undefined);
  jest.mocked(RepositoryMonitoringService.getPackages).mockResolvedValue({
    packages: [pkg],
    summary: {} as NonNullable<Awaited<ReturnType<typeof RepositoryMonitoringService.getPackages>>>['summary'],
  });
  jest.mocked(RepositoryMonitoringService.onCacheSync).mockImplementation((handler) => {
    cacheChanged = handler;
    return unsubscribe;
  });
  jest.mocked(ProcessRegistryService.list).mockResolvedValue([]);
  jest.mocked(ProcessRegistryService.start).mockResolvedValue({ success: true, process });
  jest.mocked(ProcessRegistryService.restart).mockResolvedValue({ success: true, process });
  jest.mocked(findAvailablePort).mockResolvedValue(6007);
});

test('shows package metadata and opens the manifest', async () => {
  const open = jest.fn();
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={open} />);
  const packageName = await screen.findByRole('button', { name: '@org/components' });
  expect(packageName.style.background).toBe('transparent');
  expect(packageName.style.fontSize).toBe('14px');
  fireEvent.click(packageName);
  expect(open).toHaveBeenCalledWith('packages/components/package.json');
  expect(screen.getByText('Packages (1)')).toBeTruthy();
  expect(screen.getByText('Packages (1)').parentElement?.style.gap).toBe('0');
  expect(screen.getByText('Packages (1)').style.marginBottom).toBe('8px');
  expect(screen.getByText('1.2.3')).toBeTruthy();
  expect(screen.getByText('1.2.3').style.fontSize).toBe('12px');
  expect(screen.queryByText('packages/components · npm')).toBeNull();
  expect(screen.queryByText(/dependencies · \d+ dev · \d+ peer/)).toBeNull();
});

test('spotlights hovered packages and clears on leave and unmount', async () => {
  const onPackageHover = jest.fn();
  const { unmount } = render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} onPackageHover={onPackageHover} />);
  const name = await screen.findByRole('button', { name: '@org/components' });
  const card = name.parentElement?.parentElement;
  if (!card) throw new Error('Package card not found');
  fireEvent.mouseEnter(card);
  expect(onPackageHover).toHaveBeenLastCalledWith('packages/components');
  fireEvent.mouseLeave(card);
  expect(onPackageHover).toHaveBeenLastCalledWith(null);
  fireEvent.mouseEnter(card);
  unmount();
  expect(onPackageHover).toHaveBeenLastCalledWith(null);
});

test('keeps the spotlight while focus moves within a package', async () => {
  const onPackageHover = jest.fn();
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} onPackageHover={onPackageHover} />);
  const name = await screen.findByRole('button', { name: '@org/components' });
  const start = screen.getByRole('button', { name: 'Start Storybook' });
  fireEvent.focus(name);
  expect(onPackageHover).toHaveBeenLastCalledWith('packages/components');
  fireEvent.blur(name, { relatedTarget: start });
  expect(onPackageHover).toHaveBeenLastCalledWith('packages/components');
  fireEvent.blur(start, { relatedTarget: document.body });
  expect(onPackageHover).toHaveBeenLastCalledWith(null);
});

test('spotlights the root package using its empty relative path', async () => {
  jest.mocked(RepositoryMonitoringService.getPackages).mockResolvedValue({
    packages: [{ ...pkg, packageData: { ...pkg.packageData, path: '' } }],
    summary: {} as NonNullable<Awaited<ReturnType<typeof RepositoryMonitoringService.getPackages>>>['summary'],
  });
  const onPackageHover = jest.fn();
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} onPackageHover={onPackageHover} />);
  fireEvent.focus(await screen.findByRole('button', { name: '@org/components' }));
  expect(onPackageHover).toHaveBeenLastCalledWith('');
});

test('starts detected Storybook through the existing process registry', async () => {
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} onOpenBrowser={openBrowser} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Storybook' }));
  await waitFor(() => expect(ProcessRegistryService.start).toHaveBeenCalledWith({
    command: 'npm',
    args: ['run', 'storybook', '--', '--port', '6007', '--no-open'],
    cwd: '/repo/packages/components',
    label: 'Storybook · @org/components',
    kind: 'dev-server',
  }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  await waitFor(() => expect(openBrowser).toHaveBeenCalledWith(6006, '/', process.label, process.id));
  expect(openBrowser).toHaveBeenCalledTimes(1);
});

test.each<ProcessEntry['status']>(['starting', 'running', 'restarting', 'stopping'])('shows the process row for %s Storybook without offering another launch', async (status) => {
  setProcesses([{ ...process, status }]);
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} onOpenBrowser={openBrowser} />);
  expect(await screen.findByText(`Storybook · components: ${status}`)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Start Storybook' })).toBeNull();
  expect(ProcessRegistryService.start).not.toHaveBeenCalled();
  expect(openBrowser).not.toHaveBeenCalled();
});

test('also recognizes externally detected Storybook processes', async () => {
  setProcesses([{ ...process, origin: 'detected' }]);
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  expect(await screen.findByText('Storybook · components: running')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Start Storybook' })).toBeNull();
});

test('does not confuse another clone or a sibling package with this package', async () => {
  setProcesses([
    { ...process, id: 'other-clone', cwd: '/other/packages/components' },
    { ...process, id: 'sibling', cwd: '/repo/packages/components-other' },
  ]);
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  expect(await screen.findByRole('button', { name: 'Start Storybook' })).toBeTruthy();
  expect(screen.queryByText('Storybook · components: running')).toBeNull();
});

test('rechecks registry state before launch and avoids a duplicate', async () => {
  jest.mocked(ProcessRegistryService.list).mockResolvedValue([process]);
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} onOpenBrowser={openBrowser} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Storybook' }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(ProcessRegistryService.start).not.toHaveBeenCalled();
  expect(findAvailablePort).not.toHaveBeenCalled();
  await waitFor(() => expect(openBrowser).toHaveBeenCalledWith(6006, '/', process.label, process.id));
});

test.each<ProcessEntry['status']>(['stopped', 'failed'])('shows Start Storybook for a %s process and reuses its saved command', async (status) => {
  const saved = { ...process, status };
  setProcesses([saved]);
  jest.mocked(ProcessRegistryService.list).mockResolvedValue([saved]);
  jest.mocked(ProcessRegistryService.restart).mockResolvedValue({
    success: true,
    process: { ...process, startedAt: 2, runCount: 2 },
  });
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} onOpenBrowser={openBrowser} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Storybook' }));
  expect(screen.queryByText(`Storybook · components: ${status}`)).toBeNull();
  await waitFor(() => expect(ProcessRegistryService.restart).toHaveBeenCalledWith(process.id));
  expect(ProcessRegistryService.start).not.toHaveBeenCalled();
  await waitFor(() => expect(openBrowser).toHaveBeenCalledWith(6006, '/', process.label, process.id));
});

test.each(['start', 'restart'])('opens one linked browser tab when the %s reports its actual port', async (action) => {
  const pending: ProcessEntry = { ...process, status: 'starting', port: undefined, startedAt: 2, runCount: 2 };
  const saved: ProcessEntry = { ...process, status: 'stopped', startedAt: 1, runCount: 1 };
  setProcesses(action === 'restart' ? [saved] : []);
  jest.mocked(ProcessRegistryService.list).mockResolvedValue(action === 'restart' ? [saved] : []);
  jest.mocked(ProcessRegistryService.start).mockResolvedValue({ success: true, process: pending });
  jest.mocked(ProcessRegistryService.restart).mockResolvedValue({ success: true, process: pending });
  const props = { repositoryPath: '/repo', onOpenFile: jest.fn(), onOpenBrowser: openBrowser };
  const { rerender } = render(<RepositoryPackageList {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Storybook' }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  // The old saved port must not be used after a restart.
  expect(openBrowser).not.toHaveBeenCalled();
  setProcesses([{ ...pending, status: 'running', port: 6011 }]);
  rerender(<RepositoryPackageList {...props} />);
  await waitFor(() => expect(openBrowser).toHaveBeenCalledWith(6011, '/', process.label, process.id));
  rerender(<RepositoryPackageList {...props} />);
  expect(openBrowser).toHaveBeenCalledTimes(1);
});

test('does not open a browser if the launched process fails before reporting a port', async () => {
  const pending: ProcessEntry = { ...process, status: 'starting', port: undefined };
  jest.mocked(ProcessRegistryService.start).mockResolvedValue({ success: true, process: pending });
  const props = { repositoryPath: '/repo', onOpenFile: jest.fn(), onOpenBrowser: openBrowser };
  const { rerender } = render(<RepositoryPackageList {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Storybook' }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  setProcesses([{ ...pending, status: 'failed' }]);
  rerender(<RepositoryPackageList {...props} />);
  expect(openBrowser).not.toHaveBeenCalled();
  // A later unrelated run must not steal focus after the requested run failed.
  setProcesses([process]);
  rerender(<RepositoryPackageList {...props} />);
  expect(openBrowser).not.toHaveBeenCalled();
});

test('replaces the process row with Start Storybook when the process stops', async () => {
  setProcesses([process]);
  const { rerender } = render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  await screen.findByText('Storybook · components: running');
  setProcesses([{ ...process, status: 'stopped' }]);
  rerender(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Start Storybook' })).toBeTruthy();
  expect(screen.queryByText('Storybook · components: running')).toBeNull();
  expect(screen.queryByText('Storybook · components: stopped')).toBeNull();
});

test('hides stopped entries while a matching Storybook process is active', async () => {
  setProcesses([process, { ...process, id: 'old-storybook', status: 'stopped' }]);
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  expect(await screen.findByText('Storybook · components: running')).toBeTruthy();
  expect(screen.queryByText('Storybook · components: stopped')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Start Storybook' })).toBeNull();
});

test('offers no Storybook action for packages without Storybook', async () => {
  jest.mocked(RepositoryMonitoringService.getPackages).mockResolvedValue({
    packages: [{ ...pkg, packageData: { ...pkg.packageData, availableCommands: [], devDependencies: {} } }],
    summary: {} as NonNullable<Awaited<ReturnType<typeof RepositoryMonitoringService.getPackages>>>['summary'],
  });
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  await screen.findByText('Packages (1)');
  expect(screen.queryByRole('button', { name: 'Start Storybook' })).toBeNull();
});

test('reports unavailable package data without showing an empty success', async () => {
  jest.mocked(RepositoryMonitoringService.getPackages).mockResolvedValue(null);
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  expect((await screen.findByRole('alert')).textContent).toBe('Package information is unavailable.');
  expect(screen.queryByText('No packages detected.')).toBeNull();
});

test('shows registry start failures and allows another attempt', async () => {
  jest.mocked(ProcessRegistryService.start).mockResolvedValue({ success: false, error: 'Launch failed' });
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} onOpenBrowser={openBrowser} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Storybook' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Launch failed');
  expect((screen.getByRole('button', { name: 'Start Storybook' }) as HTMLButtonElement).disabled).toBe(false);
  expect(openBrowser).not.toHaveBeenCalled();
});

test('refreshes on package cache updates and unsubscribes on unmount', async () => {
  const { unmount } = render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  await screen.findByText('Packages (1)');
  await act(async () => {
    cacheChanged({ repoPath: '/other', slice: 'packages' } as Parameters<typeof cacheChanged>[0]);
    cacheChanged({ repoPath: '/repo', slice: 'packages' } as Parameters<typeof cacheChanged>[0]);
  });
  expect(RepositoryMonitoringService.getPackages).toHaveBeenCalledTimes(2);
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

test('waits for the existing process list before enabling launch', async () => {
  setProcesses([], true);
  render(<RepositoryPackageList repositoryPath="/repo" onOpenFile={jest.fn()} />);
  expect((await screen.findByRole('button', { name: 'Start Storybook' }) as HTMLButtonElement).disabled).toBe(true);
});
