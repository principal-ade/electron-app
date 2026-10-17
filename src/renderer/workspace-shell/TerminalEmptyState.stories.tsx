import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme, useTheme } from '@principal-ade/industry-theme';
import {
  DEFAULT_TERMINAL_EMPTY_STATE_TIPS,
  TerminalEmptyState,
  type TerminalEmptyStateProps,
  type TerminalEmptyStateTip,
} from './TerminalEmptyState';

/**
 * The empty state the principal window's tabbed terminal shows when no tabs are
 * open. It shows a rotating set of tips (mostly keyboard shortcuts) that
 * cross-fade in and out.
 *
 * Each tip's keycaps light up in the primary color while the matching keys are
 * physically held — press ⌘⇧E (or the keys of whichever tip is showing) while
 * a story is focused to see it.
 *
 * Stories use a `fast` cadence so the fade is easy to eyeball; production uses
 * the 4.5s / 450ms defaults.
 */
const meta: Meta<typeof TerminalEmptyState> = {
  title: 'Workspace/TerminalEmptyState',
  component: TerminalEmptyState,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <PanelFrame>
          <Story />
        </PanelFrame>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Mimics the terminal panel surface so the empty state sits in context. */
const PanelFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {children}
    </div>
  );
};

const FAST: Partial<TerminalEmptyStateProps> = {
  intervalMs: 1500,
  fadeMs: 300,
};

/** The default experience, sped up so the rotation is visible. */
export const Default: Story = {
  args: FAST,
};

/** Production cadence: each tip lingers for 4.5s and fades over 450ms. */
export const ProductionTiming: Story = {};

/** Frozen on a single tip — useful when the panel is hidden or for a11y. */
export const Paused: Story = {
  args: { ...FAST, paused: true },
};

/** Larger, product-flavoured tips. Some carry no keycaps. */
const productTips: TerminalEmptyStateTip[] = [
  { keys: ['⌘', 'T'], label: 'Spin up another terminal' },
  { label: 'Drag a tab between windows to move a session' },
  { keys: ['⌘', '⇧', 'P'], label: 'Open the command palette' },
  { label: 'Drop a file onto the terminal to paste its path' },
];

export const CustomTips: Story = {
  args: { ...FAST, tips: productTips },
};

/** A non-shortcut tip alone in the rotation, with no keycaps. */
export const SinglePlainTip: Story = {
  args: {
    tips: [{ label: 'Drop a file onto the terminal to paste its path' }],
  },
};

/** No tips at all — just the logo. */
export const NoTips: Story = {
  args: { tips: [] },
};

/** The rotation without the progress dots. */
export const NoProgressDots: Story = {
  args: { ...FAST, showProgressDots: false },
};

/** Custom copy — the heading and subtitle are opt-in. */
export const CustomCopy: Story = {
  render: (args) => {
    return (
      <TerminalEmptyState
        {...args}
        heading="Ready when you are"
        subtitle="Terminal sessions appear as tabs up here."
      />
    );
  },
  args: FAST,
};

/** Reduced-motion users get a static first tip and no cross-fade. */
export const ReducedMotion: Story = {
  args: { ...FAST },
  parameters: {
    docs: {
      description: {
        story:
          'When the OS reports `prefers-reduced-motion: reduce`, the component skips the fade and holds the first tip. Toggle the OS setting to see it.',
      },
    },
  },
};

/** Sanity check that the exported defaults render without overrides. */
export const DefaultTipsFixture: Story = {
  args: {
    tips: DEFAULT_TERMINAL_EMPTY_STATE_TIPS,
  },
};
