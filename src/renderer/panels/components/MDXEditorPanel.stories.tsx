import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '@a24z/industry-theme';
import { MDXEditorPanel } from './MDXEditorPanel';
import { RepositoryPanelProvider } from '../RepositoryPanelProvider';

// Mock data for Storybook
const mockRepositoryData = {
  repository: null,
  gitStatus: null,
  markdownFiles: [],
  fileTree: null,
  packages: null,
  qualityMetrics: null,
};

const meta = {
  title: 'Components/MDXEditorPanel',
  component: MDXEditorPanel,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <RepositoryPanelProvider
          repositoryPath="/mock/repository/path"
          initialData={mockRepositoryData}
          actions={{}}
        >
          <Story />
        </RepositoryPanelProvider>
      </ThemeProvider>
    ),
  ],
  argTypes: {
    filePath: {
      description: 'Path to the markdown file to edit',
      control: { type: 'text' },
    },
    initialContent: {
      description: 'Initial markdown content',
      control: { type: 'text' },
    },
    onSave: {
      action: 'save',
      description: 'Callback when content is saved',
    },
    readOnly: {
      description: 'Whether the editor is read-only',
      control: { type: 'boolean' },
    },
    variant: {
      description: 'Display variant',
      control: { type: 'select' },
      options: ['panel', 'tab'],
    },
  },
} satisfies Meta<typeof MDXEditorPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default editor with sample content
 */
