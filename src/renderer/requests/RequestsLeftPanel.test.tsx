import React, { useState } from 'react';
import { randomUUID } from 'crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RequestsLeftPanel } from './RequestsLeftPanel';
import {
  PortalTabsProvider,
  useWorkspaceTabs,
} from '../principal-window/PortalTabsContext';
import { BrunoService } from '../main-process-api/BrunoService';
import {
  requestDefinition,
  type CatalogRequest,
  type SavedRequest,
} from '../../shared/requests/preparedRequest';

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
    forgetRoute: jest.fn(),
    pin: jest.fn(),
    unpin: jest.fn(),
    sendRequest: jest.fn(),
  },
}));
jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#101010',
        backgroundSecondary: '#202020',
        border: '#303030',
        text: '#f5f5f5',
        textSecondary: '#aaaaaa',
        textMuted: '#777777',
        primary: '#4488ff',
        error: '#ff4444',
      },
      fonts: { body: 'sans-serif', monospace: 'monospace' },
      fontSizes: [10, 12, 14],
      space: [0, 4, 8],
    },
  }),
}));

const grouped: SavedRequest = {
  id: 'saved-one',
  title: 'Backend health',
  request: {
    http: { method: 'GET', url: 'https://private.test?token=secret' },
  },
  environment: { TOKEN: 'private-value' },
  target: {
    purl: 'pkg:github/unregistered/backend',
    identifier: 'Some C4 component',
  },
};
const draft: SavedRequest = {
  ...grouped,
  id: 'draft',
  title: 'Draft request',
  target: undefined,
};
let stored: CatalogRequest[];

beforeEach(() => {
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
  jest.clearAllMocks();
  stored = [{ ...grouped, pinned: true }];
  (BrunoService.listRoutes as jest.Mock).mockImplementation(async () => stored);
  (BrunoService.pin as jest.Mock).mockImplementation(
    async (request: SavedRequest) => {
      stored = [
        ...stored.filter((entry) => entry.id !== request.id),
        { ...request, pinned: true },
      ];
      return stored.filter((entry) => entry.pinned).map(requestDefinition);
    },
  );
  (BrunoService.unpin as jest.Mock).mockImplementation(async (id: string) => {
    stored = stored.map((entry) =>
      entry.id === id ? { ...entry, pinned: false } : entry,
    );
    return stored.filter((entry) => entry.pinned).map(requestDefinition);
  });
  (BrunoService.forgetRoute as jest.Mock).mockImplementation(
    async (id: string) => {
      stored = stored.filter((entry) => entry.id !== id);
      return stored;
    },
  );
});

function Harness() {
  const workspace = useWorkspaceTabs();
  const [showPanel, setShowPanel] = useState(true);
  return (
    <>
      <button type="button" onClick={() => workspace.openHttpRequest(draft)}>
        Prepare draft
      </button>
      <button type="button" onClick={() => workspace.setTabs([])}>
        Close request tabs
      </button>
      <button type="button" onClick={() => setShowPanel((visible) => !visible)}>
        Switch sidebar
      </button>
      <span data-testid="active-tab">{workspace.activeTabId}</span>
      <span data-testid="tab-count">{workspace.tabs.length}</span>
      <span data-testid="session">
        {
          workspace.tabs.find((tab) => tab.contentType === 'http-request')
            ?.sessionId
        }
      </span>
      {showPanel ? <RequestsLeftPanel /> : <div>Another sidebar</div>}
    </>
  );
}
function renderPanel() {
  return render(
    <PortalTabsProvider>
      <Harness />
    </PortalTabsProvider>,
  );
}

