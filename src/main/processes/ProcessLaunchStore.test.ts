/** @jest-environment node */
import fs from 'fs';
import { safeStorage } from 'electron';
import { ProcessLaunchStore } from './ProcessLaunchStore';

jest.mock('electron', () => ({
  app: { getPath: () => '/user-data' },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    getSelectedStorageBackend: jest.fn(() => 'gnome_libsecret'),
    encryptString: jest.fn(() => Buffer.from('encrypted')),
    decryptString: jest.fn(),
  },
}));
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => Buffer.from('encrypted')),
  writeFileSync: jest.fn(),
  renameSync: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true);
});

test('encrypts the entire launch descriptor and writes atomically with restricted permissions', () => {
  const launches = [
    {
      id: 'server-1',
      request: {
        command: 'npm',
        args: ['run', 'dev'],
        cwd: '/repo',
        env: { KEY: 'value' },
      },
    },
  ];
  new ProcessLaunchStore().save(launches);
  expect(safeStorage.encryptString).toHaveBeenCalledWith(
    JSON.stringify(launches),
  );
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    '/user-data/pinned-process-launches.enc.tmp',
    Buffer.from('encrypted'),
    { mode: 0o600 },
  );
  expect(fs.renameSync).toHaveBeenCalledWith(
    '/user-data/pinned-process-launches.enc.tmp',
    '/user-data/pinned-process-launches.enc',
  );
});

test('never falls back to writing plaintext when encryption is unavailable', () => {
  (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(false);
  expect(() => new ProcessLaunchStore().save([])).toThrow('Secure storage');
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});

test('decrypts structured launch requests without parsing a display command', () => {
  const launches = [
    {
      id: 'server-1',
      request: { command: 'npm', args: ['argument with spaces'], cwd: '/repo' },
    },
  ];
  (safeStorage.decryptString as jest.Mock).mockReturnValue(
    JSON.stringify(launches),
  );
  expect(new ProcessLaunchStore().load()).toEqual(launches);
});

test('rejects invalid saved argument arrays', () => {
  (safeStorage.decryptString as jest.Mock).mockReturnValue(
    JSON.stringify([
      {
        id: 'bad',
        request: { command: 'npm', cwd: '/repo', args: 'run dev' },
      },
    ]),
  );
  expect(() => new ProcessLaunchStore().load()).toThrow(
    'Invalid saved process',
  );
});
