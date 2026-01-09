# Agent Skills System

## Overview

The Agent Skills system enables discovery, browsing, and installation of skills from both local sources and GitHub repositories. Skills can be installed globally or per-project, with support for both universal (`.agent`) and Claude-specific (`.claude`) configurations.

## Features

### Local Skills Discovery
- Automatically discovers skills from project and global directories
- Scans for `SKILL.md` files in standard locations
- Displays skills with metadata, capabilities, and file structure
- Filters by source (project/global, universal/claude)

### GitHub Skills Browser
- Browse skills from any public GitHub repository
- Preview skills before installation
- Install directly to any destination
- Tracks installation metadata (source URL, timestamp, files)

## Using the Skills Browser

### Accessing the Browser
1. Open the navigation sidebar in the principal window
2. Click "Skills" to open the Skills Browser view
3. Enter a GitHub repository URL
4. Click "Browse" to discover skills

### Supported GitHub URLs
```
✓ https://github.com/owner/repo
✓ https://github.com/owner/repo/tree/branch
✓ https://github.com/owner/repo/tree/branch/path/to/skills
```

### Installing Skills

1. Browse or search for a skill
2. Click the skill to preview
3. Click "Install Skill"
4. Select installation destination:
   - **Global Universal** (`~/.agent/skills/`) - Available to all projects
   - **Global Claude** (`~/.claude/skills/`) - Claude-specific, all projects
   - **Project Universal** (`./.agent/skills/`) - Current project only
   - **Project Claude** (`./.claude/skills/`) - Claude-specific, current project

### Installation Metadata

When skills are installed from GitHub, a `.metadata.json` file is created containing:
```json
{
  "installedFrom": "https://github.com/owner/repo",
  "skillPath": "skills/skill-name",
  "owner": "owner",
  "repo": "repo",
  "branch": "main",
  "installedAt": "2024-01-09T12:00:00.000Z",
  "destination": "global-claude",
  "sha": "commit-sha",
  "files": ["SKILL.md", "scripts/setup.sh", ...]
}
```

This metadata is displayed in the Skills List Panel as a GitHub badge showing the source repository.

## Skill Priority Resolution

When multiple skills with the same name exist, they're loaded in this priority order:

1. **Project Universal** (`./.agent/skills/`) - Priority 1
2. **Global Universal** (`~/.agent/skills/`) - Priority 2
3. **Project Claude** (`./.claude/skills/`) - Priority 3
4. **Global Claude** (`~/.claude/skills/`) - Priority 4
5. **Project Other** (any other project location) - Priority 5

Higher priority (lower number) skills override lower priority ones.

## Creating Skills

### Minimal Skill Structure
```
skill-name/
└── SKILL.md              # Required
```

### Standard Skill Structure
```
skill-name/
├── SKILL.md              # Required: Skill definition
├── scripts/              # Optional: Executable scripts
│   ├── setup.sh
│   └── validate.py
├── references/           # Optional: Reference documentation
│   ├── guide.md
│   └── examples.md
└── assets/               # Optional: Static resources
    ├── templates/
    └── diagrams/
```

### SKILL.md Format

```markdown
# Skill Name

Brief description of what this skill does.

More detailed explanation of the skill's purpose and capabilities.

## Capabilities

- First capability
- Second capability
- Third capability

## Usage

How to use this skill with the agent.

## Requirements

Optional: System requirements, dependencies, prerequisites

## Configuration

Optional: Configuration options and settings

## Examples

Optional: Usage examples and common scenarios
```

### Skill Repository Structure

#### Option 1: Dedicated Skills Repository
```
agent-skills-library/
├── README.md
└── skills/
    ├── code-review/
    │   ├── SKILL.md
    │   ├── scripts/
    │   └── references/
    ├── documentation-generator/
    │   └── SKILL.md
    └── test-automation/
        └── SKILL.md
```

#### Option 2: Project-Embedded Skills
```
my-project/
├── src/
├── docs/
└── .agent/
    └── skills/
        ├── deploy-to-prod/
        │   └── SKILL.md
        └── run-tests/
            └── SKILL.md
```

## Technical Architecture

### Components

**GitHubFileSystemAdapter** (`src/renderer/github-skill-browser/GitHubFileSystemAdapter.ts`)
- Adapts GitHub API to FileSystem interface
- Reads files from GitHub repositories
- Converts paths between GitHub and local formats

**SkillBrowserView** (`src/renderer/principal-window/views/SkillBrowserView/`)
- URL input and validation
- Repository scanning
- Skill installation coordination

**SkillBrowserPanelProvider** (`@industry-theme/agent-panels`)
- Provides context to skill panels
- Manages GitHub adapter state
- Handles skill selection and installation

**Skills Panels** (`@industry-theme/agent-panels`)
- `SkillsListPanel`: Displays discovered skills with search/filter
- `SkillDetailPanel`: Shows skill details and SKILL.md content
- `SkillCard`: Individual skill display with metadata badges

### Data Flow

```
1. User enters GitHub URL
   └─> Parse and validate URL
      └─> Fetch repository tree via GitHub API
         └─> Convert to FileTree format
            └─> Pass to SkillBrowserPanelProvider

2. Panel discovers skills
   └─> Find all SKILL.md files in FileTree
      └─> Read SKILL.md content via GitHubFileSystemAdapter
         └─> Parse metadata and capabilities
            └─> Display in SkillsListPanel

3. User installs skill
   └─> Select destination
      └─> Download all skill files via GitHub API
         └─> Create destination directory
            └─> Copy files preserving structure
               └─> Create .metadata.json
                  └─> Refresh global skills cache
                     └─> Update UI with new skill
```

