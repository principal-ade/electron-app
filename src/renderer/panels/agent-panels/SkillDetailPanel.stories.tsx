/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { SkillDetailPanel } from './SkillDetailPanel';
import {
  MockPanelProvider,
  createMockContext,
  createMockActions,
  createMockEvents,
} from './mocks/panelContext';
import type { DataSlice } from './types';

/**
 * SkillDetailPanel displays detailed information about a selected Agent Skill.
 * It listens for skill:selected events to update the displayed skill.
 */
const meta = {
  title: 'Panels/SkillDetailPanel',
  component: SkillDetailPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A panel for displaying detailed information about a selected Agent Skill. Shows description, capabilities, and full content.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', background: '#f5f5f5' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    context: createMockContext(),
    actions: createMockActions(),
    events: createMockEvents(),
  },
} satisfies Meta<typeof SkillDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Real SKILL.md content from Anthropics skills repo
const ANTHROPIC_SKILLS = {
  pdf: `---
name: pdf
description: Comprehensive PDF manipulation toolkit for extracting text and tables, creating new PDFs, merging/splitting documents, and handling forms. When Claude needs to fill in a PDF form or programmatically process, generate, or analyze PDF documents at scale.
license: Proprietary. LICENSE.txt has complete terms
---

# PDF Processing Guide

## Overview

This guide covers essential PDF processing operations using Python libraries and command-line tools. For advanced features, JavaScript libraries, and detailed examples, see reference.md. If you need to fill out a PDF form, read forms.md and follow its instructions.

## Quick Start

\`\`\`python
from pypdf import PdfReader, PdfWriter

# Read a PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# Extract text
text = ""
for page in reader.pages:
    text += page.extract_text()
\`\`\`

## Python Libraries

### pypdf - Basic Operations

#### Merge PDFs
\`\`\`python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
\`\`\`

## Quick Reference

| Task | Best Tool | Command/Code |
|------|-----------|--------------|
| Merge PDFs | pypdf | \`writer.add_page(page)\` |
| Split PDFs | pypdf | One page per file |
| Extract text | pdfplumber | \`page.extract_text()\` |
| Extract tables | pdfplumber | \`page.extract_tables()\` |
`,
  'mcp-builder': `---
name: mcp-builder
description: Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).
license: Complete terms in LICENSE.txt
---

# MCP Server Development Guide

## Overview

Create MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. The quality of an MCP server is measured by how well it enables LLMs to accomplish real-world tasks.

## 🚀 High-Level Workflow

Creating a high-quality MCP server involves four main phases:

### Phase 1: Deep Research and Planning

#### 1.1 Understand Modern MCP Design

**API Coverage vs. Workflow Tools:**
Balance comprehensive API endpoint coverage with specialized workflow tools. Workflow tools can be more convenient for specific tasks, while comprehensive coverage gives agents flexibility to compose operations.

**Tool Naming and Discoverability:**
Clear, descriptive tool names help agents find the right tools quickly. Use consistent prefixes (e.g., \`github_create_issue\`, \`github_list_repos\`) and action-oriented naming.

#### 1.2 Study MCP Protocol Documentation

Start with the sitemap: \`https://modelcontextprotocol.io/sitemap.xml\`

Key pages to review:
- Specification overview and architecture
- Transport mechanisms (streamable HTTP, stdio)
- Tool, resource, and prompt definitions
`,
  docx: `---
name: docx
description: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. When Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"
license: Proprietary. LICENSE.txt has complete terms
---

# DOCX creation, editing, and analysis

## Overview

A user may ask you to create, edit, or analyze the contents of a .docx file. A .docx file is essentially a ZIP archive containing XML files and other resources that you can read or edit.

## Workflow Decision Tree

### Reading/Analyzing Content
Use "Text extraction" or "Raw XML access" sections below

### Creating New Document
Use "Creating a new Word document" workflow

### Editing Existing Document
- **Your own document + simple changes**: Use "Basic OOXML editing" workflow
- **Someone else's document**: Use **"Redlining workflow"** (recommended default)
- **Legal, academic, business, or government docs**: Use **"Redlining workflow"** (required)

## Reading and analyzing content

### Text extraction
Convert the document to markdown using pandoc:

\`\`\`bash
# Convert document to markdown with tracked changes
pandoc --track-changes=all path-to-file.docx -o output.md
\`\`\`
`,
};

// Create mock file tree using PathsFileTreeBuilder
const builder = new PathsFileTreeBuilder();
const mockFileTreeWithSkills = builder.build({
  files: [
    '.agent/skills/pdf/SKILL.md',
    '.agent/skills/pdf/scripts/extract-text.py',
    '.agent/skills/pdf/scripts/merge-pdfs.py',
    '.agent/skills/pdf/references/pypdf-docs.md',
    '.agent/skills/pdf/references/forms.md',
    '.agent/skills/mcp-builder/SKILL.md',
    '.agent/skills/mcp-builder/references/protocol-spec.md',
    '.agent/skills/mcp-builder/assets/server-template.ts',
    '.agent/skills/docx/SKILL.md',
    '.agent/skills/docx/scripts/extract-text.sh',
    '.agent/skills/docx/references/redlining-guide.md',
    'src/index.ts',
    'README.md',
  ],
  rootPath: '/Users/developer/my-project',
});

