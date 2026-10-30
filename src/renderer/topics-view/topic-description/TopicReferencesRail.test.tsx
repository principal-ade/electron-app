/// <reference types="jest" />
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { TopicReferencesRail } from './TopicReferencesRail';
import { TopicService } from '../../main-process-api/TopicService';
import { C4SketchService } from '../../main-process-api/C4SketchService';
import { getDrawingSummary } from '../../drawings-view/drawingsStorage';
import {
  TopicEventType,
  type TopicChangeEvent,
} from '../../../shared/main-process-api-interfaces/TopicAPI';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        border: '#444444',
        background: '#111111',
        backgroundSecondary: '#222222',
        backgroundTertiary: '#333333',
        primary: '#00aaff',
        text: '#ffffff',
        textSecondary: '#aaaaaa',
      },
      fonts: { body: 'sans-serif' },
      fontSizes: [12, 14, 16],
      radii: [0, 4],
    },
  }),
}));
jest.mock('../../main-process-api/TopicService', () => ({
  TopicService: {
    getTopic: jest.fn(),
    onTopicChange: jest.fn(),
    updateTopic: jest.fn(),
  },
}));
jest.mock('../../main-process-api/C4SketchService', () => ({
  C4SketchService: { getSummary: jest.fn() },
}));
jest.mock('../../drawings-view/drawingsStorage', () => ({
  getDrawingSummary: jest.fn(),
}));

const references = [
  { kind: 'c4-sketch', sketchId: 'c4s-123-abc' },
  { kind: 'topic', topicId: 'topic-related' },
];
let changed: (event: TopicChangeEvent) => void;
const unsubscribe = jest.fn();
const props = {
  topicId: 'topic-owner',
  onOpenTopic: jest.fn(),
  onOpenSketch: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (TopicService.getTopic as jest.Mock).mockImplementation(async (id: string) =>
    id === 'topic-owner' ? { id, references } : { id, title: 'Related brief' },
  );
  (C4SketchService.getSummary as jest.Mock).mockResolvedValue({
    id: 'c4s-123-abc',
    title: 'Architecture',
  });
  (TopicService.onTopicChange as jest.Mock).mockImplementation((listener) => {
    changed = listener;
    return unsubscribe;
  });
});

