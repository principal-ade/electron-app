import { ThemeProvider, theme as defaultTheme } from '@principal-ade/industry-theme';
import type { PartialParsedSkill } from '@principal-ade/markdown-utils';
import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect, useRef, useState } from 'react';
import { fn } from 'storybook/test';

import { SkillMarkdown } from './SkillMarkdown';
import { createMockActions, createMockEvents } from '../../mocks/panelContext';

/**
 * SkillMarkdown component for rendering Agent Skills with frontmatter
 */
const meta = {
  title: 'Components/SkillMarkdown',
  component: SkillMarkdown,
  decorators: [
    (Story) => (
      <ThemeProvider theme={defaultTheme}>
        <div style={{ height: '100vh', width: '100%' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Renders Agent Skills markdown following the agentskills.io specification. Parses YAML frontmatter and displays skill metadata with markdown body.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SkillMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

const basicSkillContent = `---
name: legal-review
description: Review contracts and legal documents for potential issues and compliance
license: MIT
compatibility: ">=1.0.0"
allowed-tools: "Read Write Bash(jq:*)"
metadata:
  author: AI Team
  version: "1.0.0"
  category: Legal
---

# Legal Review Skill

This skill enables AI agents to review legal documents for compliance and potential issues.

## Capabilities

- **Contract Analysis**: Identify contractual obligations and liabilities
- **Regulatory Compliance**: Check documents against relevant regulations
- **Risk Assessment**: Flag ambiguous or problematic clauses
- **Language Review**: Suggest improvements to legal language
- **Template Comparison**: Compare against standard contract templates

## Usage

\`\`\`typescript
const result = await agent.useSkill('legal-review', {
  document: contractText,
  jurisdiction: 'US',
  checkCompliance: true,
});
\`\`\`

## Best Practices

1. Always specify the jurisdiction for accurate compliance checking
2. Provide context about the transaction type
3. Review flagged items with human legal counsel
4. Keep the legal database up to date

## Limitations

- Not a replacement for professional legal advice
- May not catch all edge cases
- Jurisdiction-specific rules require up-to-date data
`;

const minimalSkillContent = `---
name: email-drafter
description: Draft professional emails based on context and intent
---

# Email Drafter

Simple skill for drafting emails.

## Features

- Professional tone
- Context-aware
- Multiple templates
`;

const fullFeaturedSkillContent = `---
name: sql-query-generator
description: Generate optimized SQL queries from natural language descriptions
license: Apache-2.0
compatibility: "Requires PostgreSQL 12+, MySQL 8+, or SQLite 3.35+. Network access required for schema introspection."
allowed-tools: "Read Write Bash(psql:*) Bash(mysql:*) Bash(sqlite3:*)"
metadata:
  author: Database Team
  version: "2.1.0"
  category: Database
  difficulty: Advanced
  last-updated: "2024-01-06"
---

# SQL Query Generator

Advanced skill for converting natural language into optimized, secure SQL queries.

## Overview

This skill leverages natural language processing and database schema understanding to generate production-ready SQL queries. It supports multiple database dialects and includes built-in security validation.

## Capabilities

### Query Generation
- Parse natural language query descriptions
- Generate syntactically correct SQL
- Support for complex joins and subqueries
- Aggregate functions and window functions

### Multi-Dialect Support
- PostgreSQL
- MySQL
- SQL Server
- Oracle
- SQLite

### Security & Optimization
- SQL injection prevention
- Query optimization suggestions
- Index usage analysis
- Permission validation

## Usage Examples

### Basic Query
\`\`\`typescript
const query = await agent.useSkill('sql-generator', {
  prompt: 'Find all users who registered in the last 30 days',
  dialect: 'postgresql',
});
// Output: SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '30 days';
\`\`\`

### Complex Join
\`\`\`typescript
const query = await agent.useSkill('sql-generator', {
  prompt: 'Show total orders per customer with their contact info',
  dialect: 'mysql',
  optimize: true,
});
\`\`\`

## Configuration

\`\`\`yaml
sql-generator:
  default-dialect: postgresql
  max-query-complexity: 10
  require-explain-plan: true
  security-level: strict
\`\`\`

## Best Practices

1. **Always validate schemas**: Ensure the skill has access to current schema information
2. **Review generated queries**: Don't blindly execute without review
3. **Use EXPLAIN**: Check query plans for performance
4. **Limit permissions**: Grant minimal required database permissions

## Performance Considerations

- Large result sets may require pagination
- Complex queries might need manual optimization
- Consider using materialized views for frequent queries

## Security

This skill includes multiple layers of security validation:

- ✅ SQL injection prevention
- ✅ Permission boundary checking
- ✅ Query complexity limits
- ✅ Sensitive data access controls

## Troubleshooting

### Query Returns No Results
- Check schema names and table names
- Verify column names match schema
- Review WHERE clause conditions

### Performance Issues
- Add appropriate indexes
- Consider query rewriting
- Check for N+1 problems

## Version History

- **2.1.0**: Added Oracle support, improved optimization
- **2.0.0**: Multi-dialect support, security hardening
- **1.5.0**: Performance profiling integration
- **1.0.0**: Initial release
`;

const invalidSkillContent = `---
name: Invalid Skill
# Missing required description field!
license: MIT
---

# This will fail validation

Because description is missing.
`;

const malformedYamlContent = `---
name: broken-skill
description: This has malformed YAML
  bad indentation
  - and list issues
---

# Broken YAML

This won't parse correctly.
`;

const invalidNameUppercase = `---
name: Email-Sender
description: This skill name contains uppercase letters which violates the spec
---

# Email Sender

Names must be lowercase only.
`;

const invalidNameConsecutiveHyphens = `---
name: email--sender
description: This skill name contains consecutive hyphens which violates the spec
---

# Email Sender

Names cannot have consecutive hyphens.
`;

const invalidNameStartsWithHyphen = `---
name: -email-sender
description: This skill name starts with a hyphen which violates the spec
---

# Email Sender

Names cannot start with a hyphen.
`;

const invalidNameEndsWithHyphen = `---
name: email-sender-
description: This skill name ends with a hyphen which violates the spec
---

# Email Sender

Names cannot end with a hyphen.
`;

const invalidNameSpecialChars = `---
name: email_sender@v1
description: This skill name contains special characters which violates the spec
---

# Email Sender

Names can only contain lowercase alphanumeric and hyphens.
`;

/**
 * Basic skill with all standard fields
 */
export const Basic: Story = {
  args: {
    content: basicSkillContent,
    theme: defaultTheme,
    onParsed: fn(),
    actions: createMockActions(),
    events: createMockEvents(),
    skill: {
      id: 'legal-review',
      name: 'legal-review',
      path: '/Users/developer/.claude/skills/legal-review/SKILL.md',
      skillFolderPath: '/Users/developer/.claude/skills/legal-review',
      source: 'global-universal' as const,
      priority: 4 as const,
      content: basicSkillContent,
      hasScripts: false,
      hasReferences: false,
      hasAssets: false,
      frontmatterValidation: { isValid: true, hasStructure: true, missingFields: [] },
    },
  },
};

/**
 * Minimal skill with only required fields
 */
export const Minimal: Story = {
  args: {
    content: minimalSkillContent,
    theme: defaultTheme,
    onParsed: fn(),
  },
};

/**
 * Full-featured skill with extensive documentation
 */
export const FullFeatured: Story = {
  args: {
    content: fullFeaturedSkillContent,
    theme: defaultTheme,
    onParsed: fn(),
    actions: createMockActions(),
    events: createMockEvents(),
    skill: {
      id: 'sql-query-generator',
      name: 'sql-query-generator',
      path: '/Users/developer/.claude/skills/sql-query-generator/SKILL.md',
      skillFolderPath: '/Users/developer/.claude/skills/sql-query-generator',
      source: 'global-universal' as const,
      priority: 4 as const,
      content: fullFeaturedSkillContent,
      hasScripts: true,
      hasReferences: true,
      hasAssets: false,
      scriptFiles: ['query-builder.js', 'validator.js'],
      referenceFiles: ['postgresql-docs.md', 'mysql-reference.md'],
      frontmatterValidation: { isValid: true, hasStructure: true, missingFields: [] },
    },
  },
};

/**
 * Invalid skill missing required field
 */
export const InvalidSkill: Story = {
  args: {
    content: invalidSkillContent,
    theme: defaultTheme,
  },
};

/**
 * Invalid skill with malformed YAML
 */
export const MalformedYAML: Story = {
  args: {
    content: malformedYamlContent,
    theme: defaultTheme,
  },
};

/**
 * Invalid skill with fallback to raw markdown
 */
export const InvalidWithFallback: Story = {
  args: {
    content: invalidSkillContent,
    theme: defaultTheme,
    showRawOnError: true,
    onParsed: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'When showRawOnError is true, the component falls back to rendering raw markdown instead of showing an error message.',
      },
    },
  },
};

/**
 * Skill with code examples and syntax highlighting
 */
export const WithCodeExamples: Story = {
  args: {
    content: `---
name: api-client-generator
description: Generate type-safe API clients from OpenAPI specifications
license: MIT
allowed-tools: "Read Write Bash(npm:*) Bash(python:*)"
---

# API Client Generator

Generate fully type-safe API clients.

## TypeScript Example

\`\`\`typescript
import { generateClient } from './api-generator';

const client = await generateClient({
  spec: './openapi.yaml',
  output: './src/api',
  features: {
    validation: true,
    retry: true,
    auth: 'bearer',
  },
});
\`\`\`

## Python Example

\`\`\`python
from api_generator import generate_client

client = generate_client(
    spec="./openapi.yaml",
    output="./api",
    async_mode=True
)
\`\`\`

## Supported Languages

- TypeScript
- Python
- Go
- Rust
`,
    theme: defaultTheme,
    onParsed: fn(),
  },
};

/**
 * Skill with tables and advanced markdown
 */
export const WithTables: Story = {
  args: {
    content: `---
name: data-transformer
description: Transform data between different formats and schemas
allowed-tools: "Read Write Bash(jq:*) Bash(yq:*)"
---

# Data Transformer

Transform data between formats.

## Supported Formats

| Input Format | Output Format | Validation | Schema Support |
|--------------|---------------|------------|----------------|
| JSON         | CSV          | ✅         | ✅             |
| CSV          | JSON         | ✅         | ✅             |
| XML          | JSON         | ✅         | ⚠️             |
| YAML         | JSON         | ✅         | ✅             |

## Performance Metrics

| File Size | Processing Time | Memory Usage |
|-----------|----------------|--------------|
| < 1 MB    | < 100ms        | < 10 MB      |
| 1-10 MB   | < 1s           | < 50 MB      |
| 10-100 MB | < 10s          | < 200 MB     |

## Feature Checklist

- [x] JSON to CSV
- [x] CSV to JSON
- [x] XML to JSON
- [ ] Protobuf support
- [ ] Avro support
`,
    theme: defaultTheme,
    onParsed: fn(),
  },
};

/**
 * Invalid skill name with uppercase letters (violates spec)
 */
export const InvalidNameUppercase: Story = {
  args: {
    content: invalidNameUppercase,
    theme: defaultTheme,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Skill names must be lowercase alphanumeric and hyphens only. Uppercase letters violate the Agent Skills specification.',
      },
    },
  },
};

/**
 * Invalid skill name with consecutive hyphens (violates spec)
 */
export const InvalidNameConsecutiveHyphens: Story = {
  args: {
    content: invalidNameConsecutiveHyphens,
    theme: defaultTheme,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Skill names cannot contain consecutive hyphens according to the Agent Skills specification.',
      },
    },
  },
};

