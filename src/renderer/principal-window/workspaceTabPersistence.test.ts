import type { SavedRequest } from '../../shared/requests/preparedRequest';
import type { WorkspaceTab } from './PortalTabsContext';
import {
  createWorkspaceTabsSnapshot,
  restoreWorkspaceTabsSnapshot,
} from './workspaceTabPersistence';

describe('workspace tab persistence', () => {
  it('preserves tab order and active selection while omitting terminal commands', () => {
    const tabs = [
      {
        id: 'terminal-a',
        label: 'Terminal',
        contentType: 'terminal',
        closable: true,
        directory: '/repo',
        command: 'echo should-not-run-on-restore',
      },
      {
        id: 'source-file-/repo/index.ts',
        label: 'index.ts',
        contentType: 'source-file',
        closable: true,
        filePath: '/repo/index.ts',
      },
    ] as WorkspaceTab[];

    const snapshot = createWorkspaceTabsSnapshot(tabs, tabs[1].id);
    const restored = restoreWorkspaceTabsSnapshot(snapshot, []);

    expect(restored?.tabs.map((tab) => tab.id)).toEqual([
      'terminal-a',
      'source-file-/repo/index.ts',
    ]);
    expect(restored?.activeTabId).toBe('source-file-/repo/index.ts');
    expect(snapshot.tabs[0]).not.toHaveProperty('command');
  });

  it('stores request tab identity, then rebuilds transient panel state from the secure catalog', () => {
    const tab = {
      id: 'http-request-saved-route',
      label: 'Private endpoint',
      contentType: 'http-request',
      closable: true,
      savedRequestId: 'saved-route',
      sessionId: 'old-session',
      panelState: {
        request: { http: { method: 'GET', url: 'https://example.test' } },
        requestId: 'saved-route',
        environment: { TOKEN: 'secret-value' },
        environmentName: 'Production',
        response: { status: 200 },
        error: 'old error',
        isSending: true,
      },
    } as unknown as WorkspaceTab;
    const snapshot = createWorkspaceTabsSnapshot([tab], tab.id);

    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(snapshot.tabs[0]).not.toHaveProperty('panelState');
    expect(snapshot.tabs[0]).not.toHaveProperty('sessionId');

    const request = {
      id: 'saved-route',
      title: 'Private endpoint',
      request: { http: { method: 'POST', url: 'https://example.test' } },
      environment: { TOKEN: 'secret-value' },
    } as unknown as SavedRequest;
    const restored = restoreWorkspaceTabsSnapshot(snapshot, [request]);
    const requestTab = restored?.tabs[0];

    expect(requestTab).toMatchObject({
      id: tab.id,
      contentType: 'http-request',
      sessionId: expect.any(String),
      panelState: {
        request: request.request,
        environment: request.environment,
        response: null,
        error: null,
        isSending: false,
      },
    });
    expect((requestTab as { sessionId: string }).sessionId).not.toBe(
      'old-session',
    );
  });

  it('drops malformed descriptors and request tabs missing from the catalog', () => {
    const restored = restoreWorkspaceTabsSnapshot(
      {
        version: 1,
        activeTabId: 'missing',
        tabs: [
          { id: 'bad', contentType: 'unknown', label: 'Bad', closable: true },
          {
            id: 'terminal-no-directory',
            contentType: 'terminal',
            label: 'Terminal',
            closable: true,
          },
          {
            id: 'http-request-gone',
            contentType: 'http-request',
            label: 'Gone',
            closable: true,
            savedRequestId: 'forgotten',
          },
          {
            id: 'local-topic-topic-1',
            contentType: 'local-topic',
            label: 'Topic',
            closable: true,
            topicId: 'topic-1',
          },
        ],
      },
      [],
    );

    expect(restored?.tabs.map((tab) => tab.id)).toEqual([
      'local-topic-topic-1',
    ]);
    expect(restored?.activeTabId).toBe('local-topic-topic-1');
  });
});
