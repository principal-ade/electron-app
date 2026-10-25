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
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TopicDescriptionBody } from './TopicDescriptionBody';
import { TopicService } from '../../main-process-api/TopicService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#111111',
        backgroundSecondary: '#222222',
        border: '#444444',
        text: '#ffffff',
        textSecondary: '#aaaaaa',
        primary: '#00aaff',
      },
      fonts: { body: 'sans-serif' },
      fontSizes: [12, 14, 16],
      fontWeights: { body: 400, medium: 500, semibold: 600 },
      lineHeights: { body: 1.5 },
    },
  }),
}));
jest.mock('@principal-ade/panel-framework-core', () => ({
  DATA_TYPES: { TEXT_SELECTION: 'text-selection' },
  useDropZone: () => ({ isDragOver: false, onDrop: jest.fn() }),
}));
jest.mock('themed-markdown', () => ({
  IndustryMarkdownSlide: ({ content }: { content: string }) => (
    <div className="markdown-slide">
      <h1 id="overview">Overview</h1>
      <p>{content}</p>
      <h2 id="details">Details</h2>
    </div>
  ),
}));
jest.mock('../../main-process-api/TopicService', () => ({
  TopicService: { getTopic: jest.fn(), onTopicChange: jest.fn() },
}));
jest.mock('../../hooks/useMarkdownLinkHandler', () => ({
  useMarkdownLinkHandler: () => ({}),
}));
jest.mock('../../hooks/useRepoPurlResolver', () => ({
  useRepoPurlResolver: () => ({}),
}));
jest.mock('../../components/MarkdownLinkNotice', () => ({
  MarkdownLinkNotice: () => null,
}));

const events = { emit: jest.fn() } as unknown as PanelEventEmitter;
const originalCSS = window.CSS;

beforeEach(() => {
  Object.defineProperty(window, 'CSS', {
    configurable: true,
    value: { escape: (value: string) => value },
  });
  jest.clearAllMocks();
  (TopicService.getTopic as jest.Mock).mockResolvedValue({
    description: '# Overview\n\nNotes\n\n## Details',
  });
  (TopicService.onTopicChange as jest.Mock).mockReturnValue(jest.fn());
});

afterEach(() => {
  jest.useRealTimers();
  Object.defineProperty(window, 'CSS', {
    configurable: true,
    value: originalCSS,
  });
});

test('anchors the outline outside the independently scrolling notes', async () => {
  const props = { topicId: 'topic-a', events };
  const { rerender } = render(<TopicDescriptionBody {...props} />);
  const heading = await screen.findByRole('heading', { name: 'Overview' });
  const notes =
    heading.closest('.markdown-slide')?.parentElement?.parentElement;
  if (!notes) throw new Error('Notes scroll container is missing');
  expect(notes.style.overflow).toBe('auto');

  // Open after scrolling, then reopen without changing the document position.
  notes.scrollTop = 300;
  fireEvent.scroll(notes);
  rerender(<TopicDescriptionBody {...props} tocOpen />);
  const outline = await screen.findByRole('navigation', {
    name: 'Table of contents',
  });
  expect(outline.parentElement).toBe(notes.parentElement);
  expect(notes.contains(outline)).toBe(false);
  expect(outline.parentElement?.style.position).toBe('relative');
  expect(outline.parentElement?.style.overflow).toBe('hidden');
  expect(outline.style.position).toBe('absolute');
  expect(outline.style.top).toBe('0px');
  expect(notes.scrollTop).toBe(300);

  rerender(<TopicDescriptionBody {...props} tocOpen={false} />);
  rerender(<TopicDescriptionBody {...props} tocOpen />);
  expect(notes.scrollTop).toBe(300);
  expect(within(outline).getByRole('button', { name: 'Details' })).toBeTruthy();
});

