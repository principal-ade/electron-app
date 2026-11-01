/// <reference types="jest" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { LocalTopicTabContent } from './LocalTopicTabContent';
import { DevWorkspaceTopicTab } from '../dev-workspace/topics-panel/DevWorkspaceTopicTab';
import { TopicService } from '../main-process-api/TopicService';
import {
  ThemeProvider,
  slateNeonTheme,
  slatePeachTheme,
} from '@principal-ade/industry-theme';

let mockHasToc = true;

jest.mock('./topic-description/TopicDescriptionBody', () => ({
  TopicDescriptionBody: ({
    onTocAvailableChange,
    onCloseToc,
  }: {
    onTocAvailableChange: (available: boolean) => void;
    onCloseToc: () => void;
  }) => {
    const { theme } = jest
      .requireActual<
        typeof import('@principal-ade/industry-theme')
      >('@principal-ade/industry-theme')
      .useTheme();
    jest.requireActual<typeof React>('react').useEffect(() => {
      onTocAvailableChange(mockHasToc);
    }, [onTocAvailableChange]);
    return (
      <button
        onClick={onCloseToc}
        data-primary={theme.colors.primary}
        data-accent={theme.colors.accent}
      >
        Close outline
      </button>
    );
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
jest.mock('../panels/home-panel/useHomePins', () => ({
  useHomePins: () => ({ isTabPinned: () => true, toggleTabPin: jest.fn() }),
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
  const renderTab = () =>
    render(<ThemeProvider theme={slateNeonTheme}>{createTab()}</ThemeProvider>);

  test('keeps the pinned header action on the sidebar theme', () => {
    renderTab();
    const pin = screen.getByRole('button', {
      name: 'Unpin My topic from Home',
    });
    expect(pin.getAttribute('aria-pressed')).toBe('true');
    expect(pin.style.color).toBe('rgb(243, 111, 65)');
    expect(pin.style.borderColor.toLowerCase()).toBe(
      slateNeonTheme.colors.primary.toLowerCase(),
    );
  });
  test('supplies Slate Peach to the shared topic description', () => {
    renderTab();
    const body = screen.getByRole('button', { name: 'Close outline' });
    expect(body.getAttribute('data-primary')).toBe(
      slatePeachTheme.colors.primary,
    );
    expect(body.getAttribute('data-accent')).toBe(
      slatePeachTheme.colors.accent,
    );
  });

  test('passes reference navigation through to the hosting tab system', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Open related topic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open C4 sketch' }));
    expect(props.onOpenTopic).toHaveBeenCalledWith('topic-b', 'Related');
    expect(props.onOpenSketch).toHaveBeenCalledWith(
      'c4s-123-abc',
      'Architecture',
    );
  });

  test('title and contents button toggle the same outline', () => {
    renderTab();
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

  test('hovering other header actions does not highlight the contents button', () => {
    renderTab();
    const contents = screen.getByRole('button', { name: 'Table of contents' });
    for (const name of [
      'Copy topic file path',
      'Unpin My topic from Home',
      'Delete topic',
    ]) {
      fireEvent.mouseEnter(screen.getByRole('button', { name }));
      expect(contents.style.color).toBe('rgb(208, 214, 224)');
      expect(contents.style.borderColor.toLowerCase()).not.toBe(
        slateNeonTheme.colors.primary.toLowerCase(),
      );
    }
  });

  test('title hover and focus highlight only the contents button', () => {
    renderTab();
    const title = screen.getByRole('button', {
      name: 'Table of contents for My topic',
    });
    const contents = screen.getByRole('button', { name: 'Table of contents' });
    fireEvent.mouseEnter(title);
    expect(contents.style.color).toBe('rgb(243, 111, 65)');
    expect(contents.style.borderColor.toLowerCase()).toBe(
      slateNeonTheme.colors.primary.toLowerCase(),
    );
    fireEvent.mouseLeave(title);
    expect(contents.style.color).toBe('rgb(208, 214, 224)');
    fireEvent.focus(title);
    expect(contents.style.color).toBe('rgb(243, 111, 65)');
    fireEvent.blur(title);
    expect(contents.style.color).toBe('rgb(208, 214, 224)');
    fireEvent.click(title);
    fireEvent.mouseLeave(title);
    expect(contents.style.color).toBe('rgb(243, 111, 65)');
  });

  test('other header actions do not toggle the outline', () => {
    renderTab();
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy topic file path' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Unpin My topic from Home' }),
    );
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
    renderTab();
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
