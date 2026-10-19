/// <reference types="jest" />
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { TopicDeleteHeaderButton } from './TopicDeleteHeaderButton';
import { TopicService } from '../main-process-api/TopicService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        border: '#444',
        background: '#111',
        backgroundSecondary: '#222',
        surface: '#222',
        text: '#fff',
        textMuted: '#aaa',
        error: '#f00',
      },
      fonts: { body: 'sans-serif' },
    },
  }),
}));
jest.mock('../main-process-api/TopicService', () => ({
  TopicService: { deleteTopic: jest.fn() },
}));

const openDialog = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Delete topic' }));
  return screen.getByRole('dialog', { name: 'Delete topic' });
};

beforeEach(() => {
  jest.clearAllMocks();
  (TopicService.deleteTopic as jest.Mock).mockResolvedValue(true);
});

test('requires confirmation and cancellation leaves the topic alone', () => {
  render(<TopicDeleteHeaderButton topicId="topic-a" title="My topic" />);
  const dialog = openDialog();
  expect(within(dialog).getByText('“My topic”')).toBeTruthy();
  expect(TopicService.deleteTopic).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(TopicService.deleteTopic).not.toHaveBeenCalled();
});

test('disables confirmation and cancellation until deletion finishes', async () => {
  let resolveDelete!: (removed: boolean) => void;
  (TopicService.deleteTopic as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveDelete = resolve;
    }),
  );
  render(<TopicDeleteHeaderButton topicId="topic-a" title="My topic" />);
  const dialog = openDialog();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete topic' }));
  expect(TopicService.deleteTopic).toHaveBeenCalledWith('topic-a');
  expect(
    (
      within(dialog).getByRole('button', {
        name: 'Working…',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (
      within(dialog).getByRole('button', {
        name: 'Cancel',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeTruthy();
  await act(async () => resolveDelete(true));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(TopicService.deleteTopic).toHaveBeenCalledTimes(1);
});

test('shows deletion failures without closing the dialog and allows retry', async () => {
  (TopicService.deleteTopic as jest.Mock)
    .mockRejectedValueOnce(new Error('Disk unavailable'))
    .mockResolvedValueOnce(true);
  render(<TopicDeleteHeaderButton topicId="topic-a" />);
  const dialog = openDialog();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete topic' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toMatch(/try again/),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete topic' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(TopicService.deleteTopic).toHaveBeenCalledTimes(2);
});

test('a false deletion result is not treated as success', async () => {
  (TopicService.deleteTopic as jest.Mock).mockResolvedValue(false);
  render(<TopicDeleteHeaderButton topicId="topic-a" />);
  const dialog = openDialog();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete topic' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toMatch(/already be missing/),
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
});