test('keeps the outline open until scrolling finishes', async () => {
  const onCloseToc = jest.fn();
  const originalCSS = window.CSS;
  Object.defineProperty(window, 'CSS', {
    configurable: true,
    value: { escape: (value: string) => value },
  });
  try {
    render(
      <TopicDescriptionBody
        topicId="topic-a"
        events={events}
        tocOpen
        onCloseToc={onCloseToc}
      />,
    );
    const outline = await screen.findByRole('navigation', {
      name: 'Table of contents',
    });
    const heading = screen.getByRole('heading', { name: 'Details' });
    const scrollIntoView = jest.fn();
    heading.scrollIntoView = scrollIntoView;
    fireEvent.click(within(outline).getByRole('button', { name: 'Details' }));
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(onCloseToc).not.toHaveBeenCalled();
    const notes =
      heading.closest('.markdown-slide')?.parentElement?.parentElement;
    if (!notes) throw new Error('Notes scroll container is missing');
    fireEvent.scroll(notes);
    expect(onCloseToc).not.toHaveBeenCalled();
    fireEvent(notes, new Event('scrollend'));
    await waitFor(() => expect(onCloseToc).toHaveBeenCalledTimes(1));
    expect(within(outline).queryByText('Contents')).toBeNull();
    expect(within(outline).getAllByRole('button')).toHaveLength(2);
    expect(
      within(outline).getByRole('button', { name: 'Details' }).style.fontSize,
    ).toBe('16px');
  } finally {
    Object.defineProperty(window, 'CSS', {
      configurable: true,
      value: originalCSS,
    });
  }
});

const renderNavigation = async () => {
  const onCloseToc = jest.fn();
  const props = { topicId: 'topic-a', events, tocOpen: true, onCloseToc };
  const result = render(<TopicDescriptionBody {...props} />);
  const outline = await screen.findByRole('navigation', {
    name: 'Table of contents',
  });
  const heading = screen.getByRole('heading', { name: 'Details' });
  const notes =
    heading.closest('.markdown-slide')?.parentElement?.parentElement;
  if (!notes) throw new Error('Notes scroll container is missing');
  heading.scrollIntoView = jest.fn();
  screen.getByRole('heading', { name: 'Overview' }).scrollIntoView = jest.fn();
  jest.useFakeTimers();
  return { ...result, props, onCloseToc, outline, notes };
};

test('waits for scrolling to settle when scrollend is unavailable', async () => {
  const { outline, notes, onCloseToc } = await renderNavigation();
  fireEvent.click(within(outline).getByRole('button', { name: 'Details' }));
  fireEvent.scroll(notes);
  act(() => jest.advanceTimersByTime(120));
  fireEvent.scroll(notes);
  act(() => jest.advanceTimersByTime(179));
  expect(onCloseToc).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(60));
  expect(onCloseToc).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(1000));
  expect(onCloseToc).toHaveBeenCalledTimes(1);
});

test('also dismisses when the selected heading needs no scrolling', async () => {
  const { outline, onCloseToc } = await renderNavigation();
  fireEvent.click(within(outline).getByRole('button', { name: 'Overview' }));
  act(() => jest.advanceTimersByTime(249));
  expect(onCloseToc).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(60));
  expect(onCloseToc).toHaveBeenCalledTimes(1);
});

test('a new heading selection cancels an earlier scheduled dismissal', async () => {
  const { outline, notes, onCloseToc } = await renderNavigation();
  fireEvent.click(within(outline).getByRole('button', { name: 'Details' }));
  fireEvent(notes, new Event('scrollend'));
  fireEvent.click(within(outline).getByRole('button', { name: 'Overview' }));
  act(() => jest.advanceTimersByTime(50));
  expect(onCloseToc).not.toHaveBeenCalled();
  // Completion events from nested Markdown scroll regions also count.
  const markdown = notes.querySelector('.markdown-slide');
  if (!markdown) throw new Error('Markdown is missing');
  fireEvent.scroll(markdown);
  fireEvent(markdown, new Event('scrollend'));
  act(() => jest.advanceTimersByTime(50));
  expect(onCloseToc).toHaveBeenCalledTimes(1);
});

test.each(['close', 'hide', 'switch topic', 'unmount'])(
  'cancels pending dismissal on %s',
  async (action) => {
    const { outline, notes, onCloseToc, props, rerender, unmount } =
      await renderNavigation();
    fireEvent.click(within(outline).getByRole('button', { name: 'Details' }));
    fireEvent(notes, new Event('scrollend'));
    if (action === 'close') {
      rerender(<TopicDescriptionBody {...props} tocOpen={false} />);
      rerender(<TopicDescriptionBody {...props} />);
    } else if (action === 'hide') {
      rerender(<TopicDescriptionBody {...props} visible={false} />);
    } else if (action === 'switch topic') {
      rerender(<TopicDescriptionBody {...props} topicId="topic-b" />);
    } else {
      unmount();
    }
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onCloseToc).not.toHaveBeenCalled();
  },
);

