# Skill Installation Flow

This canvas documents the skill installation flow in the main window, covering how users browse, install, and manage skills for various AI agents (Claude, OpenCode, Cursor, Windsurf).

## Overview

The skill installation system allows users to:
- Browse skills from GitHub repositories
- Install skills to multiple agent directories simultaneously
- Track installed skills with version metadata
- Update skills when new versions are available
- Uninstall skills from specific directories

## Architecture

### UI Layer (Renderer)

**SkillBrowserView** - Main entry point with two modes:
- "Browse" - View skills from configured GitHub repositories
- "Installed" - View locally installed skills

**InstallSkillToolbar** - Shows installation status and triggers the install flow

**SkillInstallationModal** - Multi-directory selection for installation

**AgentSetupModal** - Create new agent directories

### Service Layer (Renderer)

**GithubService** - Fetches repository trees and initiates installations
- `getTree(owner, repo, branch)` - Fetch file structure
- `getFileContent(owner, repo, path, branch)` - Download files
- `installSkill(options)` - Trigger installation

**FileSystemService** - Manages local filesystem operations
- `getAllLocalSkills()` - List installed skills
- `detectPresetDirectories()` - Find agent directories

**SkillLockService** - Manages skill metadata tracking
- `getSkillEntry(name)` - Get install metadata
- `checkUpdates()` - Compare SHAs for updates

### IPC Layer (Main Process)

**INSTALL_SKILL** - Orchestrates the full installation:
1. Parse GitHub URL
2. Download files from GitHub
3. Write to canonical location (`~/.agents/skills/`)
4. Create symlinks to agent directories
5. Update skill lock file

**DETECT_PRESET_DIRS** - Scans for agent directories

**SKILL_LOCK operations** - Manage skills.lock.json

## Installation Flow

```
User selects skill in SkillBrowserView
    ↓
InstallSkillToolbar shows status (install/update/installed)
    ↓
User clicks Install → SkillInstallationModal opens
    ↓
User selects directories → GithubService.installSkill()
    ↓
IPC: INSTALL_SKILL → Main process
    ↓
GitHub API: Download files
    ↓
Write to ~/.agents/skills/{skillName} (canonical)
    ↓
Create symlinks in ~/.claude/skills/, etc.
    ↓
Update skills.lock.json with SHA, source, timestamp
    ↓
Return success → UI refreshes
```

## Destination Types

| Destination | Path | Description |
|------------|------|-------------|
| global-universal | ~/.agents/skills/ | Canonical storage |
| global-claude | ~/.claude/skills/ | Claude symlink |
| global-opencode | ~/.config/openCode/skills/ | OpenCode symlink |
| global-cursor | ~/.cursor/skills/ | Cursor symlink |
| global-windsurf | ~/.windsurf/skills/ | Windsurf symlink |
| project-claude | .claude/skills/ | Project-specific |

## Key Files

- `src/renderer/principal-window/views/SkillBrowserView/SkillBrowserView.tsx`
- `src/renderer/principal-window/views/SkillBrowserView/SkillInstallationModal.tsx`
- `src/renderer/principal-window/views/SkillBrowserView/InstallSkillToolbar.tsx`
- `src/renderer/main-process-api/GithubService.ts`
- `src/renderer/main-process-api/FileSystemService.ts`
- `src/renderer/main-process-api/SkillLockService.ts`
- `src/main/version-control-providers/githubHandlers.ts`
- `src/main/skills/skillLockHandlers.ts`
