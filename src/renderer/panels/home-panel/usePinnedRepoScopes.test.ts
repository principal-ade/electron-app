import { act, renderHook, waitFor } from '@testing-library/react';
import type { HomePinnedTab } from '../../../shared/types/userPreferences.types';
import { TopicService } from '../../main-process-api/TopicService';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';
import { singleRepoScope, usePinnedRepoScopes } from './usePinnedRepoScopes';

jest.mock('../../main-process-api/TopicService', () => ({
  TopicService: {
    getTopic: jest.fn(),
    onTopicChange: jest.fn(() => jest.fn()),
  },
}));
jest.mock('../../main-process-api/SubsystemModelService', () => ({
  SubsystemModelService: { get: jest.fn() },
}));

const purl = 'pkg:github/acme/app';
const other = 'pkg:github/acme/other';
const pins: HomePinnedTab[] = [
  { id: 'topic', kind: 'topic', label: 'Topic', topicId: 't1' },
  { id: 'model', kind: 'subsystem-model', label: 'Model', modelId: 'm1' },
];

beforeEach(() => jest.clearAllMocks());

test('counts distinct repositories, not file fragments', () => {
  expect(singleRepoScope([`${purl}#a.ts`, `${purl}#b.ts`])).toBe(purl);
  expect(singleRepoScope([purl, other])).toBeUndefined();
  expect(singleRepoScope([])).toBeUndefined();
});

test('resolves existing pins and refreshes changed topic scope', async () => {
  jest.mocked(TopicService.getTopic).mockResolvedValue({
    repos: [purl],
  } as NonNullable<Awaited<ReturnType<typeof TopicService.getTopic>>>);
  jest.mocked(SubsystemModelService.get).mockResolvedValue({
    title: 'Model',
    components: [{ purl: `${purl}#a.ts` }, { purl: `${purl}#b.ts` }],
  } as NonNullable<Awaited<ReturnType<typeof SubsystemModelService.get>>>);
  const { result } = renderHook(() => usePinnedRepoScopes(pins));
  await waitFor(() => expect(result.current.size).toBe(2));
  expect(result.current.get('topic')).toBe(purl);
  expect(result.current.get('model')).toBe(purl);

  jest.mocked(TopicService.getTopic).mockResolvedValue({
    repos: [purl, other],
  } as NonNullable<Awaited<ReturnType<typeof TopicService.getTopic>>>);
  act(() => {
    jest
      .mocked(TopicService.onTopicChange)
      .mock.calls[0][0](
        {} as Parameters<Parameters<typeof TopicService.onTopicChange>[0]>[0],
      );
  });
  await waitFor(() => expect(result.current.has('topic')).toBe(false));
  expect(result.current.get('model')).toBe(purl);
});

test('includes trail repositories and tolerates a missing or failed lookup', async () => {
  jest
    .mocked(TopicService.getTopic)
    .mockRejectedValue(new Error('Unavailable'));
  jest.mocked(SubsystemModelService.get).mockResolvedValue({
    title: 'Model',
    components: [{ purl }],
    trails: [{ steps: [{ purl, target: { purl: `${other}#api.ts` } }] }],
  } as NonNullable<Awaited<ReturnType<typeof SubsystemModelService.get>>>);
  const { result } = renderHook(() => usePinnedRepoScopes(pins));
  await waitFor(() => expect(SubsystemModelService.get).toHaveBeenCalled());
  await act(async () => {});
  expect(result.current.size).toBe(0);
});
