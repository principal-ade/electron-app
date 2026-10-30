import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { HomeTabEntry } from './homeTabEntries';
import { HomeTabRow, PinnedTabIcon } from './HomeTabItems';
import { TOPIC_ASSOCIATION_MIME } from './topicAssociationDrag';
import { getPrincipalBridgeUrl } from '../../../shared/config/appBranding';

jest.mock('@industry-theme/xterm-terminal-panel', () => ({
  ProgramStatusBadge: ({ record }: { record: { state: string } }) => (
    <span data-testid="program-status-badge" data-state={record.state} />
  ),
}));

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14] },
  }),
}));

const profile: HomeTabEntry = {
  id: 'profile-app',
  kind: 'repo-tab',
  variant: 'project-info',
  label: 'owner/app',
  purl: 'pkg:github/owner/app',
};

test.each([true, false])(
  'shows Clone profile with a distinct icon when open=%s',
  (open) => {
    const activate = jest.fn();
    const pin = jest.fn();
    const { container } = render(
      <HomeTabRow
        entry={profile}
        open={open}
        pinned={!open}
        onActivate={activate}
        onTogglePin={pin}
      />,
    );
    expect(screen.getByText('Clone profile')).toBeTruthy();
    expect(screen.queryByText('owner/app')).toBeNull();
    expect(container.querySelector('.lucide-id-card')).not.toBeNull();
    const row = screen.getByRole('button', { name: 'Open Clone profile' });
    expect(row.style.paddingTop).toBe('8px');
    expect(row.style.paddingBottom).toBe('8px');
    fireEvent.click(screen.getByRole('button', { name: 'Open Clone profile' }));
    expect(activate).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: /^(Pin|Unpin) Clone profile$/ }),
    ).toBeNull();
    expect(pin).not.toHaveBeenCalled();
  },
);

test('preserves explorer pin activation and unpinning', () => {
  const activate = jest.fn();
  const unpin = jest.fn();
  const { container } = render(
    <PinnedTabIcon
      entry={{ ...profile, variant: 'repo-explorer' }}
      active={false}
      onActivate={activate}
      onUnpin={unpin}
    />,
  );
  const button = screen.getByRole('button', {
    name: 'Reopen pinned tab Clone explorer',
  });
  expect(container.querySelector('.lucide-folder-search')).not.toBeNull();
  expect(container.querySelector('[title]')).toBeNull();
  fireEvent.click(button);
  fireEvent.contextMenu(button);
  expect(activate).toHaveBeenCalledTimes(1);
  expect(unpin).toHaveBeenCalledTimes(1);
  expect(profile.label).toBe('owner/app');
});

test.each(['repo-explorer', 'file-city-guide'] as const)(
  'uses the appropriate label and icon for %s tabs',
  (variant) => {
    const { container } = render(
      <HomeTabRow
        entry={{ ...profile, variant }}
        open
        pinned={false}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
      />,
    );
    expect(
      screen.getByText(
        variant === 'repo-explorer' ? 'Clone explorer' : 'owner/app',
      ),
    ).toBeTruthy();
    expect(container.querySelector('.lucide-id-card')).toBeNull();
    expect(
      container.querySelector(
        variant === 'repo-explorer'
          ? '.lucide-folder-search'
          : '.lucide-building-2',
      ),
    ).not.toBeNull();
  },
);