// Mock file system adapter that returns real Anthropics skill content
const createMockFileSystemWithSkills = () => {
  const skillContents: Record<string, string> = {
    'pdf/SKILL.md': ANTHROPIC_SKILLS.pdf,
    'mcp-builder/SKILL.md': ANTHROPIC_SKILLS['mcp-builder'],
    'docx/SKILL.md': ANTHROPIC_SKILLS.docx,
  };

  return {
    readFile: async (path: string) => {
      // Extract the skill path from the full path
      const match = path.match(/\.agent\/skills\/([^/]+\/SKILL\.md)$/);
      if (match && skillContents[match[1]]) {
        return skillContents[match[1]];
      }
      throw new Error(`File not found: ${path}`);
    },
  };
};

/**
 * No skill selected - shows empty state
 */
export const NoSelection: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockFileTreeWithSkills,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: createMockFileSystemWithSkills(),
          },
        } as any}
      >
        {(props) => <SkillDetailPanel {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * Skill selected - shows detail view
 */
export const WithSelection: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockFileTreeWithSkills,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    // Create wrapper component to handle event emission
    const SkillDetailWithSelection = (props: any) => {
      React.useEffect(() => {
        // Emit the selection event after component mounts
        const timer = setTimeout(() => {
          props.events.emit({
            type: 'skill:selected',
            source: 'storybook',
            timestamp: Date.now(),
            payload: { skillId: '.agent/skills/pdf/SKILL.md' },
          });
        }, 0);

        return () => clearTimeout(timer);
      }, [props.events]);

      return <SkillDetailPanel {...props} />;
    };

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: createMockFileSystemWithSkills(),
          },
        } as any}
      >
        {(props) => <SkillDetailWithSelection {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: null,
      loading: true,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: {
              readFile: async () => {
                // Simulate slow loading
                await new Promise((resolve) => setTimeout(resolve, 10000));
                return '';
              },
            },
          },
        } as any}
      >
        {(props) => <SkillDetailPanel {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * MCP Builder skill selected
 */
export const MCPBuilderSelected: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockFileTreeWithSkills,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    const SkillDetailWithSelection = (props: any) => {
      React.useEffect(() => {
        const timer = setTimeout(() => {
          props.events.emit({
            type: 'skill:selected',
            source: 'storybook',
            timestamp: Date.now(),
            payload: { skillId: '.agent/skills/mcp-builder/SKILL.md' },
          });
        }, 0);

        return () => clearTimeout(timer);
      }, [props.events]);

      return <SkillDetailPanel {...props} />;
    };

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: createMockFileSystemWithSkills(),
          },
        } as any}
      >
        {(props) => <SkillDetailWithSelection {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * DOCX skill selected
 */
export const DOCXSelected: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockFileTreeWithSkills,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    const SkillDetailWithSelection = (props: any) => {
      React.useEffect(() => {
        const timer = setTimeout(() => {
          props.events.emit({
            type: 'skill:selected',
            source: 'storybook',
            timestamp: Date.now(),
            payload: { skillId: '.agent/skills/docx/SKILL.md' },
          });
        }, 0);

        return () => clearTimeout(timer);
      }, [props.events]);

      return <SkillDetailPanel {...props} />;
    };

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: createMockFileSystemWithSkills(),
          },
        } as any}
      >
        {(props) => <SkillDetailWithSelection {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * No repository loaded
 */
export const NoRepository: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: null,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    return (
      <MockPanelProvider
        contextOverrides={{
          currentScope: {
            type: 'workspace',
            workspace: {
              name: 'my-workspace',
              path: '/Users/developer/my-workspace',
            },
          },
          slices: mockSlices,
        }}
      >
        {(props) => <SkillDetailPanel {...props} />}
      </MockPanelProvider>
    );
  },
};

// Frontmatter validation examples
const INVALID_FRONTMATTER_SKILLS = {
  'missing-name': `---
description: "A skill that is missing the required name field"
---

# Missing Name Skill

This skill demonstrates what happens when the \`name\` field is missing from the frontmatter.

## Features
- This will show a validation warning
- The error message will say "Missing required field: 'name'"
`,
  'missing-description': `---
name: missing-description
---

# Missing Description Skill

This skill demonstrates what happens when the \`description\` field is missing from the frontmatter.

## Features
- This will show a validation warning
- The error message will say "Missing required field: 'description'"
`,
  'missing-both': `---
author: John Doe
version: 1.0.0
---

# Missing Both Fields

This skill demonstrates what happens when both \`name\` and \`description\` fields are missing.

## Features
- This will show a validation warning
- The error message will say "Missing required fields: 'name', 'description'"
`,
  'no-frontmatter': `# No Frontmatter Skill

This skill demonstrates what happens when there is no frontmatter at all.

## Features
- This will show a validation warning
- The error message will say "Missing YAML frontmatter (must start with ---)"

## Usage
This is just regular markdown content without any frontmatter metadata.
`,
};

