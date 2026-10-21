/** @jest-environment node */
import fs from 'fs';
import { safeStorage } from 'electron';
import { MAX_CATALOG_REQUESTS, RequestStore } from './RequestStore';

jest.mock('electron', () => ({
  app: { getPath: () => '/user-data' },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    getSelectedStorageBackend: jest.fn(() => 'gnome_libsecret'),
    encryptString: jest.fn(() => Buffer.from('encrypted')),
    decryptString: jest.fn(() => '[]'),
  },
}));
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => Buffer.from('encrypted')),
  writeFileSync: jest.fn(),
  renameSync: jest.fn(),
}));

const saved = {
  id: 'one',
  title: 'Test',
  request: { http: { method: 'GET', url: 'https://example.test' } },
  environment: { KEY: 'private-value' },
};
let plaintext: string;
beforeEach(() => {
  jest.clearAllMocks();
  plaintext = '[]';
  (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true);
  (safeStorage.decryptString as jest.Mock).mockImplementation(() => plaintext);
  (safeStorage.encryptString as jest.Mock).mockImplementation(
    (value: string) => {
      plaintext = value;
      return Buffer.from('encrypted');
    },
  );
});

test('encrypts full definitions and writes atomically with restricted permissions', () => {
  expect(new RequestStore().pin(saved)).toEqual([saved]);
  expect(safeStorage.encryptString).toHaveBeenCalledWith(
    JSON.stringify({ version: 1, requests: [{ ...saved, pinned: true }] }),
  );
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    '/user-data/pinned-http-requests.enc.tmp',
    Buffer.from('encrypted'),
    { mode: 0o600 },
  );
  expect(fs.renameSync).toHaveBeenCalledWith(
    '/user-data/pinned-http-requests.enc.tmp',
    '/user-data/pinned-http-requests.enc',
  );
});

test('loads after a fresh store instance, updates by id, and durably unpins', () => {
  plaintext = JSON.stringify([saved]);
  expect(new RequestStore().load()).toEqual([saved]);
  const changed = { ...saved, title: 'Changed' };
  expect(new RequestStore().pin(changed)).toEqual([changed]);
  expect(new RequestStore().unpin(saved.id)).toEqual([]);
  expect(new RequestStore().load()).toEqual([]);
  expect(new RequestStore().loadRoutes()).toEqual([
    { ...changed, pinned: false },
  ]);
});

test('round-trips optional unverified target metadata inside encrypted definitions', () => {
  const grouped = {
    ...saved,
    repositoryPath: '/work/frontend',
    target: {
      purl: 'pkg:github/unregistered/backend',
      identifier: 'component:api',
    },
  };
  expect(new RequestStore().pin(grouped)).toEqual([grouped]);
  expect(safeStorage.encryptString).toHaveBeenCalledWith(
    JSON.stringify({ version: 1, requests: [{ ...grouped, pinned: true }] }),
  );
  expect(new RequestStore().load()).toEqual([grouped]);
  const { target: _target, ...ungrouped } = grouped;
  expect(new RequestStore().pin(ungrouped)).toEqual([ungrouped]);
});

test('automatically remembers an unsent route and reuses its id with the latest complete definition', () => {
  const store = new RequestStore();
  expect(store.remember(saved)).toEqual(saved);
  expect(new RequestStore().loadRoutes()).toEqual([
    { ...saved, pinned: false },
  ]);
  expect(new RequestStore().load()).toEqual([]);
  const changed = {
    ...saved,
    id: 'fresh-transport-id',
    title: 'Latest definition',
    request: {
      http: { method: 'get', url: 'https://example.test?query=new' },
      body: { json: '{"updated":true}' },
      headers: [{ name: 'Authorization', value: 'private', enabled: true }],
    },
    environment: { KEY: 'updated-private-value' },
  };
  expect(store.remember(changed)).toEqual({ ...changed, id: saved.id });
  expect(new RequestStore().loadRoutes()).toEqual([
    {
      ...changed,
      id: saved.id,
      pinned: false,
    },
  ]);
  expect(fs.writeFileSync).toHaveBeenLastCalledWith(
    expect.any(String),
    Buffer.from('encrypted'),
    { mode: 0o600 },
  );
});

test('migrates encrypted pins in place without changing their ids or dropping them', () => {
  const other = {
    ...saved,
    id: 'two',
    request: { http: { method: 'POST', url: 'https://example.test' } },
  };
  plaintext = JSON.stringify([saved, other]);
  expect(new RequestStore().loadRoutes()).toEqual([
    { ...saved, pinned: true },
    { ...other, pinned: true },
  ]);
  expect(fs.writeFileSync).not.toHaveBeenCalled();
  const draft = {
    ...saved,
    id: 'three',
    target: { purl: 'repo', identifier: 'api' },
  };
  new RequestStore().remember(draft);
  expect(new RequestStore().load()).toEqual([saved, other]);
  expect(new RequestStore().loadRoutes()).toHaveLength(3);
  expect(JSON.parse(plaintext).version).toBe(1);
});

