import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TopicProjectsRail } from './TopicProjectsRail';
import { TopicService } from '../../main-process-api/TopicService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [12, 14, 16] },
  }),
}));
jest.mock('../../main-process-api/TopicService', () => ({
  TopicService: { getTopic: jest.fn(), onTopicChange: jest.fn() },
}));

const purl = 'pkg:github/owner/app';
beforeEach(() => {
  jest.clearAllMocks();
  (TopicService.getTopic as jest.Mock).mockResolvedValue({ repos: [purl] });
  (TopicService.onTopicChange as jest.Mock).mockReturnValue(jest.fn());
});

test('normal clicks keep the profile/explorer action', async () => {
  const onOpenProject = jest.fn();
  render(<TopicProjectsRail topicId="topic-a" onOpenProject={onOpenProject} />);
  fireEvent.click(await screen.findByRole('button'));
  expect(onOpenProject).toHaveBeenCalledTimes(1);
  expect(onOpenProject).toHaveBeenCalledWith(purl);
});

test('Command-click requests a terminal instead of a profile', async () => {
  const onOpenProject = jest.fn();
  const parentClick = jest.fn();
  render(
    <div onClick={parentClick}>
      <TopicProjectsRail topicId="topic-a" onOpenProject={onOpenProject} />
    </div>,
  );
  fireEvent.click(await screen.findByRole('button'), { metaKey: true });
  expect(onOpenProject).toHaveBeenCalledTimes(1);
  expect(onOpenProject).toHaveBeenCalledWith(purl, 'terminal');
  expect(parentClick).not.toHaveBeenCalled();
});

test('right-click requests a terminal and suppresses the context menu and parent handlers', async () => {
  const onOpenProject = jest.fn();
  const parentContextMenu = jest.fn();
  render(
    <div onContextMenu={parentContextMenu}>
      <TopicProjectsRail topicId="topic-a" onOpenProject={onOpenProject} />
    </div>,
  );
  expect(fireEvent.contextMenu(await screen.findByRole('button'))).toBe(false);
  expect(onOpenProject).toHaveBeenCalledTimes(1);
  expect(onOpenProject).toHaveBeenCalledWith(purl, 'terminal');
  expect(parentContextMenu).not.toHaveBeenCalled();
});