test('shows both sections with wrapping titles and opens the correct tabs', async () => {
  render(<TopicReferencesRail {...props} />);
  const sketch = await screen.findByRole('button', {
    name: 'Open Architecture in a new tab',
  });
  const topic = screen.getByRole('button', {
    name: 'Open Related brief in a new tab',
  });
  expect(screen.getByRole('region', { name: 'C4 sketches' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Related topics' })).toBeTruthy();
  expect(screen.getByText('Related brief').style.overflowWrap).toBe('anywhere');
  fireEvent.click(sketch);
  fireEvent.click(topic);
  expect(props.onOpenSketch).toHaveBeenCalledWith(
    'c4s-123-abc',
    'Architecture',
  );
  expect(props.onOpenTopic).toHaveBeenCalledWith(
    'topic-related',
    'Related brief',
  );
  expect(TopicService.updateTopic).not.toHaveBeenCalled();
  const card = sketch.parentElement;
  if (!card) throw new Error('Sketch card wrapper is missing');
  fireEvent.mouseEnter(card);
  expect(card.style.backgroundColor).toBe('rgb(51, 51, 51)');
  expect(card.style.borderColor).toBe('#00aaff');
  fireEvent.mouseLeave(card);
  expect(card.style.backgroundColor).toBe('rgb(34, 34, 34)');
});

test.each([undefined, []])(
  'hides empty sections without fetching a sketch catalogue: %p',
  async (refs) => {
    (TopicService.getTopic as jest.Mock).mockResolvedValue({
      id: 'topic-owner',
      references: refs,
    });
    const { container } = render(<TopicReferencesRail {...props} />);
    await waitFor(() => expect(container.firstChild).toBeNull());
    expect(C4SketchService.getSummary).not.toHaveBeenCalled();
  },
);

test.each([
  {
    references: [references[0]],
    shown: 'C4 sketches',
    hidden: 'Related topics',
  },
  {
    references: [references[1]],
    shown: 'Related topics',
    hidden: 'C4 sketches',
  },
])(
  'shows only the populated $shown section',
  async ({ references: refs, shown, hidden }) => {
    (TopicService.getTopic as jest.Mock).mockImplementation(
      async (id: string) =>
        id === 'topic-owner'
          ? { references: refs }
          : { title: 'Related brief' },
    );
    render(<TopicReferencesRail {...props} />);
    await waitFor(() =>
      expect(screen.queryAllByText('Loading…')).toHaveLength(0),
    );
    expect(screen.getByRole('region', { name: shown })).toBeTruthy();
    expect(screen.queryByRole('region', { name: hidden })).toBeNull();
  },
);

test('hides sections when the last associations are removed and restores them when added', async () => {
  const { container } = render(<TopicReferencesRail {...props} />);
  await screen.findByText('Architecture');
  (TopicService.getTopic as jest.Mock).mockResolvedValue({ references: [] });
  act(() => changed({ type: TopicEventType.UPDATED, id: 'topic-owner' }));
  await waitFor(() => expect(container.firstChild).toBeNull());
  (TopicService.getTopic as jest.Mock).mockImplementation(async (id: string) =>
    id === 'topic-owner' ? { references } : { title: 'Related brief' },
  );
  act(() => changed({ type: TopicEventType.UPDATED, id: 'topic-owner' }));
  await screen.findByText('Architecture');
  expect(screen.getByRole('region', { name: 'Related topics' })).toBeTruthy();
});

test('deduplicates repeated references without conflating target kinds', async () => {
  (TopicService.getTopic as jest.Mock).mockImplementation(async (id: string) =>
    id === 'topic-owner'
      ? { references: [...references, ...references] }
      : { title: 'Related brief' },
  );
  render(<TopicReferencesRail {...props} />);
  await screen.findByText('Architecture');
  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(C4SketchService.getSummary).toHaveBeenCalledTimes(1);
});

test('distinguishes missing targets from failed lookups and disables opening both', async () => {
  (TopicService.getTopic as jest.Mock).mockImplementation(async (id: string) =>
    id === 'topic-owner' ? { references } : null,
  );
  (C4SketchService.getSummary as jest.Mock).mockRejectedValue(
    new Error('Unavailable'),
  );
  render(<TopicReferencesRail {...props} />);
  expect(await screen.findByText('Reference not found')).toBeTruthy();
  expect(screen.getByText('Could not load reference')).toBeTruthy();
  const missing = screen.getByRole('button', {
    name: 'topic-related unavailable',
  }) as HTMLButtonElement;
  const failed = screen.getByRole('button', {
    name: 'c4s-123-abc unavailable',
  }) as HTMLButtonElement;
  expect(missing.disabled).toBe(true);
  expect(failed.disabled).toBe(true);
  fireEvent.click(missing);
  fireEvent.click(failed);
  expect(props.onOpenTopic).not.toHaveBeenCalled();
  expect(props.onOpenSketch).not.toHaveBeenCalled();
});

test('refreshes referenced topic titles and deletions on broadcasts, and unsubscribes', async () => {
  const { unmount } = render(<TopicReferencesRail {...props} />);
  await screen.findByText('Related brief');
  (TopicService.getTopic as jest.Mock).mockImplementation(async (id: string) =>
    id === 'topic-owner' ? { references } : { title: 'Renamed brief' },
  );
  act(() => changed({ type: TopicEventType.UPDATED, id: 'topic-related' }));
  await screen.findByText('Renamed brief');
  (TopicService.getTopic as jest.Mock).mockImplementation(async (id: string) =>
    id === 'topic-owner' ? { references } : null,
  );
  act(() => changed({ type: TopicEventType.REMOVED, id: 'topic-related' }));
  await screen.findByText('Reference not found');
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

test('refreshes sketch titles when returning from Studio', async () => {
  render(<TopicReferencesRail {...props} />);
  await screen.findByText('Architecture');
  (C4SketchService.getSummary as jest.Mock).mockResolvedValue({
    title: 'Revised architecture',
  });
  fireEvent(window, new Event('focus'));
  expect(await screen.findByText('Revised architecture')).toBeTruthy();
});

test('ignores an old topic load after switching topic identity', async () => {
  let resolveOwner!: (value: unknown) => void;
  (TopicService.getTopic as jest.Mock).mockImplementation((id: string) =>
    id === 'topic-owner'
      ? new Promise((resolve) => {
          resolveOwner = resolve;
        })
      : Promise.resolve({ references: [] }),
  );
  const { container, rerender } = render(<TopicReferencesRail {...props} />);
  rerender(<TopicReferencesRail {...props} topicId="topic-next" />);
  await waitFor(() => expect(container.firstChild).toBeNull());
  await act(async () => {
    resolveOwner({ references });
  });
  await waitFor(() => expect(screen.queryByText('Architecture')).toBeNull());
});

test('shows an owner load error instead of pretending there are no references', async () => {
  (TopicService.getTopic as jest.Mock).mockRejectedValue(
    new Error('Unreadable'),
  );
  render(<TopicReferencesRail {...props} />);
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Could not load references.',
  );
});

describe('drawing references', () => {
  const drawingRef = { kind: 'drawing', drawingId: 'd-123' };
  beforeEach(() => {
    (TopicService.getTopic as jest.Mock).mockImplementation(
      async (id: string) =>
        id === 'topic-owner' ? { references: [drawingRef] } : null,
    );
    (getDrawingSummary as jest.Mock).mockResolvedValue({
      id: 'd-123',
      name: 'Whiteboard',
      path: '/home/.alexandria/drawings/d-123.excalidraw',
    });
  });

  test('shows the drawing name and opens it with its resolved path', async () => {
    const onOpenDrawing = jest.fn();
    render(<TopicReferencesRail {...props} onOpenDrawing={onOpenDrawing} />);
    const button = await screen.findByRole('button', {
      name: 'Open Whiteboard in a new tab',
    });
    expect(screen.getByRole('region', { name: 'Drawings' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'C4 sketches' })).toBeNull();
    fireEvent.click(button);
    expect(getDrawingSummary).toHaveBeenCalledWith('d-123');
    expect(onOpenDrawing).toHaveBeenCalledWith(
      'd-123',
      'Whiteboard',
      '/home/.alexandria/drawings/d-123.excalidraw',
    );
  });

  test('lists but cannot open drawings when the host has no drawing tabs', async () => {
    render(<TopicReferencesRail {...props} />);
    const button = (await screen.findByRole('button', {
      name: 'Whiteboard',
    })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  test('marks a deleted drawing as not found', async () => {
    (getDrawingSummary as jest.Mock).mockResolvedValue(null);
    const onOpenDrawing = jest.fn();
    render(<TopicReferencesRail {...props} onOpenDrawing={onOpenDrawing} />);
    expect(await screen.findByText('Reference not found')).toBeTruthy();
    const button = screen.getByRole('button', {
      name: 'd-123 unavailable',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
