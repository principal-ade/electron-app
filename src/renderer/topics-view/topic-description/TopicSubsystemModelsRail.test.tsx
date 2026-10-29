/// <reference types="jest" />
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TopicSubsystemModelsRail } from './TopicSubsystemModelsRail';
import { TopicService } from '../../main-process-api/TopicService';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';
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
    updateTopic: jest.fn(),
    onTopicChange: jest.fn(),
  },
}));
jest.mock('../../main-process-api/SubsystemModelService', () => ({
  SubsystemModelService: { list: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  (TopicService.getTopic as jest.Mock).mockResolvedValue({
    subsystemModels: [{ modelId: 'model-a', trailIds: ['request-flow'] }],
  });
  (TopicService.updateTopic as jest.Mock).mockResolvedValue({
    subsystemModels: [],
  });
  (TopicService.onTopicChange as jest.Mock).mockReturnValue(jest.fn());
  (SubsystemModelService.list as jest.Mock).mockResolvedValue([
    { id: 'model-a', title: 'Request handling', componentCount: 3 },
  ]);
});

test.each([undefined, []])(
  'hides the models section without associations: %p',
  async (subsystemModels) => {
    (TopicService.getTopic as jest.Mock).mockResolvedValue({ subsystemModels });
    const { container } = await act(async () =>
      render(
        <TopicSubsystemModelsRail topicId="topic-a" onOpenModel={jest.fn()} />,
      ),
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Models')).toBeNull();
  },
);

test('hides the models section when its last association is removed', async () => {
  let changed: ((event: TopicChangeEvent) => void) | undefined;
  (TopicService.onTopicChange as jest.Mock).mockImplementation((listener) => {
    changed = listener;
    return jest.fn();
  });
  const { container } = render(
    <TopicSubsystemModelsRail topicId="topic-a" onOpenModel={jest.fn()} />,
  );
  await screen.findByText('Request handling');
  (TopicService.getTopic as jest.Mock).mockResolvedValue({
    subsystemModels: [],
  });
  await act(async () =>
    changed?.({ type: TopicEventType.UPDATED, id: 'topic-a' }),
  );
  expect(container.firstChild).toBeNull();
});

test('opens a linked model with its id and title', async () => {
  const onOpenModel = jest.fn();
  render(
    <TopicSubsystemModelsRail topicId="topic-a" onOpenModel={onOpenModel} />,
  );
  const card = await screen.findByRole('button', {
    name: 'Open Request handling in a new tab',
  });
  expect(card.tagName).toBe('BUTTON');
  expect(card.tabIndex).toBe(0);
  expect(screen.getByText('Models')).toBeTruthy();
  expect(screen.queryByText(/Models \(/)).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Associate a subsystem model' }),
  ).toBeNull();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(screen.getByText('request-flow'));
  expect(onOpenModel).toHaveBeenCalledWith('model-a', 'Request handling');
});

test('matches project card hover colors and restores them on mouse leave', async () => {
  render(
    <TopicSubsystemModelsRail topicId="topic-a" onOpenModel={jest.fn()} />,
  );
  const button = await screen.findByRole('button', {
    name: 'Open Request handling in a new tab',
  });
  const card = button.parentElement;
  if (!card) throw new Error('Model card wrapper is missing');
  fireEvent.mouseEnter(card);
  expect(card.style.backgroundColor).toBe('rgb(51, 51, 51)');
  expect(card.style.borderColor).toBe('#00aaff');
  fireEvent.mouseLeave(card);
  expect(card.style.backgroundColor).toBe('rgb(34, 34, 34)');
  expect(card.style.borderColor).toBe('#444444');
});

test('shows wrapping model names without component counts or removal buttons', async () => {
  const title = 'A long subsystem model name that needs multiple lines';
  (SubsystemModelService.list as jest.Mock).mockResolvedValue([
    { id: 'model-a', title, componentCount: 3 },
  ]);
  render(
    <TopicSubsystemModelsRail topicId="topic-a" onOpenModel={jest.fn()} />,
  );
  await screen.findByRole('button', {
    name: `Open ${title} in a new tab`,
  });
  const name = screen.getByText(title);
  expect(name.style.whiteSpace).toBe('normal');
  expect(name.style.overflowWrap).toBe('anywhere');
  expect(name.style.textOverflow).toBe('');
  expect(name.style.paddingRight).toBe('');
  expect(screen.queryByText(/components/)).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Remove association' }),
  ).toBeNull();
  expect(TopicService.updateTopic).not.toHaveBeenCalled();
});

test('uses the model id as the tab title when its summary is missing', async () => {
  (SubsystemModelService.list as jest.Mock).mockResolvedValue([]);
  const onOpenModel = jest.fn();
  render(
    <TopicSubsystemModelsRail topicId="topic-a" onOpenModel={onOpenModel} />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Open model-a in a new tab' }),
  );
  expect(onOpenModel).toHaveBeenCalledWith('model-a', 'model-a');
});
