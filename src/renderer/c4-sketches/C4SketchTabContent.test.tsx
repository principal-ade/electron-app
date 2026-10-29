/// <reference types="jest" />
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { C4SketchTabContent } from './C4SketchTabContent';
import { C4SketchService } from '../main-process-api/C4SketchService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: { background: '#111111', textSecondary: '#aaaaaa' } },
  }),
}));
jest.mock('@principal-ai/subsystems-react', () => ({
  C4SketchView: ({ sketch }: { sketch: { title: string } }) => (
    <div>{sketch.title}</div>
  ),
}));
jest.mock('../main-process-api/C4SketchService', () => ({
  C4SketchService: { get: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test('loads the standalone sketch viewer and refreshes on focus', async () => {
  (C4SketchService.get as jest.Mock).mockResolvedValue({
    title: 'Auth architecture',
  });
  render(<C4SketchTabContent sketchId="c4s-123-abc" />);
  expect(screen.getByRole('status').textContent).toContain('Loading C4 sketch');
  await screen.findByText('Auth architecture');
  expect(C4SketchService.get).toHaveBeenCalledWith('c4s-123-abc');
  (C4SketchService.get as jest.Mock).mockResolvedValue({
    title: 'Updated architecture',
  });
  fireEvent(window, new Event('focus'));
  await screen.findByText('Updated architecture');
});

test.each([null, new Error('Read failed')])(
  'shows missing or failed sketch loads without crashing (%#)',
  async (value) => {
    if (value instanceof Error)
      (C4SketchService.get as jest.Mock).mockRejectedValue(value);
    else (C4SketchService.get as jest.Mock).mockResolvedValue(value);
    render(<C4SketchTabContent sketchId="c4s-123-abc" />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      value
        ? 'Could not load this C4 sketch.'
        : 'This C4 sketch could not be found or is invalid.',
    );
  },
);

test('does not show a stale sketch when switching identity during a load', async () => {
  let resolveFirst!: (value: unknown) => void;
  (C4SketchService.get as jest.Mock).mockImplementation((id: string) =>
    id === 'c4s-old-abc'
      ? new Promise((resolve) => {
          resolveFirst = resolve;
        })
      : Promise.resolve({ title: 'New sketch' }),
  );
  const { rerender } = render(<C4SketchTabContent sketchId="c4s-old-abc" />);
  rerender(<C4SketchTabContent sketchId="c4s-new-abc" />);
  await screen.findByText('New sketch');
  await act(async () => {
    resolveFirst({ title: 'Old sketch' });
  });
  expect(screen.queryByText('Old sketch')).toBeNull();
});
