# Tab Metadata and Visual Design

## Overview

This document describes the design strategy for displaying rich metadata in terminal tabs that contain custom panel content (file editors, git diffs, skills, markdown viewers, canvas editors, etc.). The goal is to provide users with clear visual indicators of what each tab contains without cluttering the UI.

## Current State

### Tab Structure

Currently, tabs use the `BaseTab` interface from `@industry-theme/xterm-terminal-panel`:

```typescript
interface BaseTab {
  id: string;           // Unique identifier
  label: string;        // Displayed text
  contentType: string;  // Determines rendered component
  closable: boolean;    // Whether tab can be closed
}
```

### Existing Tab Types

1. **TerminalTab** - Shell terminal sessions
   - Label: "Terminal" or session name
   - No icon currently

2. **SkillTab** - Skill detail panels
   - Label: Skill name (e.g., "commit", "review-pr")
   - No icon currently

3. **MarkdownTab** - Markdown file viewers
   - Label: File name (e.g., "README.md")
   - No icon currently

4. **CanvasEditorTab** - Canvas configuration editors
   - Label: Canvas name
   - No icon currently

5. **CanvasTab** - Canvas detail/execution panels
   - Label: Canvas name
   - No icon currently

6. **FileEditorTab** - Code/text file editors
   - Label: File name (e.g., "App.tsx")
   - No icon currently

7. **GitDiffTab** - Git diff viewers
   - Label: File name (e.g., "App.tsx")
   - No icon currently
   - No indication that it's a diff vs. regular editor

## Problem Statement

Users cannot easily distinguish between different tab types at a glance:
- A file editor tab and git diff tab for the same file look identical
- Terminal tabs, skill tabs, and file tabs all appear the same
- No visual hierarchy or categorization
- File extensions aren't visually emphasized
- Tab types that should be easily scannable (skills, terminals) blend in

## Design Goals

1. **At-a-glance identification** - Users should instantly know what each tab contains
2. **Visual hierarchy** - Similar tabs should be visually grouped
3. **Scalability** - Design should work with 5-20+ tabs open
4. **Accessibility** - Icons should have text alternatives, colors should have sufficient contrast
5. **Consistency** - Follow patterns established by modern code editors (VS Code, Cursor, etc.)
6. **Minimize clutter** - Keep tabs compact and readable

## Proposed Solution: Icon-Driven Tab Metadata

### Icon Strategy

Each tab type should have a distinct icon placed before the label text:

```
[Icon] Label Text [Close X]
```

#### Icon Sources

Use `lucide-react` icons for consistency with existing UI:

**Terminal Tabs:**
- `Terminal` icon - For shell sessions
- Color: Terminal green accent

**Skill Tabs:**
- `Zap` or `Sparkles` icon - For AI/automation skills
- Color: Accent color (purple/blue)

**File Content Tabs:**
- `FileText` icon - For regular file editors
- `GitCompare` or `GitPullRequest` icon - For git diff viewers
- `FileCode` icon - For code files
- `Book` or `FileType` icon - For markdown files
- Color: Based on git status (modified: orange, staged: green, untracked: blue)

**Canvas Tabs:**
- `Layout` or `Boxes` icon - For canvas editors
- `Play` or `Activity` icon - For canvas detail/execution panels
- Color: Based on canvas state

### Enhanced Tab Interface

Extend the tab types to support icon metadata:

```typescript
interface TabIconConfig {
  icon: string;              // Icon name from lucide-react
  color?: string;            // Optional color override
  tooltip?: string;          // Optional hover tooltip
}

interface FileEditorTab extends BaseTab {
  contentType: 'file-editor';
  filePath: string;
  fileName: string;
  icon?: TabIconConfig;      // NEW
}

interface GitDiffTab extends BaseTab {
  contentType: 'git-diff';
  filePath: string;
  fileName: string;
  gitStatus?: string;
  icon?: TabIconConfig;      // NEW
}
```

### Visual Examples

#### Terminal Tab
```
[Terminal Icon] Terminal ×
```

#### Skill Tab
```
[Zap Icon] commit ×
```

#### File Editor Tab (unmodified)
```
[FileText Icon] App.tsx ×
```