test('moves one current-section dot with scrolling, including while closed', async () => {
  const props = { topicId: 'topic-a', events };
  const { rerender } = render(<TopicDescriptionBody {...props} tocOpen />);
  const outline = await screen.findByRole('navigation', {
    name: 'Table of contents',
  });
  const overview = screen.getByRole('heading', { name: 'Overview' });
  const details = screen.getByRole('heading', { name: 'Details' });
  const markdown = overview.closest('.markdown-slide');
  const notes = markdown?.parentElement?.parentElement;
  if (!notes || !markdown) throw new Error('Notes scroll container is missing');
  Object.defineProperties(notes, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 2000 },
  });
  jest
    .spyOn(notes, 'getBoundingClientRect')
    .mockImplementation(() => ({ top: 100 }) as DOMRect);
  jest
    .spyOn(overview, 'getBoundingClientRect')
    .mockImplementation(() => ({ top: 120 - notes.scrollTop }) as DOMRect);
  jest
    .spyOn(details, 'getBoundingClientRect')
    .mockImplementation(() => ({ top: 700 - notes.scrollTop }) as DOMRect);
  fireEvent.scroll(notes);
  const overviewEntry = within(outline).getByRole('button', {
    name: 'Overview',
  });
  const detailsEntry = within(outline).getByRole('button', { name: 'Details' });
  await waitFor(() =>
    expect(overviewEntry.getAttribute('aria-current')).toBe('location'),
  );
  expect(overviewEntry.querySelector('span')?.style.background).toBe(
    'rgb(0, 170, 255)',
  );
  expect(detailsEntry.querySelector('span')?.style.background).toBe(
    'transparent',
  );

  rerender(<TopicDescriptionBody {...props} tocOpen={false} />);
  notes.scrollTop = 600;
  // Scroll events from the markdown's inner container are tracked as well.
  fireEvent.scroll(markdown);
  await waitFor(() =>
    expect(detailsEntry.getAttribute('aria-current')).toBe('location'),
  );
  expect(outline.querySelectorAll('[aria-current="location"]')).toHaveLength(1);
  rerender(<TopicDescriptionBody {...props} tocOpen />);
  expect(detailsEntry.querySelector('span')?.style.background).toBe(
    'rgb(0, 170, 255)',
  );
  expect(overviewEntry.querySelector('span')?.style.background).toBe(
    'transparent',
  );

  notes.scrollTop = 0;
  fireEvent.scroll(notes);
  await waitFor(() =>
    expect(overviewEntry.getAttribute('aria-current')).toBe('location'),
  );
});

test('marks a short final section at the bottom and updates after resizing', async () => {
  render(<TopicDescriptionBody topicId="topic-a" events={events} tocOpen />);
  const outline = await screen.findByRole('navigation', {
    name: 'Table of contents',
  });
  const overview = screen.getByRole('heading', { name: 'Overview' });
  const details = screen.getByRole('heading', { name: 'Details' });
  const notes =
    overview.closest('.markdown-slide')?.parentElement?.parentElement;
  if (!notes) throw new Error('Notes scroll container is missing');
  Object.defineProperties(notes, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1000 },
  });
  jest
    .spyOn(notes, 'getBoundingClientRect')
    .mockReturnValue({ top: 0 } as DOMRect);
  jest
    .spyOn(overview, 'getBoundingClientRect')
    .mockReturnValue({ top: -200 } as DOMRect);
  const detailsBounds = jest
    .spyOn(details, 'getBoundingClientRect')
    .mockReturnValue({ top: 400 } as DOMRect);
  notes.scrollTop = 500;
  fireEvent.scroll(notes);
  const entry = within(outline).getByRole('button', { name: 'Details' });
  await waitFor(() =>
    expect(entry.getAttribute('aria-current')).toBe('location'),
  );
  notes.scrollTop = 200;
  fireEvent.scroll(notes);
  await waitFor(() => expect(entry.hasAttribute('aria-current')).toBe(false));
  detailsBounds.mockReturnValue({ top: 10 } as DOMRect);
  fireEvent(window, new Event('resize'));
  await waitFor(() =>
    expect(entry.getAttribute('aria-current')).toBe('location'),
  );
});
