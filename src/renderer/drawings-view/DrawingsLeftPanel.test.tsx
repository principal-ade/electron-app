import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { DrawingsLeftPanel } from './DrawingsLeftPanel';
import { resolveDrawingsDir, scanDrawings } from './drawingsStorage';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14] },
  }),
}));

jest.mock('./drawingsStorage', () => ({
  ...jest.requireActual('./drawingsStorage'),
  resolveDrawingsDir: jest.fn(),
  scanDrawings: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (resolveDrawingsDir as jest.Mock).mockResolvedValue('/drawings');
});

test.each([
  ['/drawings/architecture.excalidraw', '/drawings/architecture.excalidraw'],
  [
    "/drawings/team's $(draft).excalidraw",
    "'/drawings/team'\\''s $(draft).excalidraw'",
  ],
])('drags drawing context from %s without opening it', async (path, quoted) => {
  const item = { id: 'architecture', name: 'Architecture', path };
  (scanDrawings as jest.Mock).mockResolvedValue([item]);
  const emit = jest.fn();
  render(
    <DrawingsLeftPanel
      events={
        { emit, on: jest.fn(), off: jest.fn() } as unknown as PanelEventEmitter
      }
    />,
  );
  const row = await screen.findByRole('button', { name: 'Architecture Drawing' });
  expect(row.draggable).toBe(true);
  const dataTransfer = { effectAllowed: 'none', setData: jest.fn() };
  fireEvent.dragStart(row, { dataTransfer });
  expect(dataTransfer.effectAllowed).toBe('copy');
  expect(dataTransfer.setData).toHaveBeenCalledWith(
    'text/plain',
    `Use drawing "Architecture" as context — read the local Excalidraw file:\ncat ${quoted}`,
  );
  expect(emit).not.toHaveBeenCalled();
  fireEvent.click(row);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'drawing:open',
      payload: { drawingId: item.id, path, name: item.name },
    }),
  );
  expect(
    screen.getByRole('button', { name: 'Copy path for Architecture' })
      .draggable,
  ).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Delete Architecture' }).draggable,
  ).toBe(false);
});