test('shows encrypted pins in PURL/identifier groups and reopens without sending', async () => {
  renderPanel();
  await screen.findByRole('button', { name: 'Backend health Pinned' });
  expect(screen.getByText(grouped.target?.purl ?? '')).toBeTruthy();
  expect(screen.getByText(grouped.target?.identifier ?? '')).toBeTruthy();
  expect(screen.getByTestId('tab-count').textContent).toBe('0');
  expect(screen.getByText('GET https://private.test/')).toBeTruthy();
  expect(document.body.textContent).not.toContain('token=secret');
  expect(document.body.textContent).not.toContain('private-value');
  fireEvent.click(
    screen.getByRole('button', { name: 'Backend health Pinned' }),
  );
  expect(screen.getByTestId('active-tab').textContent).toBe(
    'http-request-saved-one',
  );
  expect(
    screen
      .getByRole('button', { name: 'Backend health Open' })
      .getAttribute('aria-current'),
  ).toBe('page');
  expect(
    screen.queryByRole('button', { name: 'Backend health Pinned' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Backend health Open' }));
  expect(screen.getByTestId('tab-count').textContent).toBe('1');
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test('route previews omit query values and URL credentials', async () => {
  stored = [
    {
      ...grouped,
      pinned: false,
      request: {
        http: {
          method: 'POST',
          url: 'https://user:private-password@private.test/health?token=private-token',
        },
      },
    },
  ];
  renderPanel();
  await screen.findByText('POST https://private.test/health');
  expect(document.body.textContent).not.toContain('private-password');
  expect(document.body.textContent).not.toContain('private-token');
  expect(document.body.textContent).not.toContain('private-value');
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test('shares tab sessions across sidebar switches and pins/unpins open and closed requests', async () => {
  renderPanel();
  await screen.findByRole('button', { name: 'Backend health Pinned' });
  fireEvent.click(screen.getByText('Prepare draft'));
  expect(screen.getByText('Ungrouped')).toBeTruthy();
  const session = screen.getByTestId('session').textContent;
  fireEvent.click(screen.getByText('Switch sidebar'));
  expect(screen.getByText('Another sidebar')).toBeTruthy();
  fireEvent.click(screen.getByText('Switch sidebar'));
  expect(screen.getByTestId('session').textContent).toBe(session);
  expect(
    screen.getByRole('button', { name: 'Draft request Open' }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Pin Draft request' }));
  await screen.findByRole('button', { name: 'Unpin Draft request' });
  expect(BrunoService.pin).toHaveBeenCalledWith(draft);
  fireEvent.click(screen.getByText('Close request tabs'));
  await screen.findByRole('button', { name: 'Draft request Pinned' });
  fireEvent.click(screen.getByRole('button', { name: 'Draft request Pinned' }));
  expect(screen.getByTestId('session').textContent).not.toBe(session);
  fireEvent.click(screen.getByRole('button', { name: 'Unpin Draft request' }));
  await screen.findByRole('button', { name: 'Pin Draft request' });
  expect(
    screen.getByRole('button', { name: 'Draft request Open' }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Unpin Backend health' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Backend health Pinned' }),
    ).toBeNull(),
  );
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test('shows an empty state when there are no remembered or open requests', () => {
  stored = [];
  renderPanel();
  expect(screen.getByText(/No remembered requests/)).toBeTruthy();
});

test('surfaces loading failures and can retry without sending', async () => {
  (BrunoService.listRoutes as jest.Mock).mockRejectedValueOnce(
    new Error('secure storage unavailable'),
  );
  renderPanel();
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Could not load remembered requests',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('button', { name: 'Backend health Pinned' });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test('unpinned routes survive closing and remounting, can be favorited while closed, then forgotten', async () => {
  stored = [{ ...grouped, pinned: false }];
  const view = renderPanel();
  await screen.findByRole('button', { name: 'Backend health Remembered' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Backend health Remembered' }),
  );
  fireEvent.click(screen.getByText('Close request tabs'));
  expect(
    screen.getByRole('button', { name: 'Backend health Remembered' }),
  ).toBeTruthy();
  view.unmount();
  renderPanel();
  await screen.findByRole('button', { name: 'Backend health Remembered' });
  expect(screen.getByTestId('tab-count').textContent).toBe('0');
  fireEvent.click(screen.getByRole('button', { name: 'Pin Backend health' }));
  await screen.findByRole('button', { name: 'Backend health Pinned' });
  expect(
    screen.queryByRole('button', { name: 'Forget Backend health' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Unpin Backend health' }));
  await screen.findByRole('button', { name: 'Backend health Remembered' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Forget Backend health' }),
  );
  await screen.findByText(/No remembered requests/);
  expect(BrunoService.forgetRoute).toHaveBeenCalledWith(grouped.id);
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test('does not remove a pin when unpinning fails', async () => {
  (BrunoService.unpin as jest.Mock).mockRejectedValueOnce(
    new Error('write failed'),
  );
  renderPanel();
  await screen.findByRole('button', { name: 'Backend health Pinned' });
  fireEvent.click(screen.getByRole('button', { name: 'Unpin Backend health' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Could not unpin request',
  );
  expect(
    screen.getByRole('button', { name: 'Backend health Pinned' }),
  ).toBeTruthy();
});

test('matches the fixed header, filter bar, scrolling body, and themed typography of other sidebars', async () => {
  renderPanel();
  await screen.findByRole('button', { name: 'Backend health Pinned' });
  const title = screen.getByText('Requests');
  const header = title.parentElement;
  const filter = screen.getByRole('textbox', {
    name: 'Filter requests',
  }).parentElement;
  const list = screen.getByRole('region', { name: 'Requests' }).parentElement;
  if (!header || !filter || !list)
    throw new Error('Missing sidebar structure.');
  expect(header.style.height).toBe('40px');
  expect(header.style.flexShrink).toBe('0');
  expect(filter.style.height).toBe('30px');
  expect(filter.style.flexShrink).toBe('0');
  expect(list.style.overflow).toBe('auto');
  expect(list.style.minHeight).toBe('0');
  expect(header.parentElement?.style.overflow).toBe('hidden');
  expect(header.parentElement?.style.flexDirection).toBe('column');
  expect(screen.queryByRole('heading', { name: 'Requests' })).toBeNull();
  expect(title.style.fontSize).toBe('12px');
  expect(screen.getByText('Backend health').style.fontSize).toBe('14px');
  expect(
    screen.getByText('GET https://private.test/').parentElement?.style
      .fontFamily,
  ).toBe('monospace');
});

test('uses hover, keyboard focus, and active-row styling without sending', async () => {
  renderPanel();
  const button = await screen.findByRole('button', {
    name: 'Backend health Pinned',
  });
  const row = button.parentElement;
  if (!row) throw new Error('Missing request row.');
  expect(row.style.backgroundColor).toBe('transparent');
  expect(row.style.borderBottomWidth).toBe('1px');
  expect(row.style.borderBottomStyle).toBe('solid');
  fireEvent.mouseEnter(row);
  expect(row.style.backgroundColor).toBe('rgb(32, 32, 32)');
  fireEvent.mouseLeave(row);
  expect(row.style.backgroundColor).toBe('transparent');
  fireEvent.focus(button);
  expect(row.style.backgroundColor).toBe('rgb(32, 32, 32)');
  fireEvent.blur(button, { relatedTarget: null });
  expect(row.style.backgroundColor).toBe('transparent');
  fireEvent.click(button);
  expect(screen.getByText('Backend health').style.fontWeight).toBe('700');
  fireEvent.mouseLeave(row);
  expect(row.style.backgroundColor).toBe('rgb(32, 32, 32)');
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test.each([
  'BACKEND HEALTH',
  'private.test',
  'gEt',
  'Some C4 component',
  'pkg:github/unregistered/backend',
])(
  'filters by visible title, endpoint, method, or target: %s',
  async (query) => {
    stored.push({
      ...draft,
      title: 'Create user',
      request: { http: { method: 'POST', url: 'https://users.test/users' } },
      pinned: false,
    });
    renderPanel();
    await screen.findByRole('button', { name: 'Create user Remembered' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter requests' }), {
      target: { value: query },
    });
    expect(
      screen.getByRole('button', { name: 'Backend health Pinned' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Create user Remembered' }),
    ).toBeNull();
    expect(screen.queryByText('Ungrouped')).toBeNull();
    expect(BrunoService.pin).not.toHaveBeenCalled();
    expect(BrunoService.unpin).not.toHaveBeenCalled();
    expect(BrunoService.forgetRoute).not.toHaveBeenCalled();
    expect(BrunoService.sendRequest).not.toHaveBeenCalled();
  },
);

test('does not search hidden query values or environment values and clearing restores groups', async () => {
  renderPanel();
  await screen.findByRole('button', { name: 'Backend health Pinned' });
  const filter = screen.getByRole('textbox', { name: 'Filter requests' });
  const reads = (BrunoService.listRoutes as jest.Mock).mock.calls.length;
  for (const value of ['secret', 'private-value']) {
    fireEvent.change(filter, { target: { value } });
    expect(screen.getByText('No requests match this filter.')).toBeTruthy();
    expect(screen.queryByText(grouped.target?.purl ?? '')).toBeNull();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
  expect((filter as HTMLInputElement).value).toBe('');
  expect(
    screen.getByRole('button', { name: 'Backend health Pinned' }),
  ).toBeTruthy();
  expect(BrunoService.listRoutes).toHaveBeenCalledTimes(reads);
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});

test('header refresh reloads the catalog without opening or sending a request', async () => {
  renderPanel();
  await screen.findByRole('button', { name: 'Backend health Pinned' });
  stored = [{ ...grouped, title: 'Refreshed health', pinned: true }];
  const reads = (BrunoService.listRoutes as jest.Mock).mock.calls.length;
  const refresh = screen.getByRole('button', { name: 'Refresh requests' });
  fireEvent.click(refresh);
  expect((refresh as HTMLButtonElement).disabled).toBe(true);
  await screen.findByRole('button', { name: 'Refreshed health Pinned' });
  await waitFor(() =>
    expect((refresh as HTMLButtonElement).disabled).toBe(false),
  );
  expect(BrunoService.listRoutes).toHaveBeenCalledTimes(reads + 1);
  expect(screen.getByTestId('tab-count').textContent).toBe('0');
  expect(BrunoService.sendRequest).not.toHaveBeenCalled();
});
