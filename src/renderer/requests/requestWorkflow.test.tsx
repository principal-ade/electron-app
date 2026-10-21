import React from 'react';
import { randomUUID } from 'crypto';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  PortalTabsProvider,
  useWorkspaceTabs,
} from '../principal-window/PortalTabsContext';
import { useBridgeRequestOpen } from '../hooks/useBridgeRequestOpen';
import { BrunoService } from '../main-process-api/BrunoService';
import { HttpRequestTabContent } from './HttpRequestTabContent';
import { savedDefinition } from './requestTabs';
import type {
  SavedRequest,
  OpenRequestEnvelope,
  CatalogRequest,
} from '../../shared/requests/preparedRequest';
import type { RequestPanelProps } from '@principal-ade/bruno-panels';

jest.mock('../main-process-api/TopicService', () => ({
  TopicService: { onTopicChange: () => () => {} },
}));
jest.mock('../main-process-api/ProcessRegistryService', () => ({
  ProcessRegistryService: { list: async () => [], onChanged: () => () => {} },
}));
jest.mock('../main-process-api/BrunoService', () => ({
  BrunoService: {
    listSaved: jest.fn(),
    listRoutes: jest.fn(),
    onCatalogChanged: jest.fn(() => () => {}),
    updateRoute: jest.fn(),
    pin: jest.fn(),
    unpin: jest.fn(),
    sendRequest: jest.fn(),
    onOpenRequest: jest.fn(),
    acknowledgeOpen: jest.fn(),
  },
}));
jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({ theme: { colors: {} } }),
}));
jest.mock('@principal-ade/panel-framework-core', () => ({
  PanelEventBus: class {},
}));
// Exercise the host-controlled interface. The package's editor/send behavior is
// covered by its interaction stories; the host must retain that state on remount.
jest.mock('@principal-ade/bruno-panels', () => ({
  RequestPanel: (props: RequestPanelProps) => {
    const { state, onStateChange } = props;
    if (!state?.request || !onStateChange)
      throw new Error('Expected a controlled request panel.');
    const request = state.request;
    return (
      <div>
        <input
          aria-label="Request URL"
          value={request.http.url}
          onChange={(event) =>
            onStateChange({
              ...state,
              request: {
                ...request,
                http: { ...request.http, url: event.target.value },
              },
            })
          }
        />
        <button
          type="button"
          onClick={async () => {
            onStateChange({ ...state, isSending: true });
            const response = await props.actions.sendRequest(
              request,
              state.environment,
            );
            onStateChange({ ...state, isSending: false, response });
          }}
        >
          Send
        </button>
        <span>
          {state.response ? `Response ${state.response.status}` : 'Not sent'}
        </span>
      </div>
    );
  },
}));

const prepared: SavedRequest = {
  id: 'one',
  title: 'Health',
  request: { http: { method: 'GET', url: 'https://example.test' } },
  environment: { key: 'private-value' },
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PortalTabsProvider>{children}</PortalTabsProvider>
);
let stored: CatalogRequest[];
beforeEach(() => {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
  jest.clearAllMocks();
  stored = [{ ...prepared, pinned: false }];
  (BrunoService.listRoutes as jest.Mock).mockImplementation(async () => stored);
  (BrunoService.pin as jest.Mock).mockImplementation(async (request) => {
    stored = [
      ...stored.filter((entry) => entry.id !== request.id),
      { ...request, pinned: true },
    ];
    return [request];
  });
  (BrunoService.unpin as jest.Mock).mockImplementation(async (id) => {
    stored = stored.map((entry) =>
      entry.id === id ? { ...entry, pinned: false } : entry,
    );
    return [];
  });
  (BrunoService.updateRoute as jest.Mock).mockImplementation(
    async (request) => {
      const pinned =
        stored.find((entry) => entry.id === request.id)?.pinned ?? false;
      stored = [
        ...stored.filter((entry) => entry.id !== request.id),
        { ...request, pinned },
      ];
      return stored;
    },
  );
  (BrunoService.onOpenRequest as jest.Mock).mockReturnValue(jest.fn());
  (BrunoService.sendRequest as jest.Mock).mockResolvedValue({
    status: 200,
    data: 'ok',
  });
});