#### Git Diff Tab (modified)
```
[GitCompare Icon] App.tsx ×
```
- Icon in orange to indicate modified status

#### Markdown Tab
```
[Book Icon] README.md ×
```

#### Canvas Editor Tab
```
[Layout Icon] Login Flow ×
```

## Implementation Approach

### Phase 1: Icon Infrastructure (Foundation)

**Goal:** Add icon support to `TabbedTerminalPanel` without breaking existing tabs.

**Tasks:**
1. Update `BaseTab` interface to include optional `icon` field
2. Update tab rendering in `TabbedTerminalPanel` to render icons when provided
3. Import lucide-react icons
4. Test with one tab type (e.g., terminal)

**Example Code:**

```typescript
// In BaseTab interface
interface BaseTab {
  id: string;
  label: string;
  contentType: string;
  closable: boolean;
  icon?: {
    name: string;       // lucide-react icon name
    color?: string;     // optional color
    size?: number;      // optional size (default: 16)
  };
}

// In tab rendering
{tab.icon && (
  <LucideIcon
    name={tab.icon.name}
    size={tab.icon.size || 16}
    color={tab.icon.color || theme.colors.textSecondary}
  />
)}
<span>{tab.label}</span>
```

### Phase 2: Terminal & Skill Tabs (Simple Cases)

**Goal:** Add icons to tabs that don't need complex logic.

**Terminal Tabs:**
```typescript
const terminalTab: TerminalTab = {
  id: 'terminal-1',
  label: 'Terminal',
  contentType: 'terminal',
  closable: true,
  icon: {
    name: 'Terminal',
    color: theme.colors.success,  // Terminal green
  },
};
```

**Skill Tabs:**
```typescript
const skillTab: SkillTab = {
  id: `skill-${skillId}`,
  label: skillName,
  contentType: 'skill',
  closable: true,
  icon: {
    name: 'Zap',
    color: theme.colors.accent,  // Skill accent color
  },
};
```

### Phase 3: File-Based Tabs (Complex Cases)

**Goal:** Add icons with logic based on file type and git status.

**File Type Detection:**

```typescript
function getFileIcon(filePath: string, gitStatus?: string): TabIconConfig {
  const ext = filePath.split('.').pop()?.toLowerCase();

  // Markdown files
  if (ext === 'md' || ext === 'mdx') {
    return {
      name: 'Book',
      color: theme.colors.textSecondary,
    };
  }

  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go'].includes(ext || '')) {
    return {
      name: 'FileCode',
      color: theme.colors.textSecondary,
    };
  }

  // Default
  return {
    name: 'FileText',
    color: theme.colors.textSecondary,
  };
}
```

**Git Diff Tabs:**

```typescript
function getGitDiffIcon(gitStatus?: string): TabIconConfig {
  const statusColors = {
    staged: theme.colors.success,      // Green
    unstaged: theme.colors.warning,    // Orange
    untracked: theme.colors.info,      // Blue
    deleted: theme.colors.error,       // Red
  };

  return {
    name: 'GitCompare',
    color: statusColors[gitStatus || 'unstaged'],
    tooltip: `Git diff (${gitStatus})`,
  };
}
```

**Usage:**

```typescript
// File Editor Tab
const fileEditorTab: FileEditorTab = {
  id: `file-${Date.now()}`,
  label: fileName,
  contentType: 'file-editor',
  filePath: filePath,
  fileName: fileName,
  closable: true,
  icon: getFileIcon(filePath),
};

// Git Diff Tab
const gitDiffTab: GitDiffTab = {
  id: `git-diff-${Date.now()}`,
  label: fileName,
  contentType: 'git-diff',
  filePath: filePath,
  fileName: fileName,
  gitStatus: 'unstaged',
  closable: true,
  icon: getGitDiffIcon('unstaged'),
};
```

### Phase 4: Canvas Tabs

**Canvas Editor Tabs:**
```typescript
const canvasEditorTab: CanvasEditorTab = {
  id: `canvas-${canvasId}`,
  label: canvasName,
  contentType: 'canvas-editor',
  canvasId: canvasId,
  canvasPath: canvasPath,
  canvasName: canvasName,
  closable: true,
  icon: {
    name: 'Layout',
    color: theme.colors.accent,
  },
};
```

