import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import {
  MonacoFileTabContent,
  type MonacoFileTabContentProps,
} from './MonacoFileTabContent';
import { SourceFileTabContent } from './SourceFileTabContent';
import { installFileTabMocks } from './fileTabStoryFixtures';
import { FileSystemService } from '../main-process-api/FileSystemService';

// Use the fixture loader without starting native file watches in Storybook.
function StoryFileTab(props: MonacoFileTabContentProps) {
  const { filePath } = props;
  const contentLoader = React.useCallback(
    async () => (await FileSystemService.readFile(filePath))?.content ?? null,
    [filePath],
  );
  return <MonacoFileTabContent {...props} contentLoader={contentLoader} />;
}

const meta: Meta<typeof MonacoFileTabContent> = {
  title: 'Dev Workspace/MonacoFileTabContent',
  component: MonacoFileTabContent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A separate file tab reusing the existing themed Monaco editor. Compare the same source with Pierre, or try editable and Vim modes. Story edits stay in memory; nothing is written to disk.',
      },
    },
  },
  beforeEach: installFileTabMocks,
  render: (args) => <StoryFileTab {...args} />,
  args: {
    filePath: '/storybook/searchTopics.ts',
    fileName: 'searchTopics.ts',
    editable: false,
    vimModeOverride: false,
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <div style={{ height: '100vh', width: '100%', overflow: 'hidden' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof MonacoFileTabContent>;

export const ReadOnly: Story = {};

export const Editable: Story = {
  args: { editable: true },
};

export const VimMode: Story = {
  args: { editable: true, vimModeOverride: true },
};

export const LongFile: Story = {
  args: { filePath: '/storybook/longFile.ts', fileName: 'longFile.ts' },
};

export const OpenAtSpan: Story = {
  args: {
    filePath: '/storybook/longFile.ts',
    fileName: 'longFile.ts',
    range: {
      startLineNumber: 302,
      startColumn: 1,
      endLineNumber: 304,
      endColumn: 2,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opens the long file centered on section61, selecting lines 302–304. Scroll away, then use the header’s Return to span button to jump back. Edit range in Controls to navigate to a different span without reloading. Lines and columns are 1-based; the end is exclusive.',
      },
    },
  },
};

export const Comparison: Story = {
  render: (args) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        height: '100%',
        background: slateNeonTheme.colors.background,
        color: slateNeonTheme.colors.text,
      }}
    >
      {[
        {
          label: 'Pierre · read-only',
          content: <SourceFileTabContent {...args} />,
        },
        {
          label: 'Monaco · read-only',
          content: <StoryFileTab {...args} editable={false} />,
        },
      ].map(({ label, content }) => (
        <section
          key={label}
          aria-label={label}
          style={{
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${slateNeonTheme.colors.border}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              padding: '10px 16px',
              fontFamily: slateNeonTheme.fonts.body,
              fontSize: slateNeonTheme.fontSizes[1],
            }}
          >
            {label}
          </h2>
          <div style={{ flex: 1, minHeight: 0 }}>{content}</div>
        </section>
      ))}
    </div>
  ),
};