export const Default: Story = {
  args: {
    initialContent: `# Welcome to MDXEditor

This is a **rich markdown editor** with support for:

- Lists
- Code blocks
- Tables
- Images
- Links
- And more!

## Features

### Syntax Highlighting

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

### Tables

| Feature | Supported |
|---------|-----------|
| Bold | ✅ |
| Italic | ✅ |
| Code | ✅ |
| Links | ✅ |

### Links and Images

Check out [MDX documentation](https://mdxjs.com/) for more information.

> **Note:** This editor supports full MDX syntax!
`,
    onSave: (content) => console.log('Content saved:', content),
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Editor with file path
 */
export const WithFilePath: Story = {
  args: {
    filePath: 'docs/README.md',
    initialContent: `# Project Documentation

## Getting Started

1. Install dependencies
2. Run the development server
3. Start coding!

## API Reference

### \`createUser(data)\`

Creates a new user in the system.

**Parameters:**
- \`data\` (Object): User data object

**Returns:**
- Promise<User>: The created user object
`,
    onSave: (content) => console.log('File saved:', content),
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Empty editor state
 */
export const EmptyState: Story = {
  args: {
    filePath: null,
    initialContent: undefined,
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Read-only mode
 */
export const ReadOnly: Story = {
  args: {
    filePath: 'docs/CHANGELOG.md',
    initialContent: `# Changelog

## Version 2.0.0 - 2024-01-15

### Breaking Changes
- Removed deprecated API endpoints
- Updated minimum Node.js version to 18

### New Features
- Added dark mode support
- Implemented real-time collaboration
- New plugin system

### Bug Fixes
- Fixed memory leak in editor
- Resolved authentication issues
- Improved performance on large files

---

## Version 1.5.0 - 2023-12-01

### Features
- Initial public release
- Basic markdown editing
- Syntax highlighting
- Export to PDF`,
    readOnly: true,
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Tab variant without header
 */
export const TabVariant: Story = {
  args: {
    variant: 'tab',
    filePath: 'src/components/README.md',
    initialContent: `# Component Library

Our component library provides reusable UI components.

## Available Components

- Button
- Input
- Modal
- Card
- List
- Table

Each component is fully typed and documented.`,
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Editor with complex MDX content
 */
export const ComplexMDXContent: Story = {
  args: {
    filePath: 'docs/advanced.mdx',
    initialContent: `---
title: Advanced MDX Features
author: John Doe
date: 2024-01-15
tags: [mdx, documentation, advanced]
---

# Advanced MDX Features

MDX allows you to use JSX in your markdown content.

## Code Examples

### JavaScript Function

\`\`\`javascript
const fibonacci = (n) => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
};

console.log(fibonacci(10)); // 55
\`\`\`

### React Component

\`\`\`typescript
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  variant = 'primary'
}) => {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
\`\`\`

## Mathematical Expressions

The quadratic formula is: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

## Nested Lists

1. First level
   - Second level
     - Third level
       - Fourth level
   - Back to second
2. Another first level
   1. Numbered sub-item
   2. Another numbered sub-item

## Complex Table

| Feature | Basic | Pro | Enterprise |
|---------|-------|-----|------------|
| Users | 10 | 100 | Unlimited |
| Storage | 10GB | 100GB | 1TB |
| Support | Email | Priority | Dedicated |
| API Access | ❌ | ✅ | ✅ |
| Custom Domain | ❌ | ✅ | ✅ |
| Analytics | Basic | Advanced | Custom |
| Price | $0 | $49/mo | Contact |

## Task Lists

- [x] Implement authentication
- [x] Add user dashboard
- [ ] Create API documentation
- [ ] Write tests
  - [x] Unit tests
  - [ ] Integration tests
  - [ ] E2E tests

## Blockquotes

> **Important:** Always backup your data before performing major updates.
>
> This is especially critical when:
> - Upgrading major versions
> - Changing database schemas
> - Migrating to new infrastructure

## Horizontal Rule

---

## Footnotes

This is a statement that needs a citation[^1].

[^1]: This is the footnote with the citation details.
`,
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Editor with interactive save state
 */
export const InteractiveSave: Story = {
  args: {
    filePath: 'docs/draft.md',
    initialContent: `# Draft Document

Start typing to see the save functionality in action...`,
  },
  render: (args) => {
    const [saveCount, setSaveCount] = useState(0);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    const handleSave = (content: string) => {
      setSaveCount((prev) => prev + 1);
      setLastSaved(new Date().toLocaleTimeString());
      console.log('Content saved:', content);
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '600px',
          width: '100%',
        }}
      >
        <div
          style={{
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderBottom: '1px solid #444',
            color: '#fff',
            fontSize: '14px',
          }}
        >
          Save Count: <strong>{saveCount}</strong>
          {lastSaved && (
            <>
              {' '}
              | Last Saved: <strong>{lastSaved}</strong>
            </>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <MDXEditorPanel {...args} onSave={handleSave} />
        </div>
      </div>
    );
  },
};

/**
 * Multiple editors side by side
 */
export const SideBySide: Story = {
  render: () => (
    <div
      style={{ display: 'flex', height: '600px', width: '100%', gap: '2px' }}
    >
      <div style={{ flex: 1 }}>
        <MDXEditorPanel
          filePath="docs/left.md"
          initialContent={`# Left Panel

This is the **left editor**.

\`\`\`javascript
// Left side code
const left = true;
\`\`\``}
          variant="tab"
          onSave={(content) => console.log('Left saved:', content)}
        />
      </div>
      <div style={{ flex: 1 }}>
        <MDXEditorPanel
          filePath="docs/right.md"
          initialContent={`# Right Panel

This is the **right editor**.

\`\`\`javascript
// Right side code
const right = true;
\`\`\``}
          variant="tab"
          onSave={(content) => console.log('Right saved:', content)}
        />
      </div>
    </div>
  ),
};

/**
 * Editor with loading simulation
 */
export const LoadingState: Story = {
  render: () => {
    const [isLoading, setIsLoading] = useState(true);
    const [content, setContent] = useState<string | undefined>(undefined);

    useEffect(() => {
      // Simulate file loading
      const timer = setTimeout(() => {
        setContent(`# Document Loaded

This content was loaded after a simulated delay.

## Async Content

- Data fetched from server
- Processed and ready to edit
- Save functionality enabled`);
        setIsLoading(false);
      }, 2000);

      return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
      return (
        <div
          style={{
            height: '600px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            color: '#fff',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '16px' }}>Loading file...</div>
            <div style={{ fontSize: '12px', opacity: 0.6 }}>Please wait</div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <MDXEditorPanel
          filePath="docs/async-loaded.md"
          initialContent={content}
          onSave={(content) => console.log('Saved:', content)}
        />
      </div>
    );
  },
};

/**
 * Editor with error state (parse error)
 */
export const WithParseError: Story = {
  args: {
    filePath: 'docs/malformed.md',
    initialContent: `# Malformed MDX Content

This content has intentional issues to demonstrate error handling.

<div>
  <span>Unclosed JSX tag
</div>

\`\`\`javascript
// Missing closing backticks
const broken = true;

Regular text after broken code block.`,
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Small editor for constrained spaces
 */
export const SmallSize: Story = {
  args: {
    initialContent: `# Quick Note

Small editor instance for limited space.

- Bullet point 1
- Bullet point 2`,
    variant: 'tab',
  },
  render: (args) => (
    <div style={{ height: '300px', width: '400px', border: '1px solid #444' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Editor with all toolbar features
 */
export const FullToolbar: Story = {
  args: {
    filePath: 'docs/toolbar-demo.md',
    initialContent: `# Toolbar Features Demo

Try out all the toolbar features:

## Text Formatting
- **Bold text** (Ctrl/Cmd + B)
- *Italic text* (Ctrl/Cmd + I)
- \`Inline code\` (Ctrl/Cmd + E)

## Block Types
Use the dropdown to change block types:
- Headings (H1-H6)
- Normal paragraph
- Quote blocks
- Code blocks

## Lists
Create ordered and unordered lists:

1. First item
2. Second item
   - Nested item
   - Another nested

## Links and Images
[Create links](https://example.com) using the link button.

Insert images using the image button.

## Tables
Use the table button to insert tables:

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |

## Source Mode
Toggle between visual and source mode using the source button to edit raw markdown.

---

**Try all the toolbar buttons above!**`,
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <MDXEditorPanel {...args} />
    </div>
  ),
};

/**
 * Dark theme editor (default)
 */
export const DarkTheme: Story = {
  args: {
    initialContent: `# Dark Theme

This editor uses the dark theme by default.

## Code Example

\`\`\`typescript
interface Theme {
  mode: 'light' | 'dark';
  colors: {
    background: string;
    foreground: string;
    primary: string;
  };
}

const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    background: '#1a1a1a',
    foreground: '#ffffff',
    primary: '#007acc',
  },
};
\`\`\`

The dark theme provides:
- Reduced eye strain
- Better contrast
- Modern appearance`,
  },
  render: (args) => (
    <div
      style={{
        height: '600px',
        width: '100%',
        backgroundColor: '#0d0d0d',
        padding: '20px',
      }}
    >
      <MDXEditorPanel {...args} />
    </div>
  ),
};
