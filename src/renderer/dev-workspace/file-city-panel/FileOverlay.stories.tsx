import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';

import { FileOverlay } from './FileOverlay';

type ReadFileResult = { content: string; filePath: string } | null;
type ReadFileOverride =
  | { kind: 'content'; content: string }
  | { kind: 'missing' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

declare global {
  interface Window {
    __FILE_OVERLAY_STORY__?: ReadFileOverride;
  }
}

if (typeof window !== 'undefined' && window.mainProcess?.fileSystem) {
  const fs = window.mainProcess.fileSystem;
  const original = fs.readFile.bind(fs);
  fs.readFile = (filePath: string): Promise<ReadFileResult> => {
    const override = window.__FILE_OVERLAY_STORY__;
    if (!override) return original(filePath);
    switch (override.kind) {
      case 'pending':
        return new Promise<ReadFileResult>(() => {});
      case 'missing':
        return Promise.resolve(null);
      case 'error':
        return Promise.reject(new Error(override.message));
      case 'content':
        return Promise.resolve({ content: override.content, filePath });
    }
  };
}

const SAMPLE_TS = `import { useEffect, useState } from 'react';

export interface CounterProps {
  initial?: number;
  step?: number;
}

export function Counter({ initial = 0, step = 1 }: CounterProps) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);

  return (
    <button onClick={() => setCount((c) => c + step)}>
      count is {count}
    </button>
  );
}
`;

const CityBackdrop: React.FC = () => {
  const { theme } = useTheme();
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 30% 40%, ${theme.colors.primary}33 0%, transparent 40%),
          radial-gradient(circle at 70% 60%, ${theme.colors.accent ?? theme.colors.primary}22 0%, transparent 45%),
          ${theme.colors.background}
        `,
        display: 'grid',
        placeItems: 'center',
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
      }}
    >
      <span style={{ opacity: 0.5 }}>(file-city canvas would render here)</span>
    </div>
  );
};

interface HarnessProps {
  filePath: string;
  fileName: string;
  override: ReadFileOverride;
  withOpenInTab?: boolean;
}

const Harness: React.FC<HarnessProps> = ({
  filePath,
  fileName,
  override,
  withOpenInTab = true,
}) => {
  window.__FILE_OVERLAY_STORY__ = override;
  React.useEffect(
    () => () => {
      if (window.__FILE_OVERLAY_STORY__ === override) {
        delete window.__FILE_OVERLAY_STORY__;
      }
    },
    [override],
  );

  const [open, setOpen] = React.useState(true);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <CityBackdrop />
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Reopen overlay
        </button>
      )}
      {open && (
        <FileOverlay
          filePath={filePath}
          fileName={fileName}
          onClose={() => setOpen(false)}
          onOpenInTab={
            withOpenInTab
              ? () => console.info('[FileOverlay story] open-in-tab', filePath)
              : undefined
          }
        />
      )}
    </div>
  );
};

const meta: Meta<typeof Harness> = {
  title: 'DevWorkspace/FileCityPanel/FileOverlay',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Default: Story = {
  args: {
    filePath: '/mock/repo/src/Counter.tsx',
    fileName: 'Counter.tsx',
    override: { kind: 'content', content: SAMPLE_TS },
  },
};

export const LongPath: Story = {
  args: {
    filePath:
      '/mock/repo/packages/very-long-package-name/src/components/forms/inputs/text-field/internals/TextFieldInternalImplementation.tsx',
    fileName: 'TextFieldInternalImplementation.tsx',
    override: { kind: 'content', content: SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Header truncates the filename with ellipsis; full path is in the title attribute.',
      },
    },
  },
};

export const WithoutOpenInTab: Story = {
  args: {
    filePath: '/mock/repo/src/Counter.tsx',
    fileName: 'Counter.tsx',
    withOpenInTab: false,
    override: { kind: 'content', content: SAMPLE_TS },
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `onOpenInTab` is omitted, only the close button is shown in the header.',
      },
    },
  },
};

export const Loading: Story = {
  args: {
    filePath: '/mock/repo/src/never-resolves.ts',
    fileName: 'never-resolves.ts',
    override: { kind: 'pending' },
  },
};

export const NotFound: Story = {
  args: {
    filePath: '/mock/repo/missing.ts',
    fileName: 'missing.ts',
    override: { kind: 'missing' },
  },
};

export const ReadError: Story = {
  args: {
    filePath: '/mock/repo/protected.ts',
    fileName: 'protected.ts',
    override: { kind: 'error', message: 'EACCES: permission denied' },
  },
};
