import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { CodebaseViewFileTree } from './CodebaseViewFileTree';

const meta = {
  title: 'Alexandria/CodebaseViewFileTree',
  component: CodebaseViewFileTree,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ height: '600px', width: '400px' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  argTypes: {
    files: {
      description: 'Array of file paths to display in the tree',
      control: { type: 'object' },
    },
    onFileSelect: {
      description: 'Callback when a file is selected',
      action: 'fileSelected',
    },
    selectedFile: {
      description: 'Currently selected file path',
      control: { type: 'text' },
    },
    defaultOpen: {
      description: 'Whether folders should be open by default',
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof CodebaseViewFileTree>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample file paths for a typical project
const sampleFiles = [
  'src/index.ts',
  'src/components/Button.tsx',
  'src/components/Input.tsx',
  'src/components/Modal.tsx',
  'src/utils/formatDate.ts',
  'src/utils/validation.ts',
  'src/hooks/useAuth.ts',
  'src/hooks/useData.ts',
  'src/services/api.ts',
  'src/services/auth.ts',
  'README.md',
  'package.json',
  'tsconfig.json',
];

// Larger example with nested structure
const complexFiles = [
  'src/main/index.ts',
  'src/main/app.ts',
  'src/main/ipc/handlers.ts',
  'src/main/ipc/events.ts',
  'src/main/services/database.ts',
  'src/main/services/cache.ts',
  'src/main/utils/logger.ts',
  'src/renderer/index.tsx',
  'src/renderer/App.tsx',
  'src/renderer/components/layout/Header.tsx',
  'src/renderer/components/layout/Sidebar.tsx',
  'src/renderer/components/layout/Footer.tsx',
  'src/renderer/components/ui/Button.tsx',
  'src/renderer/components/ui/Input.tsx',
  'src/renderer/components/ui/Modal.tsx',
  'src/renderer/components/ui/Card.tsx',
  'src/renderer/hooks/useTheme.ts',
  'src/renderer/hooks/useAuth.ts',
  'src/renderer/hooks/useData.ts',
  'src/renderer/services/api.ts',
  'src/renderer/styles/globals.css',
  'src/renderer/styles/theme.css',
  'src/shared/types/user.ts',
  'src/shared/types/data.ts',
  'src/shared/constants.ts',
  'src/shared/utils/validation.ts',
  'tests/unit/services.test.ts',
  'tests/unit/utils.test.ts',
  'tests/integration/api.test.ts',
  'docs/README.md',
  'docs/architecture.md',
  'docs/api.md',
  '.gitignore',
  '.eslintrc.json',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
];

// CodebaseView reference group example
const codebaseViewFiles = [
  'src/renderer/components/AlexandriaDocsPanel.tsx',
  'src/renderer/components/AlexandriaDocItem.tsx',
  'src/renderer/main-process-api/AlexandriaService.ts',
  'src/renderer/main-process-api/AlexandriaDocsService.ts',
  'src/main/stores/AlexandriaRegistryService.ts',
  'src/main/stores/AlexandriaApiEventHandler.ts',
  'src/shared/main-process-api-interfaces/AlexandriaAPI.ts',
  'src/shared/main-process-api-interfaces/AlexandriaDocsAPI.ts',
  'src/shared/types/alexandria.types.ts',
];

/**
 * Default file tree with sample files
 */
export const Default: Story = {
  args: {
    files: sampleFiles,
  },
};

/**
 * Empty state with no files
 */
export const Empty: Story = {
  args: {
    files: [],
  },
};

/**
 * Single file
 */
export const SingleFile: Story = {
  args: {
    files: ['README.md'],
  },
};

/**
 * Flat file list (no folders)
 */
export const FlatFiles: Story = {
  args: {
    files: [
      'index.ts',
      'app.ts',
      'utils.ts',
      'config.ts',
      'constants.ts',
    ],
  },
};

/**
 * Complex nested structure
 */
export const ComplexStructure: Story = {
  args: {
    files: complexFiles,
  },
};

/**
 * CodebaseView reference group files
 */
export const CodebaseViewReferenceGroup: Story = {
  args: {
    files: codebaseViewFiles,
  },
};

/**
 * Interactive with file selection
 */
export const Interactive: Story = {
  args: {
    files: sampleFiles,
  },
  render: () => {
    const [selectedFile, setSelectedFile] = useState<string | undefined>(
      undefined,
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderBottom: '1px solid #444',
            color: '#fff',
            fontSize: '14px',
          }}
        >
          Selected:{' '}
          <strong>{selectedFile || 'None'}</strong>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <CodebaseViewFileTree
            files={sampleFiles}
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
          />
        </div>
      </div>
    );
  },
};

/**
 * With pre-selected file
 */
export const WithSelection: Story = {
  args: {
    files: sampleFiles,
    selectedFile: 'src/components/Button.tsx',
  },
};

/**
 * Deep nesting example
 */
export const DeepNesting: Story = {
  args: {
    files: [
      'a/b/c/d/e/f/deep-file.ts',
      'a/b/c/another.ts',
      'a/b/file.ts',
      'a/top.ts',
      'root.ts',
    ],
  },
};

/**
 * Many files in single folder
 */
export const ManyFilesInFolder: Story = {
  args: {
    files: [
      'components/Component01.tsx',
      'components/Component02.tsx',
      'components/Component03.tsx',
      'components/Component04.tsx',
      'components/Component05.tsx',
      'components/Component06.tsx',
      'components/Component07.tsx',
      'components/Component08.tsx',
      'components/Component09.tsx',
      'components/Component10.tsx',
      'components/Component11.tsx',
      'components/Component12.tsx',
      'components/Component13.tsx',
      'components/Component14.tsx',
      'components/Component15.tsx',
      'utils/util01.ts',
      'utils/util02.ts',
      'utils/util03.ts',
    ],
  },
};

/**
 * Mixed file types
 */
export const MixedFileTypes: Story = {
  args: {
    files: [
      'src/index.ts',
      'src/App.tsx',
      'src/styles/main.css',
      'src/styles/theme.scss',
      'public/index.html',
      'public/favicon.ico',
      'public/robots.txt',
      '.env',
      '.env.example',
      '.gitignore',
      '.prettierrc',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'vite.config.ts',
      'README.md',
      'LICENSE',
      'CONTRIBUTING.md',
    ],
  },
};

/**
 * Side by side comparison
 */
export const SideBySide: Story = {
  args: {
    files: sampleFiles,
  },
  render: () => {
    const [selectedLeft, setSelectedLeft] = useState<string | undefined>();
    const [selectedRight, setSelectedRight] = useState<string | undefined>();

    return (
      <div style={{ display: 'flex', height: '600px', gap: '2px' }}>
        <div style={{ flex: 1, border: '1px solid #444' }}>
          <div
            style={{
              padding: '8px',
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            Reference Group A
          </div>
          <CodebaseViewFileTree
            files={sampleFiles}
            onFileSelect={setSelectedLeft}
            selectedFile={selectedLeft}
          />
        </div>
        <div style={{ flex: 1, border: '1px solid #444' }}>
          <div
            style={{
              padding: '8px',
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            Reference Group B
          </div>
          <CodebaseViewFileTree
            files={codebaseViewFiles}
            onFileSelect={setSelectedRight}
            selectedFile={selectedRight}
          />
        </div>
      </div>
    );
  },
};

/**
 * Small size variant
 */
export const SmallSize: Story = {
  args: {
    files: [
      'index.ts',
      'app.ts',
      'components/Button.tsx',
      'components/Input.tsx',
      'utils/helpers.ts',
    ],
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ height: '300px', width: '250px', border: '1px solid #444' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

/**
 * Large scrollable tree
 */
export const LargeScrollable: Story = {
  args: {
    files: [
      ...complexFiles,
      'additional/folder1/file1.ts',
      'additional/folder1/file2.ts',
      'additional/folder1/file3.ts',
      'additional/folder2/file1.ts',
      'additional/folder2/file2.ts',
      'additional/folder3/subfolder/file1.ts',
      'additional/folder3/subfolder/file2.ts',
      'additional/folder3/subfolder/deep/file.ts',
      'more/files/here/test1.ts',
      'more/files/here/test2.ts',
      'more/files/there/test3.ts',
      'even/more/nesting/levels/file.ts',
    ],
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ height: '400px', width: '350px', border: '1px solid #444' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};
