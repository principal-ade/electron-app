/// <reference types="jest" />
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { PortalTabsProvider, useWorkspaceTabs } from './PortalTabsContext';

jest.mock('../main-process-api/TopicService', () => ({
  TopicService: { onTopicChange: jest.fn(() => jest.fn()) },
}));
jest.mock('../main-process-api/ProcessRegistryService', () => ({
  ProcessRegistryService: {
    list: jest.fn(async () => []),
    onChanged: jest.fn(() => jest.fn()),
  },
}));

test('opens and focuses C4 sketch tabs by identity without duplicating them', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PortalTabsProvider>{children}</PortalTabsProvider>
  );
  const { result } = renderHook(useWorkspaceTabs, { wrapper });
  act(() => result.current.openC4Sketch('c4s-123-abc', 'Architecture'));
  act(() => result.current.openLocalTopic('topic-related', 'Related brief'));
  act(() => result.current.openC4Sketch('c4s-123-abc', 'Architecture'));
  expect(result.current.tabs).toHaveLength(2);
  expect(result.current.tabs[0]).toMatchObject({
    id: 'c4-sketch-c4s-123-abc',
    contentType: 'c4-sketch',
    sketchId: 'c4s-123-abc',
    label: 'Architecture',
  });
  expect(result.current.activeTabId).toBe('c4-sketch-c4s-123-abc');
});