**Canvas Detail Tabs (with execution):**
```typescript
const canvasDetailTab: CanvasTab = {
  id: `canvas-detail-${canvasId}`,
  label: canvasName,
  contentType: 'canvas-detail',
  canvasId: canvasId,
  canvasPath: canvasPath,
  canvasName: canvasName,
  closable: true,
  icon: {
    name: 'Activity',  // Indicates running/execution
    color: theme.colors.accent,
  },
};
```

## Additional Enhancements (Future)

### 1. Status Badges

Add small visual indicators for tab state:

```
[Icon] Label [Badge] ×
```

Examples:
- **Dirty/Unsaved:** Small dot indicator (like VS Code)
- **Running:** Animated spinner
- **Error:** Red badge with count
- **Modified:** Orange dot

```typescript
interface BaseTab {
  icon?: TabIconConfig;
  badge?: {
    type: 'dot' | 'count' | 'spinner';
    color?: string;
    value?: number;  // For count badges
  };
}
```

### 2. Tab Tooltips

Show full information on hover:

```typescript
interface BaseTab {
  tooltip?: string;  // Full path, status, or description
}
```

Examples:
- File editor: `/Users/user/project/src/App.tsx`
- Git diff: `App.tsx (unstaged changes)`
- Skill: `Git commit helper - Creates commits with proper formatting`

### 3. Tab Grouping

Visual separators between different tab types:

```
[Terminal Icon] Terminal | [FileText Icon] App.tsx [GitCompare Icon] App.tsx | [Zap Icon] commit
        Terminals                    Files                                      Skills
```

### 4. Favicon-Style Icons for File Types

Language-specific icons for code files:
- TypeScript: TS logo
- JavaScript: JS logo
- Python: Python logo
- etc.

Could use file-icons or VSCode's icon theme.

## Technical Considerations

### Performance

- Icons should be memoized to avoid re-rendering
- Use React.memo for tab components
- Lazy-load icon libraries if needed

### Theming

- All colors should come from theme context
- Support light/dark mode
- Maintain sufficient contrast ratios (WCAG AA)

### Accessibility

- Icons should have `aria-label` attributes
- Tooltips should be keyboard-accessible
- Color should not be the only indicator (also use shape/icon)

### TabbedTerminalPanel Updates

The terminal panel package may need updates to:
1. Support icon rendering in tabs
2. Handle badge rendering
3. Support custom tab templates/renderers

**Alternative Approach:** If terminal panel doesn't support icons, wrap tab labels with custom renderer:

```typescript
<TabbedTerminalPanel
  renderTabLabel={(tab) => (
    <>
      {tab.icon && <Icon name={tab.icon.name} />}
      <span>{tab.label}</span>
      {tab.badge && <Badge type={tab.badge.type} />}
    </>
  )}
/>
```

## Migration Path

1. **Phase 1 (1-2 days):** Add icon infrastructure, test with terminals
2. **Phase 2 (1 day):** Add icons to skills and markdown tabs
3. **Phase 3 (2-3 days):** Implement file-type detection and git status colors
4. **Phase 4 (1 day):** Add canvas tab icons
5. **Future:** Badges, tooltips, grouping (as needed)

## Open Questions

1. Should we update `@industry-theme/xterm-terminal-panel` to support icons, or handle it locally?
2. Do we want animated icons (e.g., spinner for running terminals)?
3. Should we support custom icon components or stick with lucide-react?
4. Do we want tab reordering? If so, how does that affect icon semantics?
5. Should git status colors be configurable or fixed?

## References

- VS Code tab design: Icons + badges + tooltips
- Cursor tab design: Similar to VS Code
- Lucide React icons: https://lucide.dev/icons/
- TabbedTerminalPanel: `@industry-theme/xterm-terminal-panel`

## Success Metrics

- Users can identify tab types within 1 second
- Reduced time switching between tabs (fewer mistakes)
- Positive feedback on tab usability in user testing
- No performance degradation with 20+ tabs open