test('repreparing keeps favorite status and unpinning retains the latest definition across instances', () => {
  const store = new RequestStore();
  store.pin(saved);
  store.remember({ ...saved, id: 'incoming', title: 'Latest' });
  const changed = { ...saved, title: 'Latest' };
  expect(new RequestStore().load()).toEqual([changed]);
  store.unpin(saved.id);
  expect(new RequestStore().load()).toEqual([]);
  expect(new RequestStore().loadRoutes()).toEqual([
    { ...changed, pinned: false },
  ]);
  store.update({ ...changed, title: 'Explicit unpinned edit' });
  expect(new RequestStore().loadRoutes()).toEqual([
    {
      ...changed,
      title: 'Explicit unpinned edit',
      pinned: false,
    },
  ]);
});

test('does not conflate different methods, origins, literal paths, or target pairs', () => {
  const store = new RequestStore();
  const routes = [
    saved,
    {
      ...saved,
      id: 'two',
      request: { http: { method: 'POST', url: 'https://example.test' } },
    },
    {
      ...saved,
      id: 'three',
      request: { http: { method: 'GET', url: 'https://other.test' } },
    },
    {
      ...saved,
      id: 'four',
      request: { http: { method: 'GET', url: 'https://example.test/42' } },
    },
    {
      ...saved,
      id: 'five',
      request: { http: { method: 'GET', url: 'https://example.test/43' } },
    },
    { ...saved, id: 'six', target: { purl: 'repo', identifier: 'api' } },
    { ...saved, id: 'seven', target: { purl: 'repo', identifier: 'other' } },
  ];
  routes.forEach((route) => store.remember(route));
  expect(new RequestStore().loadRoutes()).toHaveLength(routes.length);
  expect(new RequestStore().load()).toEqual([]);
});

test('explicit edits reject route collisions rather than overwriting another retained definition', () => {
  const store = new RequestStore();
  store.remember(saved);
  const other = {
    ...saved,
    id: 'two',
    request: { http: { method: 'POST', url: 'https://example.test' } },
  };
  store.remember(other);
  const before = plaintext;
  expect(() => store.update({ ...saved, request: other.request })).toThrow(
    'already remembered',
  );
  expect(plaintext).toBe(before);
  expect(new RequestStore().loadRoutes()).toHaveLength(2);
});

test('forgetting removes only an unpinned definition, never a favorite implicitly', () => {
  const store = new RequestStore();
  store.pin(saved);
  expect(() => store.forget(saved.id)).toThrow('Unpin');
  expect(new RequestStore().load()).toEqual([saved]);
  store.unpin(saved.id);
  expect(store.forget(saved.id)).toEqual([]);
  expect(new RequestStore().loadRoutes()).toEqual([]);
});

test('capacity never silently evicts routes and still allows existing route updates', () => {
  plaintext = JSON.stringify({
    version: 1,
    requests: Array.from({ length: MAX_CATALOG_REQUESTS }, (_, index) => ({
      ...saved,
      id: `route-${index}`,
      pinned: false,
      request: {
        http: { method: 'GET', url: `https://example.test/${index}` },
      },
    })),
  });
  const store = new RequestStore();
  expect(() => store.remember(saved)).toThrow('catalog is full');
  expect(fs.writeFileSync).not.toHaveBeenCalled();
  expect(
    store.remember({
      ...saved,
      title: 'Updated',
      request: { http: { method: 'GET', url: 'https://example.test/0?q=new' } },
    }).id,
  ).toBe('route-0');
  expect(new RequestStore().loadRoutes()).toHaveLength(MAX_CATALOG_REQUESTS);
});

test.each([
  { version: 2, requests: [] },
  { version: 1, requests: [{ ...saved }] },
  { version: 1, requests: [{ ...saved, pinned: 'false' }] },
  {
    version: 1,
    requests: [{ ...saved, pinned: false, response: { status: 200 } }],
  },
])('does not overwrite a malformed or unsupported catalog', (value) => {
  plaintext = JSON.stringify(value);
  expect(() => new RequestStore().remember(saved)).toThrow();
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});

test('never falls back to plaintext and does not overwrite corrupt data', () => {
  (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(false);
  expect(() => new RequestStore().pin(saved)).toThrow('Secure storage');
  expect(fs.writeFileSync).not.toHaveBeenCalled();
  (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true);
  (safeStorage.decryptString as jest.Mock).mockReturnValue('not json');
  expect(() => new RequestStore().pin(saved)).toThrow();
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});

test('rejects saved responses and malformed loaded definitions', () => {
  expect(() =>
    new RequestStore().pin({ ...saved, response: { status: 200 } }),
  ).toThrow();
  (safeStorage.decryptString as jest.Mock).mockReturnValue(
    JSON.stringify([{ id: 'broken' }]),
  );
  expect(() => new RequestStore().load()).toThrow();
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});