test('uses Clone explorer for existing persisted explorer pins', () => {
  render(
    <PinnedTabIcon
      entry={{ ...profile, variant: 'repo-explorer' }}
      active={false}
      onActivate={jest.fn()}
      onUnpin={jest.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Reopen pinned tab Clone explorer' }),
  ).toBeTruthy();
});

test('keeps Clone explorer individually pinnable', () => {
  const pin = jest.fn();
  const activate = jest.fn();
  render(
    <HomeTabRow
      entry={{ ...profile, variant: 'repo-explorer' }}
      open
      pinned={false}
      onActivate={activate}
      onTogglePin={pin}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Pin Clone explorer' }));
  expect(
    screen
      .getByRole('button', { name: 'Pin Clone explorer' })
      .hasAttribute('title'),
  ).toBe(false);
  expect(pin).toHaveBeenCalledTimes(1);
  expect(activate).not.toHaveBeenCalled();
});

test.each(['project-info', 'repo-explorer'] as const)(
  'shows the current tab number for an open %s entry and updates after reordering',
  (variant) => {
    const activate = jest.fn();
    const props = {
      entry: { ...profile, variant },
      open: true,
      pinned: false,
      onActivate: activate,
      onTogglePin: jest.fn(),
    };
    const { rerender } = render(<HomeTabRow {...props} tabNumber={3} />);
    fireEvent.click(screen.getByText('Tab 3'));
    expect(activate).toHaveBeenCalledTimes(1);
    rerender(<HomeTabRow {...props} tabNumber={1} />);
    expect(screen.getByText('Tab 1')).toBeTruthy();
    expect(screen.queryByText('Tab 3')).toBeNull();
    rerender(<HomeTabRow {...props} open={false} pinned tabNumber={1} />);
    expect(screen.queryByText('Tab 1')).toBeNull();
  },
);

test('does not invent a tab number for a profile with no open tab position', () => {
  render(
    <HomeTabRow
      entry={profile}
      open
      pinned={false}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.queryByText(/^Tab /)).toBeNull();
});

test('shows a standalone terminal cwd instead of its tab number', () => {
  render(
    <HomeTabRow
      entry={{
        id: 'terminal-1',
        kind: 'terminal',
        label: 'Tab 2',
        path: '/Users/pat/code/scratch',
      }}
      open
      tabNumber={2}
      pinned={false}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.getByText('~/code/scratch')).toBeTruthy();
  expect(screen.queryByText('Tab 2')).toBeNull();
  expect(
    screen.getByRole('button', {
      name: 'Open terminal in /Users/pat/code/scratch',
    }),
  ).toBeTruthy();
});

test('keeps the tab-number label for a repo-rooted terminal', () => {
  render(
    <HomeTabRow
      entry={{
        id: 'terminal-1',
        kind: 'terminal',
        label: 'Tab 2',
        path: '/work/app',
        repoPath: '/work/app',
      }}
      open
      pinned={false}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.getByText('Tab 2')).toBeTruthy();
  expect(screen.queryByText('/work/app')).toBeNull();
});

test('does not add a tab-number badge to other repository tab kinds', () => {
  render(
    <HomeTabRow
      entry={{ ...profile, variant: 'file-city-guide' }}
      open
      tabNumber={2}
      pinned={false}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.queryByText('Tab 2')).toBeNull();
});

test.each(['working', 'blocked', 'done', 'error'] as const)(
  'shows OSC %s on an open terminal row and preserves activation',
  (state) => {
    const activate = jest.fn();
    render(
      <HomeTabRow
        entry={{
          id: 'tab-one',
          kind: 'terminal',
          label: 'Tab 1',
          path: '/work/app',
        }}
        open
        pinned={false}
        programStatus={{
          state,
          kind: state === 'blocked' ? 'permission' : undefined,
        }}
        onActivate={activate}
        onTogglePin={jest.fn()}
      />,
    );
    expect(screen.getByRole('status').getAttribute('aria-label')).toContain(
      state,
    );
    expect(
      screen.getByTestId('program-status-badge').getAttribute('data-state'),
    ).toBe(state);
    fireEvent.click(screen.getByRole('status'));
    expect(activate).toHaveBeenCalledTimes(1);
  },
);

test.each(['idle', 'clear', undefined] as const)(
  'does not show an indicator for status %s',
  (state) => {
    render(
      <HomeTabRow
        entry={{ id: 'tab-one', kind: 'terminal', label: 'Tab 1' }}
        open
        pinned={false}
        programStatus={state ? { state } : undefined}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
      />,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByTestId('program-status-badge')).toBeNull();
  },
);

test('updates live terminal status and removes it when cleared or closed', () => {
  const props = {
    entry: { id: 'tab-one', kind: 'terminal' as const, label: 'Tab 1' },
    open: true,
    pinned: false,
    onActivate: jest.fn(),
    onTogglePin: jest.fn(),
  };
  const { rerender } = render(
    <HomeTabRow {...props} programStatus={{ state: 'working' }} />,
  );
  rerender(
    <HomeTabRow
      {...props}
      programStatus={{ state: 'blocked', kind: 'auth' }}
    />,
  );
  expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
    'Terminal blocked: auth',
  );
  rerender(<HomeTabRow {...props} programStatus={{ state: 'clear' }} />);
  expect(screen.queryByRole('status')).toBeNull();
  rerender(
    <HomeTabRow {...props} open={false} programStatus={{ state: 'working' }} />,
  );
  expect(screen.queryByRole('status')).toBeNull();
});

test('does not show terminal status on a nonterminal row', () => {
  render(
    <HomeTabRow
      entry={profile}
      open
      pinned={false}
      programStatus={{ state: 'working' }}
      onActivate={jest.fn()}
      onTogglePin={jest.fn()}
    />,
  );
  expect(screen.queryByRole('status')).toBeNull();
});

describe('dragging agent context', () => {
  const topic: HomeTabEntry = {
    id: 'local-topic-t1',
    kind: 'topic',
    label: 'Topic title',
    topicId: 't1',
  };
  const model: HomeTabEntry = {
    id: 'subsystem-model-sg-1-abc',
    kind: 'subsystem-model',
    label: 'Model title',
    modelId: 'sg-1-abc',
  };
  const drawing: HomeTabEntry = {
    id: 'drawing-architecture',
    kind: 'drawing',
    drawingId: 'architecture',
    label: 'Drawing tab',
    name: 'Architecture',
    path: '/drawings/architecture.excalidraw',
  };

  afterEach(() => jest.restoreAllMocks());

  test.each([true, false])(
    'drags a saved drawing when open=%s and preserves activation and pinning',
    (open) => {
      const activate = jest.fn();
      const pin = jest.fn();
      render(
        <HomeTabRow
          entry={drawing}
          open={open}
          pinned={!open}
          onActivate={activate}
          onTogglePin={pin}
        />,
      );
      const row = screen.getByRole('button', { name: 'Open Drawing tab' });
      expect(row.draggable).toBe(true);
      const dataTransfer = { effectAllowed: 'none', setData: jest.fn() };
      fireEvent.dragStart(row, { dataTransfer });
      expect(dataTransfer.effectAllowed).toBe('copy');
      expect(dataTransfer.setData).toHaveBeenCalledWith(
        'text/plain',
        'Use drawing "Architecture" as context — read the local Excalidraw file:\ncat /drawings/architecture.excalidraw',
      );
      expect(activate).not.toHaveBeenCalled();
      expect(pin).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', {
          name: `${open ? 'Pin' : 'Unpin'} Drawing tab`,
        }),
      );
      expect(pin).toHaveBeenCalledTimes(1);
      expect(activate).not.toHaveBeenCalled();
      fireEvent.click(row);
      expect(activate).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    [topic, 'topic', 'topics', 't1'],
    [model, 'subsystem model', 'subsystem-models', 'sg-1-abc'],
  ] as const)(
    'copies a fetchable prompt for %s without opening or pinning',
    (entry, kind, route, id) => {
      const activate = jest.fn();
      const pin = jest.fn();
      const props = {
        entry,
        pinned: false,
        onActivate: activate,
        onTogglePin: pin,
      };
      const { rerender } = render(<HomeTabRow {...props} open />);
      for (const open of [true, false]) {
        rerender(<HomeTabRow {...props} open={open} pinned={!open} />);
        const row = screen.getByRole('button', { name: `Open ${entry.label}` });
        expect(row.draggable).toBe(true);
        const dataTransfer = { effectAllowed: 'none', setData: jest.fn() };
        fireEvent.dragStart(row, { dataTransfer });
        expect(dataTransfer.effectAllowed).toBe('copy');
        expect(dataTransfer.setData).toHaveBeenCalledWith(
          'text/plain',
          `Use ${kind} "${entry.label}" (id: ${id}) as context — fetch via:\ncurl -s ${getPrincipalBridgeUrl()}/api/${route}/${id}`,
        );
      }
      expect(activate).not.toHaveBeenCalled();
      expect(pin).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: `Unpin ${entry.label}` }),
      );
      expect(pin).toHaveBeenCalledTimes(1);
      expect(activate).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: `Open ${entry.label}` }),
      );
      expect(activate).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    ['development', 3054],
    ['production', 3044],
  ])('uses the %s bridge port', (environment, port) => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: String(environment),
    });
    render(
      <HomeTabRow
        entry={model}
        open
        pinned={false}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
      />,
    );
    const dataTransfer = { setData: jest.fn() };
    fireEvent.dragStart(
      screen.getByRole('button', { name: `Open ${model.label}` }),
      { dataTransfer },
    );
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      expect.stringContaining(
        `curl -s http://localhost:${port}/api/subsystem-models/${model.modelId}`,
      ),
    );
  });

  test.each([
    profile,
    { ...topic, topicId: undefined },
    { ...model, modelId: undefined },
    { ...drawing, path: undefined },
    { id: 'terminal', kind: 'terminal', label: 'Terminal' } as HomeTabEntry,
  ])('does not drag unsupported or incomplete entries: %s', (entry) => {
    render(
      <HomeTabRow
        entry={entry}
        open
        pinned={false}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
      />,
    );
    const row = screen.getByRole('button', {
      name: `Open ${entry === profile ? 'Clone profile' : entry.label}`,
    });
    expect(row.draggable).toBe(false);
    const dataTransfer = { setData: jest.fn() };
    fireEvent.dragStart(row, { dataTransfer });
    expect(dataTransfer.setData).not.toHaveBeenCalled();
  });

  test('encodes and shell-quotes IDs in fetch commands', () => {
    render(
      <HomeTabRow
        entry={{ ...topic, topicId: "a/b'$(cmd)?" }}
        open
        pinned={false}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
      />,
    );
    const dataTransfer = { setData: jest.fn() };
    fireEvent.dragStart(
      screen.getByRole('button', { name: 'Open Topic title' }),
      { dataTransfer },
    );
    const payload = dataTransfer.setData.mock.calls[0][1];
    expect(payload.split('\n')[1]).toBe(
      `curl -s '${getPrincipalBridgeUrl()}/api/topics/a%2Fb'\\''%24(cmd)%3F'`,
    );
  });
});

