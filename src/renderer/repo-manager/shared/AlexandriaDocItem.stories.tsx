import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import { AlexandriaDocItem } from './AlexandriaDocItem';
import type { AlexandriaDocItemData } from './AlexandriaDocsPanel';

const meta = {
  title: 'Alexandria/AlexandriaDocItem',
  component: AlexandriaDocItem,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ width: '600px', backgroundColor: '#1a1a1a' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  argTypes: {
    doc: {
      description: 'Document data',
      control: { type: 'object' },
    },
    isSelected: {
      description: 'Whether the document is selected',
      control: { type: 'boolean' },
    },
    onSelect: {
      description: 'Callback when document is selected',
      action: 'selected',
    },
    formatRelativeTime: {
      description: 'Function to format relative time',
    },
    trackedFiles: {
      description: 'Array of files in the CodebaseView (for tracked documents)',
      control: { type: 'object' },
    },
  },
} satisfies Meta<typeof AlexandriaDocItem>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper function to format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

// Sample files for CodebaseView
const sampleCodebaseFiles = [
  'src/components/Button.tsx',
  'src/components/Input.tsx',
  'src/components/Modal.tsx',
  'src/utils/validation.ts',
  'src/utils/formatDate.ts',
  'src/hooks/useAuth.ts',
  'src/hooks/useData.ts',
  'src/services/api.ts',
  'src/services/auth.ts',
  'src/types/user.ts',
  'src/types/data.ts',
];

const architectureFiles = [
  'src/main/index.ts',
  'src/main/app.ts',
  'src/renderer/App.tsx',
  'src/renderer/index.tsx',
  'src/shared/types.ts',
  'src/shared/constants.ts',
];

// Sample documents
const trackedDoc: AlexandriaDocItemData = {
  path: '/Users/dev/project/docs/architecture.md',
  name: 'Architecture Overview',
  relativePath: 'docs/architecture.md',
  isTracked: true,
  mtime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
};

const untrackedDoc: AlexandriaDocItemData = {
  path: '/Users/dev/project/README.md',
  name: 'README',
  relativePath: 'README.md',
  isTracked: false,
  mtime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
};

const recentDoc: AlexandriaDocItemData = {
  path: '/Users/dev/project/docs/getting-started.md',
  name: 'Getting Started',
  relativePath: 'docs/getting-started.md',
  isTracked: true,
  mtime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
};

const oldDoc: AlexandriaDocItemData = {
  path: '/Users/dev/project/docs/changelog.md',
  name: 'Changelog',
  relativePath: 'docs/changelog.md',
  isTracked: false,
  mtime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
};

/**
 * Default tracked document with file tree
 */
export const TrackedDocument: Story = {
  args: {
    doc: trackedDoc,
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
    trackedFiles: architectureFiles,
  },
};

/**
 * Untracked document
 */
export const UntrackedDocument: Story = {
  args: {
    doc: untrackedDoc,
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
  },
};

/**
 * Selected document state
 */
export const Selected: Story = {
  args: {
    doc: trackedDoc,
    isSelected: true,
    onSelect: () => {},
    formatRelativeTime,
  },
};

/**
 * Recently edited document with files
 */
export const RecentlyEdited: Story = {
  args: {
    doc: recentDoc,
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
    trackedFiles: sampleCodebaseFiles,
  },
};

/**
 * Old document
 */
export const OldDocument: Story = {
  args: {
    doc: oldDoc,
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
  },
};

/**
 * Expandable file tree demonstration
 */
export const ExpandableFileTree: Story = {
  args: {
    doc: {
      path: '/Users/dev/project/docs/components.md',
      name: 'Components Documentation',
      relativePath: 'docs/components.md',
      isTracked: true,
      mtime: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
    trackedFiles: sampleCodebaseFiles,
  },
  render: (args) => (
    <div>
      <div
        style={{
          padding: '12px',
          backgroundColor: '#2a2a2a',
          borderBottom: '1px solid #444',
          color: '#fff',
          fontSize: '14px',
          marginBottom: '0px',
        }}
      >
        Click the <strong style={{ color: '#10b981' }}>tracked</strong> label to
        expand/collapse the file tree
      </div>
      <AlexandriaDocItem {...args} />
    </div>
  ),
};

/**
 * Interactive list of documents
 */
export const InteractiveList: Story = {
  args: {
    doc: trackedDoc,
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
  },
  render: () => {
    const [selectedPath, setSelectedPath] = useState<string | undefined>();

    const docs = [trackedDoc, untrackedDoc, recentDoc, oldDoc];

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {docs.map((doc) => (
          <AlexandriaDocItem
            key={doc.path}
            doc={doc}
            isSelected={selectedPath === doc.path}
            onSelect={(path) => setSelectedPath(path)}
            formatRelativeTime={formatRelativeTime}
          />
        ))}
      </div>
    );
  },
};

