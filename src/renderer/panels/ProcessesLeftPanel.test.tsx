import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import {
  ProcessesLeftPanel,
  PROCESS_INTENTS,
  type ProcessEntry,
} from './ProcessesLeftPanel';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {},
      fonts: {},
      fontSizes: [10, 12, 14],
      radii: [2, 4],
    },
  }),
}));

const managed: ProcessEntry = {
  id: 'server-1',
  label: 'Dev server',
  command: 'npm run dev',
  cwd: '/repo',
  kind: 'dev-server',
  origin: 'managed',
  status: 'running',
  startedAt: 1,
};

test('offers a pin action for managed processes and emits a dedicated intent', () => {
  const emit = jest.fn();
  render(
    <ProcessesLeftPanel
      entries={[managed]}
      events={{ emit } as unknown as PanelEventEmitter}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Pin Dev server' }));
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: PROCESS_INTENTS.togglePin,
      payload: { entry: managed },
    }),
  );
  expect(emit).toHaveBeenCalledTimes(1);
});

test('external processes are visible without pin or restart actions', () => {
  render(
    <ProcessesLeftPanel
      entries={[{ ...managed, origin: 'detected' }]}
      events={{ emit: jest.fn() } as unknown as PanelEventEmitter}
    />,
  );
  expect(screen.getByText('External')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Pin/ })).toBeNull();
  const row = screen.getByText('Dev server').closest('[role="button"]');
  if (!row) throw new Error('Missing process row');
  fireEvent.mouseEnter(row);
  expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
});

test('keeps the process list visible when a pin cannot be saved', () => {
  render(
    <ProcessesLeftPanel
      entries={[managed]}
      events={{ emit: jest.fn() } as unknown as PanelEventEmitter}
      error="Could not securely save the process pin."
    />,
  );
  expect(screen.getByRole('alert').textContent).toBe(
    'Could not securely save the process pin.',
  );
  expect(screen.getByRole('button', { name: 'Pin Dev server' })).toBeTruthy();
});
