import { renderHook, waitFor } from '@testing-library/react';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { LocalhostDetectionService } from '../main-process-api/LocalhostDetectionService';
import { ProcessRegistryService } from '../main-process-api/ProcessRegistryService';
import { useProcessRegistry } from './useProcessRegistry';

jest.mock('../main-process-api/AlexandriaService', () => ({
  AlexandriaService: { getRepositories: jest.fn() },
}));
jest.mock('../main-process-api/LocalhostDetectionService', () => ({
  LocalhostDetectionService: { detectRunningServers: jest.fn() },
}));
jest.mock('../main-process-api/ProcessRegistryService', () => ({
  ProcessRegistryService: {
    list: jest.fn(),
    onChanged: jest.fn(() => jest.fn()),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AlexandriaService.getRepositories).mockResolvedValue([]);
  jest.mocked(ProcessRegistryService.list).mockResolvedValue([]);
});

test.each([
  ['node', 'node :6006'],
  ['python3', 'python3 :6006'],
  ['  node  ', 'node :6006'],
  ['', 'localhost:6006'],
  [undefined, 'localhost:6006'],
])(
  'labels a detected %s process by executable and port',
  async (command, label) => {
    jest
      .mocked(LocalhostDetectionService.detectRunningServers)
      .mockResolvedValue({
        servers: [
          {
            port: 6006,
            command,
            label: 'repository-name',
            cwd: '/work/repository-name',
            protocol: 'http',
            responsive: true,
          },
        ],
        scannedPorts: [6006],
        scanDuration: 1,
      });
    const { result } = renderHook(() => useProcessRegistry());
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0]).toMatchObject({
      label,
      command: command || '',
      port: 6006,
      cwd: '/work/repository-name',
    });
  },
);

test('preserves managed process labels', async () => {
  jest.mocked(ProcessRegistryService.list).mockResolvedValue([
    {
      id: 'managed-1',
      label: 'My dev server',
      command: 'npm run dev',
      cwd: '/repo',
      kind: 'dev-server',
      origin: 'managed',
      status: 'running',
      startedAt: 1,
      port: 5173,
    },
  ]);
  jest
    .mocked(LocalhostDetectionService.detectRunningServers)
    .mockResolvedValue({
      servers: [],
      scannedPorts: [],
      scanDuration: 1,
    });
  const { result } = renderHook(() => useProcessRegistry());
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  expect(result.current.entries[0].label).toBe('My dev server');
});