/**
 * Long document name
 */
export const LongName: Story = {
  args: {
    doc: {
      path: '/Users/dev/project/docs/very-long-document-name-that-might-overflow.md',
      name: 'Very Long Document Name That Might Overflow and Need Truncation',
      relativePath: 'docs/very-long-document-name-that-might-overflow.md',
      isTracked: true,
      mtime: new Date(),
    },
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
  },
};

/**
 * Document with nested path
 */
export const NestedPath: Story = {
  args: {
    doc: {
      path: '/Users/dev/project/docs/guides/advanced/deployment.md',
      name: 'Deployment Guide',
      relativePath: 'docs/guides/advanced/deployment.md',
      isTracked: true,
      mtime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    },
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
  },
};

/**
 * Mixed tracked and untracked
 */
export const MixedList: Story = {
  args: {
    doc: trackedDoc,
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
  },
  render: () => {
    const [selectedPath, setSelectedPath] = useState<string | undefined>(
      trackedDoc.path,
    );

    const mixedDocs: Array<{
      doc: AlexandriaDocItemData;
      files?: string[];
    }> = [
      {
        doc: {
          path: '/project/API.md',
          name: 'API Reference',
          relativePath: 'API.md',
          isTracked: true,
          mtime: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
        files: ['src/api/endpoints.ts', 'src/api/client.ts', 'src/api/types.ts'],
      },
      {
        doc: {
          path: '/project/CONTRIBUTING.md',
          name: 'Contributing Guidelines',
          relativePath: 'CONTRIBUTING.md',
          isTracked: false,
          mtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      },
      {
        doc: {
          path: '/project/docs/tutorial.md',
          name: 'Tutorial',
          relativePath: 'docs/tutorial.md',
          isTracked: true,
          mtime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
        files: sampleCodebaseFiles,
      },
      {
        doc: {
          path: '/project/LICENSE.md',
          name: 'License',
          relativePath: 'LICENSE.md',
          isTracked: false,
          mtime: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        },
      },
      {
        doc: {
          path: '/project/docs/faq.md',
          name: 'FAQ',
          relativePath: 'docs/faq.md',
          isTracked: true,
          mtime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        files: architectureFiles,
      },
    ];

    return (
      <div>
        <div
          style={{
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderBottom: '1px solid #444',
            color: '#fff',
            fontSize: '14px',
            marginBottom: '0px',
          }}
        >
          Selected: <strong>{selectedPath || 'None'}</strong>
          <br />
          <span style={{ fontSize: '12px', opacity: 0.7 }}>
            Click tracked labels to expand file trees
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {mixedDocs.map(({ doc, files }) => (
            <AlexandriaDocItem
              key={doc.path}
              doc={doc}
              isSelected={selectedPath === doc.path}
              onSelect={(path) => setSelectedPath(path)}
              formatRelativeTime={formatRelativeTime}
              trackedFiles={files}
            />
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Hover states demonstration
 */
export const HoverStates: Story = {
  args: {
    doc: trackedDoc,
    isSelected: false,
    onSelect: () => {},
    formatRelativeTime,
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div
          style={{
            padding: '8px',
            backgroundColor: '#2a2a2a',
            marginBottom: '4px',
            fontSize: '12px',
            color: '#888',
          }}
        >
          Normal state (hover to see effect)
        </div>
        <AlexandriaDocItem
          doc={trackedDoc}
          isSelected={false}
          onSelect={() => {}}
          formatRelativeTime={formatRelativeTime}
        />
      </div>
      <div>
        <div
          style={{
            padding: '8px',
            backgroundColor: '#2a2a2a',
            marginBottom: '4px',
            fontSize: '12px',
            color: '#888',
          }}
        >
          Selected state
        </div>
        <AlexandriaDocItem
          doc={trackedDoc}
          isSelected={true}
          onSelect={() => {}}
          formatRelativeTime={formatRelativeTime}
        />
      </div>
    </div>
  ),
};