// Mock file tree with invalid frontmatter skills
const builderWithInvalid = new PathsFileTreeBuilder();
const mockFileTreeWithInvalidSkills = builderWithInvalid.build({
  files: [
    '.agent/skills/missing-name/SKILL.md',
    '.agent/skills/missing-description/SKILL.md',
    '.agent/skills/missing-both/SKILL.md',
    '.agent/skills/no-frontmatter/SKILL.md',
    'src/index.ts',
  ],
  rootPath: '/Users/developer/my-project',
});

// Mock file system for invalid frontmatter examples
const createMockFileSystemWithInvalidSkills = () => {
  const skillContents: Record<string, string> = {
    'missing-name/SKILL.md': INVALID_FRONTMATTER_SKILLS['missing-name'],
    'missing-description/SKILL.md': INVALID_FRONTMATTER_SKILLS['missing-description'],
    'missing-both/SKILL.md': INVALID_FRONTMATTER_SKILLS['missing-both'],
    'no-frontmatter/SKILL.md': INVALID_FRONTMATTER_SKILLS['no-frontmatter'],
  };

  return {
    readFile: async (path: string) => {
      const match = path.match(/\.agent\/skills\/([^/]+\/SKILL\.md)$/);
      if (match && skillContents[match[1]]) {
        return skillContents[match[1]];
      }
      throw new Error(`File not found: ${path}`);
    },
  };
};

/**
 * Skill with missing name field
 */
export const MissingNameField: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockFileTreeWithInvalidSkills,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    const SkillDetailWithSelection = (props: any) => {
      React.useEffect(() => {
        const timer = setTimeout(() => {
          props.events.emit({
            type: 'skill:selected',
            source: 'storybook',
            timestamp: Date.now(),
            payload: { skillId: '.agent/skills/missing-name/SKILL.md' },
          });
        }, 0);

        return () => clearTimeout(timer);
      }, [props.events]);

      return <SkillDetailPanel {...props} />;
    };

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: createMockFileSystemWithInvalidSkills(),
          },
        } as any}
      >
        {(props) => <SkillDetailWithSelection {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * Skill with missing description field
 */
export const MissingDescriptionField: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockFileTreeWithInvalidSkills,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    const SkillDetailWithSelection = (props: any) => {
      React.useEffect(() => {
        const timer = setTimeout(() => {
          props.events.emit({
            type: 'skill:selected',
            source: 'storybook',
            timestamp: Date.now(),
            payload: { skillId: '.agent/skills/missing-description/SKILL.md' },
          });
        }, 0);

        return () => clearTimeout(timer);
      }, [props.events]);

      return <SkillDetailPanel {...props} />;
    };

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: createMockFileSystemWithInvalidSkills(),
          },
        } as any}
      >
        {(props) => <SkillDetailWithSelection {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * Skill with both name and description missing
 */
export const MissingBothFields: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockFileTreeWithInvalidSkills,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    const SkillDetailWithSelection = (props: any) => {
      React.useEffect(() => {
        const timer = setTimeout(() => {
          props.events.emit({
            type: 'skill:selected',
            source: 'storybook',
            timestamp: Date.now(),
            payload: { skillId: '.agent/skills/missing-both/SKILL.md' },
          });
        }, 0);

        return () => clearTimeout(timer);
      }, [props.events]);

      return <SkillDetailPanel {...props} />;
    };

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: createMockFileSystemWithInvalidSkills(),
          },
        } as any}
      >
        {(props) => <SkillDetailWithSelection {...props} />}
      </MockPanelProvider>
    );
  },
};

/**
 * Skill with no frontmatter at all
 */
export const NoFrontmatter: Story = {
  render: () => {
    const mockSlices = new Map<string, DataSlice>();
    mockSlices.set('fileTree', {
      scope: 'repository',
      name: 'fileTree',
      data: mockFileTreeWithInvalidSkills,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    const SkillDetailWithSelection = (props: any) => {
      React.useEffect(() => {
        const timer = setTimeout(() => {
          props.events.emit({
            type: 'skill:selected',
            source: 'storybook',
            timestamp: Date.now(),
            payload: { skillId: '.agent/skills/no-frontmatter/SKILL.md' },
          });
        }, 0);

        return () => clearTimeout(timer);
      }, [props.events]);

      return <SkillDetailPanel {...props} />;
    };

    return (
      <MockPanelProvider
        contextOverrides={{
          slices: mockSlices,
          adapters: {
            fileSystem: createMockFileSystemWithInvalidSkills(),
          },
        } as any}
      >
        {(props) => <SkillDetailWithSelection {...props} />}
      </MockPanelProvider>
    );
  },
};
