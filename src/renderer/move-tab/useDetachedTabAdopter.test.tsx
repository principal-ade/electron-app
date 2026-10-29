/// <reference types="jest" />
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDetachedTabAdopter } from './useDetachedTabAdopter';
import { WindowService } from '../main-process-api/WindowService';
import type { DetachableTabDescriptor } from '../../shared/detachedTab';

jest.mock('../main-process-api/WindowService', () => ({
  WindowService: {
    onIncomingDetachedTab: jest.fn(),
    claimIncomingDetachedTab: jest.fn(),
    acceptIncomingDetachedTab: jest.fn(),
    rejectIncomingDetachedTab: jest.fn(),
  },
}));

let incoming: (payload: { token: string }) => void;
beforeEach(() => {
  jest.clearAllMocks();
  (WindowService.onIncomingDetachedTab as jest.Mock).mockImplementation(
    (listener) => {
      incoming = listener;
      return jest.fn();
    },
  );
  (WindowService.acceptIncomingDetachedTab as jest.Mock).mockResolvedValue(
    true,
  );
});

test.each([
  {
    kind: 'local-topic',
    topicId: 'topic-a',
    title: 'Topic',
    opener: 'openLocalTopic',
    id: 'topic-a',
  },
  {
    kind: 'subsystem-model',
    modelId: 'sg-1-abc',
    opener: 'openSubsystemModel',
    id: 'sg-1-abc',
  },
  {
    kind: 'c4-sketch',
    sketchId: 'c4s-123-abc',
    opener: 'openC4Sketch',
    id: 'c4s-123-abc',
  },
])('adopts a $kind before accepting its return transfer', async (value) => {
  const openers = {
    openLocalTopic: jest.fn(),
    openSubsystemModel: jest.fn(),
    openC4Sketch: jest.fn(),
  };
  const descriptor = {
    ...value,
    label: 'Title',
    tabId: 'tab',
  } as DetachableTabDescriptor;
  (WindowService.claimIncomingDetachedTab as jest.Mock).mockResolvedValue(
    descriptor,
  );
  renderHook(() => useDetachedTabAdopter(openers));
  act(() => incoming({ token: 'token' }));
  await waitFor(() =>
    expect(WindowService.acceptIncomingDetachedTab).toHaveBeenCalledWith(
      'token',
    ),
  );
  expect(openers[value.opener as keyof typeof openers]).toHaveBeenCalledWith(
    value.id,
    value.kind === 'local-topic' ? 'Topic' : 'Title',
  );
  expect(WindowService.rejectIncomingDetachedTab).not.toHaveBeenCalled();
});