### IPC Events

**FileSystemAPI** (`src/shared/main-process-api-interfaces/FileSystemAPI.ts`)
```typescript
GET_GLOBAL_SKILLS = 'file-system:get-global-skills'
// Returns all skills from ~/.agent/skills/ and ~/.claude/skills/
```

**GitHubAPI** (`src/shared/main-process-api-interfaces/GitHubAPI.ts`)
```typescript
GET_REPO_TREE = 'github:get-repo-tree'
GET_FILE_CONTENT = 'github:get-file-content'
INSTALL_SKILL = 'github:install-skill'
```

### GitHub API Integration

**Endpoints Used:**
- `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` - Get full repository tree
- `GET /repos/{owner}/{repo}/contents/{path}` - Get file content (base64 encoded)

**Rate Limiting:**
- Anonymous: 60 requests/hour
- Authenticated: 5000 requests/hour (with GitHub token)

## File Naming Conventions

### Scripts
- Extensions: `.sh`, `.py`, `.js`, `.ts`
- Naming: `verb-noun.ext` (e.g., `generate-report.py`)
- Must include shebang line
- Should be marked executable

### References
- Format: Markdown (`.md`)
- Naming: `noun-description.md` (e.g., `api-reference.md`)

### Assets
- Templates: `*.template` or `*.tpl`
- Data: `.json`, `.yaml`, `.csv`
- Images: `.png`, `.jpg`, `.svg`
- Naming: Lowercase, dash-separated

## Validation Rules

### Skill Validation
- ✓ SKILL.md exists and is readable
- ✓ Has at least a title and description
- ✓ Scripts are in scripts/ directory only
- ✓ References are markdown files
- ✓ No files larger than 10MB
- ✓ No directory traversal in paths (../)

### Security
- ✓ No executable files outside scripts/
- ✓ No hidden files (except .metadata.json)
- ✓ File paths validated before installation

## Examples

### Installing from GitHub
```
1. Navigate to Skills in sidebar
2. Enter: https://github.com/anthropics/skills
3. Click "Browse"
4. Select a skill (e.g., "brand-guidelines")
5. Click "Install Skill"
6. Choose "Global Claude" destination
7. Skill appears in Skills List Panel with GitHub badge
```

### Creating a Simple Skill
```bash
# Create skill directory
mkdir -p ~/.agent/skills/my-skill

# Create SKILL.md
cat > ~/.agent/skills/my-skill/SKILL.md << 'EOF'
# My Custom Skill

This skill helps with custom task automation.

## Capabilities

- Automate repetitive tasks
- Generate boilerplate code
- Validate project structure

## Usage

Ask the agent to use this skill when you need help with custom tasks.
EOF

# Skill will be automatically discovered on next refresh
```

### Creating a Skill with Scripts
```bash
# Create skill structure
mkdir -p ~/.agent/skills/deployment-helper/{scripts,references}

# Create SKILL.md
cat > ~/.agent/skills/deployment-helper/SKILL.md << 'EOF'
# Deployment Helper

Automates deployment workflows for production environments.

## Capabilities

- Pre-deployment validation
- Environment configuration
- Rollback procedures

## Usage

Use this skill when deploying to production environments.
EOF

# Create validation script
cat > ~/.agent/skills/deployment-helper/scripts/validate.sh << 'EOF'
#!/bin/bash
# Validate deployment prerequisites
echo "Checking deployment requirements..."
# Add validation logic here
EOF

chmod +x ~/.agent/skills/deployment-helper/scripts/validate.sh

# Create reference documentation
cat > ~/.agent/skills/deployment-helper/references/deployment-guide.md << 'EOF'
# Deployment Guide

## Prerequisites
- Production credentials configured
- All tests passing
- Code review approved

## Steps
1. Run validation script
2. Deploy to staging
3. Run smoke tests
4. Deploy to production
EOF
```

## Troubleshooting

### Skills Not Appearing
- Check that SKILL.md exists in the skill folder
- Verify the skill is in a supported location (`.agent/skills/` or `.claude/skills/`)
- Refresh the Skills panel

### Installation Fails
- Verify GitHub URL is accessible
- Check internet connection
- Ensure destination directory is writable
- Check GitHub rate limits (60/hour without auth)

### GitHub Badge Not Showing
- Verify `.metadata.json` exists in skill folder
- Check that metadata contains `owner` and `repo` fields
- Try refreshing the Skills panel

## Future Enhancements

- Skill update notifications
- Bulk installation
- Private repository support (GitHub token auth)
- Skill versioning and dependency resolution
- Skill templates and scaffolding
- Community skill registry

## Related Packages

- [@industry-theme/agent-panels](https://www.npmjs.com/package/@industry-theme/agent-panels) - Skill UI components
- [@principal-ade/panel-framework-core](https://www.npmjs.com/package/@principal-ade/panel-framework-core) - Panel framework
- [@principal-ai/repository-abstraction](https://www.npmjs.com/package/@principal-ai/repository-abstraction) - FileTree abstraction