/**
 * Invalid skill name starting with hyphen (violates spec)
 */
export const InvalidNameStartsWithHyphen: Story = {
  args: {
    content: invalidNameStartsWithHyphen,
    theme: defaultTheme,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Skill names cannot start with a hyphen according to the Agent Skills specification.',
      },
    },
  },
};

/**
 * Invalid skill name ending with hyphen (violates spec)
 */
export const InvalidNameEndsWithHyphen: Story = {
  args: {
    content: invalidNameEndsWithHyphen,
    theme: defaultTheme,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Skill names cannot end with a hyphen according to the Agent Skills specification.',
      },
    },
  },
};

/**
 * Invalid skill name with special characters (violates spec)
 */
export const InvalidNameSpecialChars: Story = {
  args: {
    content: invalidNameSpecialChars,
    theme: defaultTheme,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Skill names can only contain lowercase alphanumeric characters and hyphens. Special characters like underscores and @ symbols violate the Agent Skills specification.',
      },
    },
  },
};

/**
 * Skill with explicit container width (skips ResizeObserver)
 */
export const WithContainerWidth: Story = {
  args: {
    content: basicSkillContent,
    theme: defaultTheme,
    containerWidth: 800,
    onParsed: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'When containerWidth is provided, IndustryMarkdownSlide skips ResizeObserver and uses the explicit width for padding calculations. This can improve performance when the parent already knows the container width.',
      },
    },
  },
};

