import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type { Topic } from '@principal-ai/alexandria-core-library/types';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { TopicTabContent } from './TopicTabContent';
import { TopicService } from '../main-process-api/TopicService';
import { TrailShareService } from '../services/TrailShareService';
import { TrailShareError } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { FetchSharedTopicResult } from '../../shared/main-process-api-interfaces/TopicAPI';
import type { FileCityTrailFetchSharedByIdResult } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

// ---------- mock plumbing ----------
//
// TopicTabContent self-fetches: it resolves the topic via the static
// `TopicService.fetchSharedById`, then hydrates each of the topic's trails via
// `TrailShareService.fetchSharedById` (no prop injection). Mirroring the
// InboxLeftPanel story, we rewire those two statics once to read from a mutable
// `activeMocks` cell and swap the cell per-story before returning the element.
//
// The viewer pane (`SharedTrailViewer` → `FileCityTrailPanel`) still reaches for
// a local clone / remote file tree via other services; with empty `repositories`
// and no `window.mainProcess`, it degrades to its "not cloned locally" state.
// These stories are about the left master list — the topic header, the markdown
// description, the repo grouping, and the per-trail loading/error states.

type TrailMock =
  | FileCityTrailFetchSharedByIdResult
  | 'reject'
  | 'pending';

type MockState = {
  topic: FetchSharedTopicResult | 'reject' | 'pending';
  /** Per-trail-id hydration result. Missing ids reject. */
  trails: Record<string, TrailMock>;
};

let activeMocks: MockState = {
  topic: 'pending',
  trails: {},
};

/** Set per-story before returning the rendered element. */
const withMocks = (state: MockState): void => {
  activeMocks = state;
};

const resolveMock = <T,>(
  value: T | 'reject' | 'pending',
  rejectMessage: string,
): Promise<T> => {
  if (value === 'pending') return new Promise<T>(() => {});
  if (value === 'reject') {
    return Promise.reject(new TrailShareError('NO_GITHUB_TOKEN', rejectMessage));
  }
  return Promise.resolve(value);
};

(
  TopicService as unknown as {
    fetchSharedById: typeof TopicService.fetchSharedById;
  }
).fetchSharedById = async () =>
  resolveMock(activeMocks.topic, 'You need to sign in to view this topic.');

(
  TrailShareService as unknown as {
    fetchSharedById: typeof TrailShareService.fetchSharedById;
  }
).fetchSharedById = async (id: string) =>
  resolveMock(
    activeMocks.trails[id] ?? 'reject',
    'Sign in with GitHub to load this trail.',
  );

// ---------- fixtures ----------

const now = () => new Date().toISOString();

const topic = (over: Partial<Topic> & Pick<Topic, 'trailIds'>): Topic => ({
  id: 'topic-1',
  title: 'Understanding the React reconciler',
  description:
    'A curated walk through how React schedules and commits work — start ' +
    'with the scheduler, then the reconciler, then the commit phase.\n\n' +
    '- Each trail is a self-contained read.\n' +
    '- Open in browser to share the topic link.',
  createdAt: now(),
  updatedAt: now(),
  createdBy: { githubId: 2, githubLogin: 'dan' },
  ...over,
});

/** A hydrated-trail fixture for `TrailShareService.fetchSharedById`. */
const trail = (
  id: string,
  title: string,
  owner: string,
  repo: string,
  purpose: TrailPayload['purpose'] = 'informative',
): FileCityTrailFetchSharedByIdResult => ({
  owner,
  repo,
  payload: {
    id,
    title,
    purpose,
    markers: [],
    views: [],
    createdAt: now(),
    updatedAt: now(),
  },
});

// Three trails across two repos, so the list exercises repo grouping.
const trailFixtures: Record<string, FileCityTrailFetchSharedByIdResult> = {
  't-1': trail(
    't-1',
    'How the scheduler prioritizes work',
    'facebook',
    'react',
    'informative',
  ),
  't-2': trail(
    't-2',
    'Reconciler: diffing the fiber tree',
    'facebook',
    'react',
    'informative',
  ),
  't-3': trail(
    't-3',
    'Concurrent rendering, an investigation',
    'reactwg',
    'react-18',
    'investigation',
  ),
};

// ---------- meta ----------

const meta: Meta<typeof TopicTabContent> = {
  title: 'Inbox/TopicTabContent',
  component: TopicTabContent,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ width: '100vw', height: '100vh' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const render = () => (
  <TopicTabContent
    topicId="topic-1"
    events={new PanelEventBus()}
    repositories={[]}
  />
);

/**
 * The happy path — the topic overview with no trail selected. Three trails
 * group into two repo cards: a multi-trail card (facebook/react, 2 trails —
 * click to expand its inline trail list) and a single-trail card (reactwg/
 * react-18 — click to open the viewer directly). Selecting a trail docks the
 * `SharedTrailViewer` on the right and shrinks the overview.
 */
export const Default: Story = {
  render: () => {
    withMocks({
      topic: { topic: topic({ trailIds: ['t-1', 't-2', 't-3'] }), starred: false },
      trails: trailFixtures,
    });
    return render();
  },
};

/**
 * Mixed per-trail states — one trail resolves, one is still loading (it never
 * resolves), and one fails to hydrate. Only the resolved trail surfaces as a
 * repo card; trails without a resolved origin (loading / errored) don't appear,
 * matching the web page. While any are still loading the overview is otherwise
 * the same as the happy path.
 */
export const MixedTrailStates: Story = {
  render: () => {
    withMocks({
      topic: {
        topic: topic({ trailIds: ['t-1', 't-pending', 't-broken'] }),
        starred: false,
      },
      trails: {
        't-1': trailFixtures['t-1'],
        't-pending': 'pending',
        't-broken': 'reject',
      },
    });
    return render();
  },
};

/** A topic with no description — the title and repo cards sit alone. */
export const NoDescription: Story = {
  render: () => {
    withMocks({
      topic: {
        topic: topic({ trailIds: ['t-1', 't-2'], description: undefined }),
        starred: false,
      },
      trails: trailFixtures,
    });
    return render();
  },
};

/** A topic that has been published but has no trails yet. */
export const EmptyTopic: Story = {
  render: () => {
    withMocks({
      topic: { topic: topic({ trailIds: [] }), starred: false },
      trails: {},
    });
    return render();
  },
};

/** The topic fetch never resolves — the "Loading topic…" shell. */
export const Loading: Story = {
  render: () => {
    withMocks({ topic: 'pending', trails: {} });
    return render();
  },
};

/**
 * The topic fetch rejects (e.g. signed out, or a bad link) — the centered
 * error message from the `TrailShareError`.
 */
export const TopicError: Story = {
  render: () => {
    withMocks({ topic: 'reject', trails: {} });
    return render();
  },
};