describe('dropping onto topic rows', () => {
  const target: HomeTabEntry = {
    id: 'local-topic-owner',
    kind: 'topic',
    label: 'Owner topic',
    topicId: 'owner',
  };
  const drawingEntry: HomeTabEntry = {
    id: 'drawing-d1',
    kind: 'drawing',
    drawingId: 'd1',
    label: 'Sketchpad',
    name: 'Sketchpad',
    path: '/drawings/d1.excalidraw',
  };

  function transfer(payload?: unknown) {
    const data = new Map<string, string>();
    if (payload !== undefined) {
      data.set(TOPIC_ASSOCIATION_MIME, JSON.stringify(payload));
    }
    return {
      effectAllowed: 'none',
      dropEffect: 'none',
      get types() {
        return [...data.keys()];
      },
      getData: (type: string) => data.get(type) ?? '',
      setData: (type: string, value: string) => data.set(type, value),
    };
  }

  function renderTarget(onDropAssociation = jest.fn()) {
    render(
      <HomeTabRow
        entry={target}
        open
        pinned={false}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
        onDropAssociation={onDropAssociation}
      />,
    );
    return screen.getByRole('button', { name: 'Open Owner topic' });
  }

  afterEach(() => jest.useRealTimers());

  test('adds the association payload when dragging an associable row', () => {
    render(
      <HomeTabRow
        entry={drawingEntry}
        open
        pinned={false}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
      />,
    );
    const dataTransfer = transfer();
    const row = screen.getByRole('button', { name: 'Open Sketchpad' });
    fireEvent.dragStart(row, { dataTransfer });
    expect(JSON.parse(dataTransfer.getData(TOPIC_ASSOCIATION_MIME))).toEqual({
      kind: 'drawing',
      drawingId: 'd1',
    });
    expect(dataTransfer.getData('text/plain')).toContain('Use drawing');
    fireEvent.dragEnd(row);
  });

  test('accepts a drop, links the item, and shows brief feedback', async () => {
    jest.useFakeTimers();
    const onDrop = jest.fn().mockResolvedValue('added');
    const row = renderTarget(onDrop);
    const dataTransfer = transfer({ kind: 'drawing', drawingId: 'd1' });
    expect(fireEvent.dragOver(row, { dataTransfer })).toBe(false);
    expect(row.style.outline).toContain('dashed');
    fireEvent.drop(row, { dataTransfer });
    expect(onDrop).toHaveBeenCalledWith({ kind: 'drawing', drawingId: 'd1' });
    expect(row.style.outline).toBe('none');
    expect((await screen.findByRole('status')).textContent).toBe('Linked');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  test.each([
    ['exists', 'Already linked'],
    ['error', 'Could not link'],
  ])('reports %s as %s', async (outcome, message) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const onDrop = jest.fn(() =>
      outcome === 'error'
        ? Promise.reject(new Error('write failed'))
        : Promise.resolve(outcome),
    );
    const row = renderTarget(onDrop);
    fireEvent.drop(row, {
      dataTransfer: transfer({ kind: 'subsystem-model', modelId: 'sg-1' }),
    });
    expect((await screen.findByRole('status')).textContent).toBe(message);
  });

  test('ignores drags without an association payload', () => {
    const onDrop = jest.fn();
    const row = renderTarget(onDrop);
    const dataTransfer = transfer();
    dataTransfer.setData('text/plain', 'hello');
    expect(fireEvent.dragOver(row, { dataTransfer })).toBe(true);
    fireEvent.drop(row, { dataTransfer });
    expect(onDrop).not.toHaveBeenCalled();
  });

  test('refuses dropping a topic row onto itself', () => {
    const onDrop = jest.fn();
    const row = renderTarget(onDrop);
    const dataTransfer = transfer();
    fireEvent.dragStart(row, { dataTransfer });
    expect(fireEvent.dragOver(row, { dataTransfer })).toBe(true);
    fireEvent.drop(row, { dataTransfer });
    fireEvent.dragEnd(row);
    expect(onDrop).not.toHaveBeenCalled();
  });

  test('non-topic rows are not drop targets', () => {
    render(
      <HomeTabRow
        entry={drawingEntry}
        open
        pinned={false}
        onActivate={jest.fn()}
        onTogglePin={jest.fn()}
        onDropAssociation={jest.fn()}
      />,
    );
    const row = screen.getByRole('button', { name: 'Open Sketchpad' });
    expect(
      fireEvent.dragOver(row, {
        dataTransfer: transfer({ kind: 'topic', topicId: 't2' }),
      }),
    ).toBe(true);
  });
});
