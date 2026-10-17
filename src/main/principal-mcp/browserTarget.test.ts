import {
  BrowserTargetError,
  parseLocalhostBrowserUrl,
  resolveBrowserTarget,
} from './browserTarget';
import type { ProcessEntry } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

const server: ProcessEntry = {
  id: 'server-1',
  label: 'Vite',
  command: 'npm run dev',
  cwd: '/repo',
  origin: 'managed',
  kind: 'dev-server',
  status: 'running',
  port: 5173,
  startedAt: 1,
};

describe('localhost browser targets', () => {
  test('preserves path, query and fragment, including explicit default port', () => {
    expect(
      parseLocalhostBrowserUrl('http://localhost:5173/docs?q=x#intro'),
    ).toEqual({ port: 5173, path: '/docs?q=x#intro' });
    expect(parseLocalhostBrowserUrl('http://localhost:80')).toEqual({
      port: 80,
      path: '/',
    });
  });

  test.each([
    'https://localhost:5173/',
    'http://localhost/',
    'http://127.0.0.1:5173/',
    'http://localhost.evil:5173/',
    'file:///tmp/index.html',
    'http://user@localhost:5173/',
    'http://localhost:5173@evil.com/',
    'http://localhost:0/',
    'http://localhost:65536/',
    'http://localhost:5173\\@evil/',
    'http://localhost:5173/\nfoo',
    'javascript:alert(1)',
    null,
    5173,
  ])('rejects unsupported URL %p', (url) => {
    expect(() => parseLocalhostBrowserUrl(url)).toThrow(BrowserTargetError);
  });

  test('resolves a managed process without starting it', () => {
    expect(
      resolveBrowserTarget({ processId: server.id, path: '/docs?x=1#top' }, [
        server,
      ]),
    ).toEqual({
      port: 5173,
      path: '/docs?x=1#top',
      processId: server.id,
      label: 'Vite',
    });
  });

  test('associates URLs only with a unique running managed process', () => {
    const request = { url: 'http://localhost:5173/docs' };
    expect(resolveBrowserTarget(request, [server]).processId).toBe(server.id);
    expect(resolveBrowserTarget(request, []).processId).toBeUndefined();
    expect(
      resolveBrowserTarget(request, [server, { ...server, id: 'other' }])
        .processId,
    ).toBeUndefined();
    expect(
      resolveBrowserTarget(request, [{ ...server, status: 'stopped' }])
        .processId,
    ).toBeUndefined();
    expect(
      resolveBrowserTarget(request, [{ ...server, origin: 'detected' }])
        .processId,
    ).toBeUndefined();
  });

  test.each([
    {},
    { processId: server.id, url: 'http://localhost:5173/' },
    { processId: '' },
    { processId: server.id, path: '//evil/' },
    { processId: server.id, path: '/\\evil/' },
    { processId: server.id, path: '/bad\npath' },
    { processId: server.id, label: 3 },
    { url: 'http://localhost:5173/', path: '/ignored' },
  ])('rejects malformed request %p', (body) => {
    expect(() => resolveBrowserTarget(body, [server])).toThrow(
      BrowserTargetError,
    );
  });

  test('distinguishes unknown from unavailable processes', () => {
    expect(() =>
      resolveBrowserTarget({ processId: 'missing' }, [server]),
    ).toThrow(expect.objectContaining({ status: 404 }));
    for (const entry of [
      { ...server, status: 'stopped' as const },
      { ...server, port: undefined },
    ]) {
      expect(() =>
        resolveBrowserTarget({ processId: server.id }, [entry]),
      ).toThrow(expect.objectContaining({ status: 409 }));
    }
  });
});
