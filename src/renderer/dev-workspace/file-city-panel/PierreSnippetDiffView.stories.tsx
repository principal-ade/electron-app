import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, useTheme } from '@principal-ade/industry-theme';

import {
  PierreSnippetDiffView,
  type PierreSnippetDiffStyle,
} from './PierreSnippetDiffView';

const OLD_LOGIN = `import { useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);

  function login(email, password) {
    return fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((res) => res.json());
  }

  return { user, login };
}
`;

const NEW_LOGIN = `import { useCallback, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('login failed');
    const next = (await res.json()) as User;
    setUser(next);
    return next;
  }, []);

  return { user, login };
}

export interface User {
  id: string;
  email: string;
}
`;

const OLD_FORMAT = `export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}
`;

const NEW_FORMAT = `export function formatBytes(bytes: number): string {
  if (bytes < 1024) return \`\${bytes} B\`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return \`\${value.toFixed(1)} \${units[i]}\`;
}
`;

interface HarnessProps {
  fileName: string;
  oldContents: string;
  newContents: string;
  startLine?: number;
  endLine?: number;
  focusLine?: number;
  contextLines?: number;
  diffStyle?: PierreSnippetDiffStyle;
  /** When true, override Pierre's container background to the theme background. */
  themedBackground?: boolean;
  /** Page surface so background overrides are visible. */
  surface?: string;
}

const Harness: React.FC<HarnessProps> = ({
  fileName,
  oldContents,
  newContents,
  startLine,
  endLine,
  focusLine,
  contextLines,
  diffStyle,
  themedBackground = true,
  surface,
}) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: surface ?? theme.colors.background,
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <PierreSnippetDiffView
        fileName={fileName}
        oldContents={oldContents}
        newContents={newContents}
        startLine={startLine}
        endLine={endLine}
        focusLine={focusLine}
        contextLines={contextLines}
        diffStyle={diffStyle}
        background={themedBackground ? theme.colors.background : undefined}
      />
    </div>
  );
};

const meta: Meta<typeof Harness> = {
  title: 'DevWorkspace/FileCityPanel/PierreSnippetDiffView',
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

export const FullDiffUnified: Story = {
  args: {
    fileName: 'useAuth.ts',
    oldContents: OLD_LOGIN,
    newContents: NEW_LOGIN,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Whole-file diff in unified mode — caller passes both versions, no window applied.',
      },
    },
  },
};

export const FullDiffSplit: Story = {
  args: {
    fileName: 'useAuth.ts',
    oldContents: OLD_LOGIN,
    newContents: NEW_LOGIN,
    diffStyle: 'split',
  },
  parameters: {
    docs: {
      description: {
        story: 'Same change rendered side-by-side via `diffStyle: "split"`.',
      },
    },
  },
};

export const WindowedSnippet: Story = {
  args: {
    fileName: 'useAuth.ts',
    oldContents: OLD_LOGIN,
    newContents: NEW_LOGIN,
    startLine: 6,
    endLine: 14,
    focusLine: 11,
    contextLines: 2,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Same diff scoped to lines 6–14 (with 2 lines of context on each side) and the focus line highlighted via `selectedLines`.',
      },
    },
  },
};

export const WithFocusLine: Story = {
  args: {
    fileName: 'format.ts',
    oldContents: OLD_FORMAT,
    newContents: NEW_FORMAT,
    focusLine: 9,
  },
  parameters: {
    docs: {
      description: {
        story:
          '`focusLine` works without a window — Pierre highlights line 9 of the rendered diff.',
      },
    },
  },
};

export const PierreDefaultBackground: Story = {
  args: {
    fileName: 'useAuth.ts',
    oldContents: OLD_LOGIN,
    newContents: NEW_LOGIN,
    themedBackground: false,
    surface:
      'linear-gradient(135deg, #082f49 0%, #134e4a 50%, #1e1b4b 100%)',
  },
  parameters: {
    docs: {
      description: {
        story:
          'No `background` prop — Pierre paints with its own diff surface, visible against a contrasting page surface.',
      },
    },
  },
};

export const NoChange: Story = {
  args: {
    fileName: 'useAuth.ts',
    oldContents: NEW_LOGIN,
    newContents: NEW_LOGIN,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When old and new are identical, Pierre renders the file as a context-only diff (no addition/deletion hunks).',
      },
    },
  },
};