/**
 * Wrapper component that uses ResizeObserver and passes width to SkillMarkdown
 */
const SkillMarkdownWithResizeObserver: React.FC<{
  content: string;
  onParsed?: (skill: PartialParsedSkill) => void;
}> = ({ content, onParsed }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setContainerWidth(width);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        border: '2px dashed rgba(100, 100, 255, 0.3)',
        boxSizing: 'border-box',
      }}
    >
      {containerWidth !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 8px',
            background: 'rgba(100, 100, 255, 0.1)',
            border: '1px solid rgba(100, 100, 255, 0.3)',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: defaultTheme.colors.text,
            zIndex: 1000,
          }}
        >
          Parent width: {containerWidth}px
        </div>
      )}
      <SkillMarkdown
        content={content}
        theme={defaultTheme}
        containerWidth={containerWidth}
        onParsed={onParsed}
      />
    </div>
  );
};

/**
 * Parent component with ResizeObserver passing width to SkillMarkdown
 */
export const WithParentResizeObserver: Story = {
  render: (args) => (
    <ThemeProvider theme={defaultTheme}>
      <div style={{ height: '100vh', width: '100%' }}>
        <SkillMarkdownWithResizeObserver
          content={args.content}
          onParsed={args.onParsed}
        />
      </div>
    </ThemeProvider>
  ),
  args: {
    content: basicSkillContent,
    theme: defaultTheme,
    onParsed: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates the optimal pattern: parent component uses ResizeObserver to measure its width and passes it to SkillMarkdown via containerWidth prop. This avoids duplicate ResizeObservers (one in parent, one in IndustryMarkdownSlide). The dashed border shows the parent container, and the label shows the measured width being passed down.',
      },
    },
  },
};

