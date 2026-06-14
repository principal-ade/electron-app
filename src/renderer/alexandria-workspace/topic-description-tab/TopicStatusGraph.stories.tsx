import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import {
  ThemeProvider,
  slateNeonTheme,
  useTheme,
} from '@principal-ade/industry-theme';
import { TopicStatusGraph } from './TopicStatusGraph';
import { STATES, type TopicStatusState } from './topicStatusModel';

/**
 * Interactive harness: clicking a node updates the selected state, so the
 * highlight + arrows can be eyeballed in isolation before wiring the graph
 * into the workspace info modal.
 */
const Harness: React.FC<{ initial: TopicStatusState }> = ({ initial }) => {
  const { theme } = useTheme();
  const [value, setValue] = React.useState<TopicStatusState>(initial);
  return (
    <div style={{ width: 460, padding: 16, background: theme.colors.background }}>
      <TopicStatusGraph value={value} onSelect={setValue} theme={theme} />
      <div
        style={{
          marginTop: 12,
          fontFamily: theme.fonts.body,
          fontSize: 12,
          color: theme.colors.textSecondary,
        }}
      >
        Selected: <strong>{value}</strong> ·{' '}
        {STATES.find((s) => s.value === value)?.label}
      </div>
    </div>
  );
};

const meta: Meta<typeof Harness> = {
  title: 'Workspace/TopicStatusGraph',
  component: Harness,
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Harness>;

export const Working: Story = { args: { initial: 'working' } };
export const NewThought: Story = { args: { initial: 'new-thought' } };
export const Waiting: Story = { args: { initial: 'waiting' } };
export const DoneForNow: Story = { args: { initial: 'done-for-now' } };
export const Deprecated: Story = { args: { initial: 'deprecated' } };
export const Abandoned: Story = { args: { initial: 'abandoned' } };
