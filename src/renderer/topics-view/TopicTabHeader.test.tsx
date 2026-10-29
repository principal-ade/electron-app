/// <reference types="jest" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { LocalTopicTabContent } from './LocalTopicTabContent';
import { DevWorkspaceTopicTab } from '../dev-workspace/topics-panel/DevWorkspaceTopicTab';
import { TopicService } from '../main-process-api/TopicService';

let mockHasToc = true;

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#00aaff',
        text: '#ffffff',
        border: '#444444',
        background: '#111111',
        backgroundSecondary: '#222222',
      },
      fonts: { heading: 'sans-serif' },
      fontSizes: [12, 14, 16, 20],
    },
  }),
}));
jest.mock('./topic-description/TopicDescriptionBody', () => ({
  TopicDescriptionBody: ({
    onTocAvailableChange,
    onCloseToc,
  }: {
    onTocAvailableChange: (available: boolean) => void;
    onCloseToc: () => void;
  }) => {
    jest.requireActual<typeof React>('react').useEffect(() => {
      onTocAvailableChange(mockHasToc);
    }, [onTocAvailableChange]);
    return <button onClick={onCloseToc}>Close outline</button>;
  },
}));
jest.mock('./topic-description/TopicProjectsRail', () => ({
  TopicProjectsRail: () => null,
}));
jest.mock('./topic-description/TopicSubsystemModelsRail', () => ({
  TopicSubsystemModelsRail: () => null,
}));
jest.mock('./topic-description/TopicReferencesRail', () => ({
  TopicReferencesRail: ({
    onOpenTopic,
    onOpenSketch,
  }: {
    onOpenTopic: (id: string, title: string) => void;
    onOpenSketch: (id: string, title: string) => void;
  }) => (
    <>
      <button onClick={() => onOpenTopic('topic-b', 'Related')}>
        Open related topic
      </button>
      <button onClick={() => onOpenSketch('c4s-123-abc', 'Architecture')}>
        Open C4 sketch
      </button>
    </>
  ),
}));
jest.mock('./TopicPinHeaderButton', () => ({
  TopicPinHeaderButton: () => <button>Pin topic</button>,
}));
jest.mock('./TopicDeleteHeaderButton', () => ({
  TopicDeleteHeaderButton: () => <button>Delete topic</button>,
}));
jest.mock('../main-process-api/TopicService', () => ({
  TopicService: { getFilePath: jest.fn().mockResolvedValue(null) },
}));

const props = {
  topicId: 'topic-a',
  title: 'My topic',
  events: { emit: jest.fn() } as unknown as PanelEventEmitter,
  onOpenModel: jest.fn(),
  onOpenTopic: jest.fn(),
  onOpenSketch: jest.fn(),
};

beforeEach(() => {
  mockHasToc = true;
  jest.clearAllMocks();
});

describe.each([
  ['Topics view', () => <LocalTopicTabContent {...props} />],
  ['Dev Workspace', () => <DevWorkspaceTopicTab {...props} isActive />],
])('%s header', (_name, createTab) => {
  test('passes reference navigation through to the hosting tab system', () => {
    render(createTab());
    fireEvent.click(screen.getByRole('button', { name: 'Open related topic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open C4 sketch' }));
    expect(props.onOpenTopic).toHaveBeenCalledWith('topic-b', 'Related');
    expect(props.onOpenSketch).toHaveBeenCalledWith(
      'c4s-123-abc',
      'Architecture',
    );
  });

  test('title and contents button toggle the same outline', () => {
    render(createTab());
    const title = screen.getByRole('button', {
      name: 'Table of contents for My topic',
    });
    const contents = screen.getByRole('button', { name: 'Table of contents' });
    expect(screen.getByRole('heading', { name: /My topic/ })).toBeTruthy();
    expect(title.tagName).toBe('BUTTON');
    expect(title.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(title);
    expect(contents.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(contents);
    expect(title.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(title);
    fireEvent.click(screen.getByRole('button', { name: 'Close outline' }));
    expect(title.getAttribute('aria-expanded')).toBe('false');
  });

  test('header hover and title focus highlight only the contents button', () => {
    render(createTab());
    const title = screen.getByRole('button', {
      name: 'Table of contents for My topic',
    });
    const contents = screen.getByRole('button', { name: 'Table of contents' });
    fireEvent.mouseEnter(title);
    expect(contents.style.color).toBe('rgb(0, 170, 255)');
    expect(contents.style.borderColor).toBe('#00aaff');
    fireEvent.mouseLeave(title);
    expect(contents.style.color).toBe('rgb(255, 255, 255)');
    fireEvent.focus(title);
    expect(contents.style.color).toBe('rgb(0, 170, 255)');
    fireEvent.blur(title);
    expect(contents.style.color).toBe('rgb(255, 255, 255)');
    fireEvent.click(title);
    fireEvent.mouseLeave(title);
    expect(contents.style.color).toBe('rgb(0, 170, 255)');
  });

  test('other header actions do not toggle the outline', () => {
    render(createTab());
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy topic file path' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin topic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete topic' }));
    expect(TopicService.getFilePath).toHaveBeenCalledWith('topic-a');
    expect(
      screen
        .getByRole('button', { name: 'Table of contents' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  test('title is disabled when the topic has no headings', () => {
    mockHasToc = false;
    render(createTab());
    const title = screen.getByRole('button', {
      name: 'Table of contents for My topic',
    }) as HTMLButtonElement;
    expect(title.disabled).toBe(true);
    fireEvent.click(title);
    expect(title.getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByRole('button', { name: 'Table of contents' }),
    ).toBeNull();
  });
});
