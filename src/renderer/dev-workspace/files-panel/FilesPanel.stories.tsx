import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React, { useMemo } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import {
  PanelEventBus,
  type DataSlice,
  type PanelContextValue,
} from '@principal-ade/panel-framework-core';
import {
  PathsFileTreeBuilder,
  type FileTree as RepoFileTree,
} from '@principal-ai/repository-abstraction';
import { FilesPanel } from './FilesPanel';

const REPO_ROOT = 'mock-repo';

const SAMPLE_PATHS: string[] = [
  `${REPO_ROOT}/package.json`,
  `${REPO_ROOT}/README.md`,
  `${REPO_ROOT}/tsconfig.json`,
  `${REPO_ROOT}/src/index.ts`,
  `${REPO_ROOT}/src/App.tsx`,
  `${REPO_ROOT}/src/components/Button.tsx`,
  `${REPO_ROOT}/src/components/Button.test.tsx`,
  `${REPO_ROOT}/src/components/Modal.tsx`,
  `${REPO_ROOT}/src/components/index.ts`,
  `${REPO_ROOT}/src/hooks/useAuth.ts`,
  `${REPO_ROOT}/src/hooks/useTheme.ts`,
  `${REPO_ROOT}/src/utils/format.ts`,
  `${REPO_ROOT}/src/utils/parse.ts`,
  `${REPO_ROOT}/src/utils/parse.test.ts`,
  `${REPO_ROOT}/src/styles/globals.css`,
  `${REPO_ROOT}/docs/getting-started.md`,
  `${REPO_ROOT}/docs/api/overview.md`,
  `${REPO_ROOT}/docs/api/types.md`,
];

function createMockFileTree(paths: string[] = SAMPLE_PATHS): RepoFileTree {
  const builder = new PathsFileTreeBuilder();
  const built = builder.build({ files: paths, rootPath: REPO_ROOT });
  return {
    ...built,
    metadata: {
      ...built.metadata,
      id: REPO_ROOT,
    },
  };
}

interface MockContext extends PanelContextValue {
  fileTree: DataSlice<RepoFileTree | null>;
}

const FilesPanelHarness: React.FC<{ paths?: string[] }> = ({ paths }) => {
  const events = useMemo(() => new PanelEventBus(), []);
  const fileTree = useMemo(() => (paths === undefined ? createMockFileTree() : paths.length === 0 ? null : createMockFileTree(paths)), [paths]);

  const context = useMemo<MockContext>(
    () => ({
      currentScope: {
        type: 'repository' as const,
        repository: { path: '/mock/mock-repo', name: 'mock-repo' },
      },
      fileTree: {
        scope: 'repository',
        name: 'fileTree',
        data: fileTree,
        loading: false,
        error: null,
        refresh: async () => {},
      },
      refresh: async () => {},
    }),
    [fileTree],
  );

  React.useEffect(() => {
    const unsubscribe = events.on('file:open', (event) => {
      console.info('[FilesPanel story] file:open', event.payload);
    });
    return unsubscribe;
  }, [events]);

  return (
    <div style={{ width: 360, height: '100vh', display: 'flex' }}>
      <FilesPanel context={context} actions={{}} events={events} />
    </div>
  );
};

const meta: Meta<typeof FilesPanelHarness> = {
  title: 'DevWorkspace/FilesPanel',
  component: FilesPanelHarness,
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
type Story = StoryObj<typeof FilesPanelHarness>;

export const Default: Story = {};

export const Empty: Story = {
  args: { paths: [] },
  parameters: {
    docs: {
      description: { story: 'Renders the empty-state when no fileTree slice data is available.' },
    },
  },
};

export const SingleFile: Story = {
  args: { paths: [`${REPO_ROOT}/README.md`] },
};

export const Deep: Story = {
  args: {
    paths: [
      ...SAMPLE_PATHS,
      `${REPO_ROOT}/src/components/forms/inputs/TextField.tsx`,
      `${REPO_ROOT}/src/components/forms/inputs/Select.tsx`,
      `${REPO_ROOT}/src/components/forms/inputs/Checkbox.tsx`,
      `${REPO_ROOT}/src/components/forms/layout/Form.tsx`,
      `${REPO_ROOT}/src/components/forms/layout/FieldGroup.tsx`,
      `${REPO_ROOT}/src/components/forms/validation/rules.ts`,
      `${REPO_ROOT}/src/components/forms/validation/messages.ts`,
    ],
  },
};