const longDocumentContent = `---
name: comprehensive-guide
description: A comprehensive guide with many sections to test table of contents
license: MIT
compatibility: ">=1.0.0"
allowed-tools: "Read Write Bash"
metadata:
  author: Documentation Team
  version: "1.0.0"
  category: Documentation
  last-updated: "2024-01-15"
---

# Comprehensive Development Guide

This is a comprehensive guide that covers many topics to demonstrate the table of contents functionality.

## Introduction

Welcome to this comprehensive guide. This document contains many sections and subsections to help you understand how the table of contents works with long documents.

### Purpose

The purpose of this guide is to provide detailed information across multiple topics while demonstrating effective documentation structure.

### Audience

This guide is intended for developers, architects, and anyone interested in understanding best practices.

## Getting Started

Before diving into the details, let's cover the basics.

### Prerequisites

You'll need to have the following installed:

- Node.js 18 or higher
- npm or yarn package manager
- Git for version control
- A code editor (VS Code recommended)

### Installation

Follow these steps to get started:

1. Clone the repository
2. Install dependencies
3. Configure your environment
4. Run the development server

### Quick Start

Here's a quick example to get you up and running immediately.

\`\`\`bash
npm install
npm run dev
\`\`\`

## Architecture Overview

Understanding the architecture is crucial for effective development.

### System Design

The system is built using a modular architecture with clear separation of concerns.

#### Core Components

The core components include:

- Authentication module
- Data persistence layer
- API gateway
- Business logic services

#### Data Flow

Data flows through the system in a unidirectional pattern, ensuring predictability and easier debugging.

### Technology Stack

We use modern technologies to ensure performance and maintainability.

#### Frontend

- React 19 for UI components
- TypeScript for type safety
- Vite for fast builds

#### Backend

- Node.js runtime
- Express.js framework
- PostgreSQL database

## Development Workflow

Let's explore the recommended development workflow.

### Setting Up Your Environment

Configure your local development environment for optimal productivity.

#### Editor Configuration

Use these recommended settings for your code editor:

- Enable ESLint
- Configure Prettier
- Install recommended extensions

#### Environment Variables

Set up your environment variables in a \`.env\` file:

\`\`\`bash
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=your-api-key-here
NODE_ENV=development
\`\`\`

### Writing Code

Follow these guidelines when writing code.

#### Code Style

We follow strict code style guidelines to maintain consistency.

##### Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for components and classes
- Use UPPER_SNAKE_CASE for constants

##### File Organization

Organize your files by feature rather than by type.

#### Best Practices

Follow these best practices for clean, maintainable code:

1. Write self-documenting code
2. Keep functions small and focused
3. Avoid premature optimization
4. Write tests for critical paths

### Testing

Testing is an essential part of our development process.

#### Unit Tests

Write unit tests for individual functions and components.

#### Integration Tests

Integration tests verify that different parts of the system work together correctly.

#### End-to-End Tests

E2E tests simulate real user scenarios.

## API Documentation

Our API follows REST principles and uses JSON for data exchange.

### Authentication

All API requests require authentication using JWT tokens.

#### Obtaining Tokens

Request a token by sending credentials to the \`/auth/login\` endpoint.

#### Token Refresh

Tokens expire after 24 hours and must be refreshed using the refresh endpoint.

### Endpoints

Here are the main API endpoints.

#### Users

Manage user accounts and profiles.

##### GET /api/users

Retrieve a list of users.

##### POST /api/users

Create a new user account.

##### PUT /api/users/:id

Update an existing user.

##### DELETE /api/users/:id

Delete a user account.

#### Projects

Manage projects and associated resources.

##### GET /api/projects

List all projects.

##### POST /api/projects

Create a new project.

## Database Schema

Understanding the database schema is important for data modeling.

### Tables

The database consists of several core tables.

#### Users Table

Stores user account information.

#### Projects Table

Contains project data and metadata.

#### Tasks Table

Manages tasks within projects.

### Relationships

Tables are related through foreign keys and junction tables.

### Indexes

Proper indexing ensures query performance.

## Deployment

Learn how to deploy the application to production.

### Preparation

Before deploying, ensure all tests pass and the build is successful.

### Environments

We maintain three environments:

#### Development

Used for active development and experimentation.

#### Staging

Mirrors production for final testing.

#### Production

The live environment serving real users.

### CI/CD Pipeline

Our continuous integration and deployment pipeline automates the release process.

#### Build Stage

Code is compiled and bundled.

#### Test Stage

All tests are executed automatically.

#### Deploy Stage

Successful builds are deployed to the appropriate environment.

## Monitoring and Logging

Effective monitoring ensures system health and quick issue resolution.

### Application Monitoring

Monitor application performance and errors.

### Infrastructure Monitoring

Track server resources and network performance.

### Log Aggregation

Centralized logging helps with debugging and auditing.

## Security

Security is a top priority in our development process.

### Authentication and Authorization

Implement robust authentication and fine-grained authorization.

### Data Protection

Protect sensitive data both in transit and at rest.

### Vulnerability Management

Regularly scan for and address security vulnerabilities.

## Performance Optimization

Optimize your application for speed and efficiency.

### Frontend Optimization

Improve client-side performance.

#### Code Splitting

Split your code into smaller bundles for faster loading.

#### Lazy Loading

Load components and resources on demand.

#### Caching Strategies

Implement effective caching to reduce server load.

### Backend Optimization

Optimize server-side performance.

#### Database Optimization

Use indexes, query optimization, and connection pooling.

#### API Response Time

Minimize API response times through various techniques.

## Troubleshooting

Common issues and their solutions.

### Common Errors

Learn how to resolve frequently encountered errors.

### Debugging Techniques

Effective debugging strategies for different scenarios.

### Support Resources

Where to get help when you're stuck.

## Contributing

We welcome contributions from the community.

### Code of Conduct

Please follow our code of conduct in all interactions.

### Contribution Guidelines

Review our guidelines before submitting contributions.

### Pull Request Process

Follow this process when submitting pull requests.

## Conclusion

Thank you for reading this comprehensive guide. We hope it helps you in your development journey.

### Next Steps

Continue learning and exploring the codebase.

### Additional Resources

Check out these resources for more information.

### Feedback

We appreciate your feedback to improve this documentation.
`;

/**
 * Long document with many headers to test table of contents
 */
export const LongDocumentWithTableOfContents: Story = {
  args: {
    content: longDocumentContent,
    theme: defaultTheme,
    onParsed: fn(),
    onWarnings: fn(),
    actions: createMockActions(),
    events: createMockEvents(),
    skill: {
      id: 'comprehensive-guide',
      name: 'comprehensive-guide',
      path: '/Users/developer/my-project/skills/comprehensive-guide/SKILL.md',
      skillFolderPath: '/Users/developer/my-project/skills/comprehensive-guide',
      source: 'project-universal' as const,
      priority: 1 as const,
      content: longDocumentContent,
      hasScripts: false,
      hasReferences: true,
      hasAssets: false,
      referenceFiles: ['examples.md', 'troubleshooting.md'],
      frontmatterValidation: { isValid: true, hasStructure: true, missingFields: [] },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates the table of contents feature with a long document containing many headers at various levels. The ToC appears on the left side and allows quick navigation to different sections.',
      },
    },
  },
};