test('bridge reveals the workspace and acknowledges a committed tab without sending', async () => {
  let onOpen!: (envelope: OpenRequestEnvelope) => void;
  const unsubscribe = jest.fn();
  (BrunoService.onOpenRequest as jest.Mock).mockImplementation((callback) => {
    onOpen = callback;
    return unsubscribe;
  });
  const reveal = jest.fn();
  const { result, unmount } = renderHook(
    () => {
      useBridgeRequestOpen(reveal);
      return useWorkspaceTabs();
    },
    { wrapper },
  );
  const target = {
    purl: 'pkg:github/unregistered/backend',
    identifier: 'Some C4 name',
  };
  await act(async () => onOpen({ ...prepared, target, requestId: 'bridge-1' }));
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.tabs[0]).toMatchObject({ target });
  expect(result.current.activeTabId).toBe('http-request-one');
  expect(reveal).toHaveBeenCalled();
  expect(BrunoService.acknowledgeOpen).toHaveBeenCalledWith(
    'bridge-1',
    'http-request-one',
  );
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
  act(() => result.current.openHttpRequest(prepared));
  expect(result.current.tabs).toHaveLength(1);
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

function Harness() {
  const workspace = useWorkspaceTabs();
  const tab = workspace.tabs.find(
    (entry) => entry.id === workspace.activeTabId,
  );
  return (
    <>
      <button type="button" onClick={() => workspace.openHttpRequest(prepared)}>
        Open prepared
      </button>
      <button type="button" onClick={() => workspace.setActiveTabId(null)}>
        Other tab
      </button>
      <button type="button" onClick={() => workspace.setTabs([])}>
        Close tabs
      </button>
      <span>Saved count {workspace.savedRequests.length}</span>
      {tab?.contentType === 'http-request' && (
        <HttpRequestTabContent key={tab.sessionId} tab={tab} />
      )}
    </>
  );
}

test('edits and responses survive remount, pins save only definitions, reopen never sends', async () => {
  render(<Harness />, { wrapper });
  fireEvent.click(screen.getByText('Open prepared'));
  fireEvent.change(screen.getByLabelText('Request URL'), {
    target: { value: 'https://example.test/edited' },
  });
  fireEvent.click(screen.getByText('Other tab'));
  fireEvent.click(screen.getByText('Open prepared'));
  expect((screen.getByLabelText('Request URL') as HTMLInputElement).value).toBe(
    'https://example.test/edited',
  );
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Send'));
  await screen.findByText('Response 200');
  fireEvent.click(screen.getByText('Other tab'));
  fireEvent.click(screen.getByText('Open prepared'));
  expect(screen.getByText('Response 200')).toBeTruthy();
  fireEvent.click(screen.getByText('Pin request'));
  await screen.findByText('Unpin request');
  const saved = (BrunoService.pin as jest.Mock).mock.calls[0][0];
  expect(saved.request.http.url).toBe('https://example.test/edited');
  expect(saved.environment).toEqual(prepared.environment);
  expect(saved).not.toHaveProperty('response');
  expect(saved).not.toHaveProperty('panelState');
  fireEvent.change(screen.getByLabelText('Request URL'), {
    target: { value: 'https://example.test/latest' },
  });
  fireEvent.click(screen.getByText('Save changes'));
  await screen.findByText('Saved');
  expect(
    (BrunoService.updateRoute as jest.Mock).mock.calls[0][0].request.http.url,
  ).toBe('https://example.test/latest');
  fireEvent.click(screen.getByText('Unpin request'));
  await screen.findByText('Pin request');
  expect(BrunoService.unpin).toHaveBeenCalledWith('one');
  expect(BrunoService.sendRequest).toHaveBeenCalledTimes(1);
});

test('fresh provider lists encrypted pins and reopening starts with no response or send', async () => {
  const grouped = {
    ...prepared,
    target: { purl: 'pkg:github/unregistered/backend', identifier: 'API' },
  };
  stored = [{ ...grouped, pinned: true }];
  const { result } = renderHook(useWorkspaceTabs, { wrapper });
  await waitFor(() => expect(result.current.savedRequests).toEqual([grouped]));
  act(() => result.current.openHttpRequest(result.current.savedRequests[0]));
  const tab = result.current.tabs[0];
  expect(tab.contentType).toBe('http-request');
  if (tab.contentType !== 'http-request') throw new Error('wrong tab');
  expect(tab.panelState).toMatchObject({
    response: null,
    isSending: false,
    error: null,
  });
  expect(savedDefinition(tab)).toEqual(grouped);
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test('group edits survive remount and explicit pin updates without changing execution', async () => {
  render(<Harness />, { wrapper });
  fireEvent.click(screen.getByText('Open prepared'));
  fireEvent.click(screen.getByText('Request group: Ungrouped'));
  fireEvent.change(screen.getByLabelText('Target PURL'), {
    target: { value: ' pkg:github/unregistered/backend ' },
  });
  fireEvent.change(screen.getByLabelText('Target identifier'), {
    target: { value: ' API component ' },
  });
  fireEvent.click(screen.getByText('Apply group'));
  expect(
    screen.getByText(
      'Request group: pkg:github/unregistered/backend / API component',
    ),
  ).toBeTruthy();
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Pin request'));
  await screen.findByText('Saved');
  expect((BrunoService.pin as jest.Mock).mock.calls[0][0]).toMatchObject({
    target: {
      purl: 'pkg:github/unregistered/backend',
      identifier: 'API component',
    },
    request: prepared.request,
  });
  fireEvent.click(screen.getByText('Other tab'));
  fireEvent.click(screen.getByText('Open prepared'));
  expect(
    screen.getByText(
      'Request group: pkg:github/unregistered/backend / API component',
    ),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByText(
      'Request group: pkg:github/unregistered/backend / API component',
    ),
  );
  fireEvent.change(screen.getByLabelText('Target identifier'), {
    target: { value: 'container:api' },
  });
  fireEvent.click(screen.getByText('Apply group'));
  expect(BrunoService.pin).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Save changes'));
  await screen.findByText('Saved');
  expect(
    (BrunoService.updateRoute as jest.Mock).mock.calls[0][0].target.identifier,
  ).toBe('container:api');
  fireEvent.click(screen.getByText('Send'));
  await screen.findByText('Response 200');
  expect(BrunoService.sendRequest).toHaveBeenCalledWith(
    prepared.request,
    prepared.environment,
  );
  fireEvent.click(screen.getByText('Clear group'));
  expect(screen.getByText('Request group: Ungrouped')).toBeTruthy();
  fireEvent.click(screen.getByText('Save changes'));
  await screen.findByText('Saved');
  expect(
    (BrunoService.updateRoute as jest.Mock).mock.calls[1][0],
  ).not.toHaveProperty('target');
  expect(BrunoService.sendRequest).toHaveBeenCalledTimes(1);
});

test('unpinned remembered definitions can be edited and saved without becoming favorites or sending', async () => {
  render(<Harness />, { wrapper });
  fireEvent.click(screen.getByText('Open prepared'));
  await screen.findByText('Saved');
  fireEvent.change(screen.getByLabelText('Request URL'), {
    target: { value: 'https://example.test?query=updated' },
  });
  fireEvent.click(screen.getByText('Save changes'));
  await screen.findByText('Saved');
  expect(stored).toEqual([
    {
      ...prepared,
      request: {
        http: {
          method: 'GET',
          url: 'https://example.test?query=updated',
        },
      },
      pinned: false,
    },
  ]);
  expect(screen.getByText('Pin request')).toBeTruthy();
  expect(screen.getByText('Saved count 0')).toBeTruthy();
  expect(BrunoService.pin).not.toHaveBeenCalled();
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test('partial group edits show an error without changing the applied group or sending', async () => {
  render(<Harness />, { wrapper });
  fireEvent.click(screen.getByText('Open prepared'));
  await screen.findByText('Saved');
  fireEvent.click(screen.getByText('Request group: Ungrouped'));
  fireEvent.change(screen.getByLabelText('Target PURL'), {
    target: { value: 'scope' },
  });
  fireEvent.click(screen.getByText('Apply group'));
  expect(screen.getByRole('alert').textContent).toContain('identifier');
  expect(screen.getByText('Request group: Ungrouped')).toBeTruthy();
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
  expect(BrunoService.pin).not.toHaveBeenCalled();
});

test('pin failures are surfaced without claiming the request was saved', async () => {
  (BrunoService.pin as jest.Mock).mockRejectedValue(
    new Error('secure storage unavailable'),
  );
  render(<Harness />, { wrapper });
  fireEvent.click(screen.getByText('Open prepared'));
  fireEvent.click(screen.getByText('Pin request'));
  await screen.findByRole('alert');
  expect(screen.getByText('Saved count 0')).toBeTruthy();
  expect(screen.getByText('Pin request')).toBeTruthy();
});

test('late responses cannot populate a closed and reopened request', async () => {
  let complete!: (response: unknown) => void;
  (BrunoService.sendRequest as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  render(<Harness />, { wrapper });
  fireEvent.click(screen.getByText('Open prepared'));
  fireEvent.click(screen.getByText('Send'));
  fireEvent.click(screen.getByText('Close tabs'));
  fireEvent.click(screen.getByText('Open prepared'));
  await act(async () => complete({ status: 201 }));
  expect(screen.getByText('Not sent')).toBeTruthy();
});
