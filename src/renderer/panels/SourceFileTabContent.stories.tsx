import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import { SourceFileTabContent } from './SourceFileTabContent';
import {
  installFileTabMocks,
  installEditableFileTabMocks,
} from './fileTabStoryFixtures';

const meta: Meta<typeof SourceFileTabContent> = {
  title: 'Dev Workspace/SourceFileTabContent',
  component: SourceFileTabContent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Source tabs use Monaco when local write access is confirmed, and Pierre otherwise. All file reads, permission checks, writes, and watches are mocked; nothing touches disk.',
      },
    },
  },
  beforeEach: installFileTabMocks,
  args: {
    filePath: '/storybook/searchTopics.ts',
    fileName: 'searchTopics.ts',
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div
          style={{
            width: '100%',
            height: '100vh',
            overflow: 'hidden',
            background: slateNeonTheme.colors.background,
            color: slateNeonTheme.colors.text,
            fontFamily: slateNeonTheme.fonts.body,
          }}
        >
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof SourceFileTabContent>;

export const TypeScript: Story = {};

export const LongFile: Story = {
  args: { filePath: '/storybook/longFile.ts', fileName: 'longFile.ts' },
};

const spanArgs = {
  filePath: '/storybook/longFile.ts',
  fileName: 'longFile.ts',
  range: {
    startLineNumber: 302,
    startColumn: 1,
    endLineNumber: 304,
    endColumn: 2,
  },
};

export const ReadOnlySpan: Story = {
  args: spanArgs,
};

export const WritableLocalSpan: Story = {
  beforeEach: installEditableFileTabMocks,
  args: spanArgs,
  parameters: {
    docs: {
      description: {
        story:
          'Automatically chooses editable Monaco, opens the supplied span, and saves in memory with Cmd/Ctrl+S. Unsaved edits survive closing/reopening the tab. Discard reloads the fake disk version.',
      },
    },
  },
};

export const EmptyFile: Story = {
  args: { filePath: '/storybook/empty.ts', fileName: 'empty.ts' },
};

export const Loading: Story = {
  args: { filePath: '/storybook/loading.ts', fileName: 'loading.ts' },
};

export const MissingFile: Story = {
  args: { filePath: '/storybook/missing.ts', fileName: 'missing.ts' },
};

export const ReadError: Story = {
  args: { filePath: '/storybook/unreadable.ts', fileName: 'unreadable.ts' },
};
