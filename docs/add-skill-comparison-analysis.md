# add-skill Library vs Current Skill Management System

**Analysis Date:** 2026-01-21
**Comparison:** [vercel-labs/add-skill](https://github.com/vercel-labs/add-skill) vs current backend implementation

---

## Executive Summary

This document compares the `add-skill` library (a CLI tool for installing agent skills) with our current skill management system to determine if we should migrate to using the library or adopt specific patterns from it.

**Recommendation:** Do NOT fully migrate, but adopt key patterns (canonical storage, agent detection, path sanitization).

---

## Table of Contents

1. [Architecture Comparison](#architecture-comparison)
2. [Feature Comparison](#feature-comparison)
3. [Key Differences](#key-differences)
4. [Migration Feasibility](#migration-feasibility)
5. [Hybrid Approach (Recommended)](#hybrid-approach-recommended)
6. [Implementation Plan](#implementation-plan)
7. [Code Examples](#code-examples)

---

## Architecture Comparison

### add-skill Library

**Purpose:** CLI tool for installing agent skills from git repositories to multiple AI coding agents

**Architecture:**
- Single canonical storage location: `.agents/skills/<skill-name>`
- Symlinks (or copies as fallback) to agent-specific directories
- Simple file-based discovery using `SKILL.md` with YAML frontmatter
- No backend/service layer - pure CLI tool
- Stateless (no database, minimal state tracking)

**Key Files:**
- `src/index.ts` - CLI entry point with commander.js
- `src/skills.ts` - Skill discovery logic
- `src/installer.ts` - Installation with symlink/copy modes
- `src/agents.ts` - Agent configuration and detection
- `src/source-parser.ts` - Parse git URLs, GitHub shorthand
- `src/git.ts` - Clone repositories

### Our Current System

**Purpose:** Full-featured skill management system integrated into an Electron app

**Architecture:**
- Multiple skill sources with priority system
- Rich backend services:
  - `SkillsDetectionService` - discovers skills
  - `SkillsConfigService` - manages configuration
  - `SkillsGitService` - Git operations
  - `SkillsSyncService` - synchronization
- IPC-based renderer ↔ main process communication
- GitHub integration with OAuth
- File watching and change detection
- Metadata tracking (`.metadata.json`)

**Key Files:**
- `src/main/file-system/fileSystemHandlers.ts` - File system operations
- `src/main/version-control-providers/githubHandlers.ts` - GitHub skill installation
- `src/main/services/SkillsDetectionService.ts` - Skill discovery
- `src/main/services/SkillsConfigService.ts` - Configuration management
- `src/main/services/SkillsGitService.ts` - Git operations
- `src/main/services/SkillsSyncService.ts` - Sync management
- `src/shared/main-process-api-interfaces/FileSystemAPI.ts` - Type definitions

---

## Feature Comparison

| Feature | add-skill | Our System |
|---------|-----------|------------|
| **Installation Sources** | Git repos (GitHub, GitLab, local) | GitHub repos + local filesystem |
| **Agent Support** | 16 agents (hardcoded list) | 5 agents (Agent, Claude, OpenCode, Cursor, Windsurf) |
| **Installation Modes** | Symlink (preferred) + copy fallback | Direct copy to destinations |
| **Skill Discovery** | Recursive SKILL.md search | SKILL.md with frontmatter validation |
| **Storage Strategy** | Canonical `.agents/skills/` + symlinks | Direct to agent directories |
| **Git Integration** | Clone/fetch for installation only | Full Git sync, versioning, conflict resolution |
| **Metadata Tracking** | None (relies on git) | Rich `.metadata.json` with provenance |
| **File Structure** | Any files in skill directory | SKILL.md + scripts/ + references/ + assets/ |
| **Progress Tracking** | Basic CLI prompts | Full UI integration with event system |
| **Conflict Resolution** | Overwrites with confirmation | Git-based merging + manual resolution UI |
| **Sync Features** | None | Auto-sync, multi-directory sync, pending changes |
| **Authentication** | System git credentials | OAuth2 with token refresh |
| **Skill Validation** | Requires `name` + `description` | Comprehensive frontmatter validation |
| **Multi-select** | Yes (CLI prompts) | Yes (UI) |
| **Background Operations** | No | Yes (file watching, auto-sync) |
| **Platform Support** | Cross-platform (Node.js) | Cross-platform (Electron) |
| **Symlink Fallback** | Yes (Windows junction/copy) | No |
| **Path Sanitization** | ✅ Yes (security) | ❌ No (vulnerability) |

---

## Key Differences

### 1. Scope & Philosophy

**add-skill:**
- Minimal, focused tool - "do one thing well" (install skills)
- CLI-first, scriptable
- Community-driven standard (agentskills.io)

**Our system:**
- Comprehensive platform - manage entire skill lifecycle
- GUI-first with rich UX
- Custom implementation for specific needs

### 2. State Management

**add-skill:**
- Stateless CLI
- Relies on filesystem as source of truth
- No configuration files

**Our system:**
- Stateful with config files
- File watchers for change detection
- Sync state tracking
- Pending changes queue

### 3. Installation Strategy

```
add-skill:
.agents/skills/my-skill/      (canonical copy)
  ├── SKILL.md
  └── ...
~/.claude/skills/my-skill/    (symlink → .agents/skills/my-skill)
~/.cursor/skills/my-skill/    (symlink → .agents/skills/my-skill)

Our system:
~/.agent/skills/my-skill/     (independent copy)
  ├── SKILL.md
  └── .metadata.json
~/.claude/skills/my-skill/    (independent copy)
  ├── SKILL.md
  └── .metadata.json
```

**Implications:**
- add-skill: Single source of truth, saves disk space, easier updates
- Our system: Independent copies, more resilient, survives directory deletions

### 4. Update Mechanisms

**add-skill:**
- Re-run installation command to update
- Git pull in canonical location
- Symlinks automatically reflect changes

**Our system:**
- Git sync service with configurable intervals
- Conflict resolution UI
- Per-directory sync configuration
- Pending changes workflow

### 5. Agent Support

**add-skill supports (16 total):**
- Amp, Antigravity, Claude Code, Clawdbot, Codex
- Cursor, Droid, Gemini CLI, GitHub Copilot
- Goose, Kilo Code, Kiro CLI, OpenCode, Roo Code
- Trae, Windsurf

**We support (5 total):**
- Agent (universal), Claude, OpenCode, Cursor, Windsurf

**Our `PRESET_SKILL_DIRECTORIES`:**
```typescript
{
  id: 'agent-universal',
  path: '{HOME}/.agent/skills',
  displayName: 'Agent',
},
{
  id: 'claude-specific',
  path: '{HOME}/.claude/skills',
  displayName: 'Claude',
},
{
  id: 'opencode',
  path: '{HOME}/.config/opencode/skill',  // Note: singular "skill"
  displayName: 'OpenCode',
},
{
  id: 'cursor-ide',
  path: '{HOME}/.cursor/skills',
  displayName: 'Cursor',
},
{
  id: 'windsurf',
  path: '{HOME}/.windsurf/skills',
  displayName: 'Windsurf',
}
```

### 6. Security

**add-skill (`src/installer.ts:26-40`):**
```typescript
function sanitizeName(name: string): string {
  let sanitized = name.replace(/[\/\\:\0]/g, '');
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  sanitized = sanitized.replace(/^\.+/, '');

  if (!sanitized || sanitized.length === 0) {
    sanitized = 'unnamed-skill';
  }

  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  return sanitized;
}
```

**Our system:**
- ❌ No path sanitization
- ⚠️ Potential path traversal vulnerability
- Accepts skill names directly from GitHub without validation

---

## Migration Feasibility

### Can You Use add-skill As-Is?

**No, for these reasons:**

1. **It's a CLI tool, not a library**
   - Designed for command-line use
   - Would need significant refactoring to integrate

2. **Missing features we need:**
   - No OAuth GitHub integration
   - No metadata tracking
   - No sync service
   - No conflict resolution
   - No file watching

3. **Different execution model:**
   - add-skill: One-time operations
   - Our system: Long-running service with background tasks

4. **State management mismatch:**
   - add-skill: Stateless
   - Our system: Requires state for sync, conflicts, pending changes

### What You Could Adopt

#### ✅ Canonical Storage Pattern (`src/installer.ts:61-64`)

**Value:**
- Store skills once in `.agents/skills/`
- Symlink to agent directories
- Saves disk space
- Single source of truth for updates

**Implementation Location:**
- `src/main/version-control-providers/githubHandlers.ts:installSkill()`

**Effort:** Medium (4-6 hours)

#### ✅ Agent Configuration System (`src/agents.ts:8-153`)

**Value:**
- Clean mapping of agent types to paths
- Detection logic for installed agents
- Easy to extend for new agents
- Community-aligned standards

**Implementation Location:**
- New file: `src/main/config/agentConfiguration.ts`
- Update: `src/main/services/SkillsDetectionService.ts`

**Effort:** Low (1-2 hours)

#### ✅ Skill Discovery Logic (`src/skills.ts:63-133`)

**Value:**
- Prioritized search paths (common locations first)
- Recursive fallback for edge cases
- Handles nested skill directories
- Efficient (stops when skills found)

**Implementation Location:**
- `src/main/services/SkillsDetectionService.ts:findSkillsInDirectory()`

**Effort:** Medium (2-3 hours)

#### ✅ Path Sanitization (`src/installer.ts:26-54`)

**Value:**
- **Critical security fix**
- Prevents path traversal attacks
- Handles edge cases (empty names, special characters)
- Length limiting (filesystem compatibility)

**Implementation Location:**
- `src/main/version-control-providers/githubHandlers.ts`
- Add before any file operations

**Effort:** Low (1 hour) - **High Priority**

### What You Would Lose

#### ❌ Rich Backend Services

**Services we've built:**
- `SkillsGitService` - Git operations
- `SkillsSyncService` - Auto-sync with intervals
- `SkillsConfigService` - Configuration management
- Conflict resolution system
- Pending changes tracking

**Impact:** High - Core functionality

#### ❌ OAuth GitHub Integration

**Our implementation:**
- Token management with refresh (`AuthService`)
- Rate limit handling
- Automatic token renewal

**add-skill has:**
- System git credentials only

**Impact:** High - User experience

#### ❌ Metadata Tracking

**Our `.metadata.json`:**
```json
{
  "installedFrom": "https://github.com/owner/repo",
  "skillPath": "skills/my-skill",
  "owner": "owner",
  "repo": "repo",
  "branch": "main",
  "installedAt": "2026-01-21T10:00:00Z",
  "destination": "global-claude",
  "files": ["SKILL.md", "scripts/setup.sh"],
  "syncEnabled": true,
  "lastSyncedAt": "2026-01-21T10:30:00Z"
}
```

**add-skill has:**
- Nothing (relies on git)

**Impact:** Medium - Provenance tracking, sync state

#### ❌ UI Integration

**Our integration:**
- Progress events via IPC
- Skill browser with preview
- Installation modal
- Conflict resolution dialogs

**add-skill has:**
- CLI prompts only

**Impact:** High - Cannot replace

#### ❌ Multi-Directory Management

**Our `GlobalSkillDirectory` system:**
```typescript
{
  id: string;
  path: string;
  displayName: string;
  enabled: boolean;
  isCustom: boolean;
  localClonePath: string;
  lastSyncedAt?: string;
  status?: { ... }
}
```

**add-skill has:**
- Single canonical location only

**Impact:** Medium - Power user feature

---

## Hybrid Approach (Recommended)

Instead of full migration, adopt specific patterns from add-skill while keeping our existing services.

### Phase 1: Adopt Canonical Storage (Low Risk)

**Goal:** Single source of truth for skill files

**Changes:**
1. Install skills to `.agents/skills/<skill-name>` (canonical location)
2. Create symlinks to agent-specific directories
3. Fallback to copy if symlink fails (Windows compatibility)

**File:** `src/main/version-control-providers/githubHandlers.ts`

**Benefits:**
- Reduces disk usage (one copy vs multiple)
- Simplifies updates (update canonical, all symlinks reflect changes)
- Maintains backward compatibility (works alongside existing direct copies)

**Risks:**
- Symlink support varies by platform (mitigated with copy fallback)
- Migration script needed for existing skills

### Phase 2: Adopt Agent Detection (Low Risk)

**Goal:** Standardized agent configuration

**Changes:**
1. Create agent configuration file based on add-skill's `agents.ts`
2. Update `SkillsDetectionService` to use configuration
3. Add detection logic for installed agents

**File:** Create `src/main/config/agentConfiguration.ts`

**Benefits:**
- Easier to add new agents (just add config entry)
- Standardized path handling
- Community-aligned (follows agentskills.io spec)
- Reduces hardcoded paths

**Risks:**
- Low (pure refactoring)

### Phase 3: Add Path Sanitization (Critical Security Fix)

**Goal:** Prevent path traversal attacks

**Changes:**
1. Add `sanitizeSkillName()` function
2. Apply to all skill name inputs before file operations
3. Add validation tests

**File:** `src/main/version-control-providers/githubHandlers.ts`

**Benefits:**
- **Prevents security vulnerability**
- Handles edge cases (special characters, empty names)
- Filesystem compatibility (255 char limit)

**Risks:**
- None (pure addition)

### Phase 4: Improve Skill Discovery (Medium Risk)

**Goal:** More robust skill detection

**Changes:**
1. Prioritized search in common locations
2. Recursive fallback for edge cases
3. Better handling of nested structures

**File:** `src/main/services/SkillsDetectionService.ts`

**Benefits:**
- Faster discovery (check common paths first)
- More reliable (handles edge cases)
- Consistent with add-skill behavior

**Risks:**
- Medium (changes core discovery logic)

---

## Implementation Plan

### Priority 1: Path Sanitization (1 hour)

**Why:** Critical security fix

**Steps:**
1. Add `sanitizeSkillName()` to `githubHandlers.ts`
2. Apply to skill name before all file operations
3. Add unit tests
4. Test with malicious inputs (`../../etc/passwd`, `skill/../../secret`, etc.)

**Code Location:**
```typescript
// src/main/version-control-providers/githubHandlers.ts

function sanitizeSkillName(name: string): string {
  // Remove path separators and dangerous characters
  let sanitized = name.replace(/[\/\\:\0]/g, '');

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');

  // Default if empty
  if (!sanitized || sanitized.length === 0) {
    sanitized = 'unnamed-skill';
  }

  // Limit length for filesystem compatibility
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  return sanitized;
}
```

### Priority 2: Agent Configuration (1-2 hours)

**Why:** Foundation for other improvements

**Steps:**
1. Create `src/main/config/agentConfiguration.ts`
2. Define agent types and paths
3. Add detection logic
4. Update `SkillsDetectionService.getPresets()`

**Code Location:**
```typescript
// src/main/config/agentConfiguration.ts

export type AgentType = 'agent' | 'claude' | 'opencode' | 'cursor' | 'windsurf';

export interface AgentConfig {
  name: string;
  displayName: string;
  skillsDir: string;           // Project-level
  globalSkillsDir: string;     // Global
  detectInstalled: () => Promise<boolean>;
}

export const agents: Record<AgentType, AgentConfig> = {
  agent: {
    name: 'agent',
    displayName: 'Agent (Universal)',
    skillsDir: '.agent/skills',
    globalSkillsDir: join(homedir(), '.agent/skills'),
    detectInstalled: async () => existsSync(join(homedir(), '.agent')),
  },
  // ... claude, opencode, cursor, windsurf
};
```

### Priority 3: Canonical Storage (4-6 hours)

**Why:** Major architectural improvement

**Steps:**
1. Add symlink creation function with fallback
2. Update `installSkill()` to use canonical location
3. Create migration script for existing skills
4. Test on Windows, macOS, Linux

**Code Location:**
```typescript
// src/main/version-control-providers/githubHandlers.ts

async function createSymlink(target: string, linkPath: string): Promise<boolean> {
  try {
    // Check if symlink already exists and points to correct target
    try {
      const stats = await lstat(linkPath);
      if (stats.isSymbolicLink()) {
        const existingTarget = await readlink(linkPath);
        if (resolve(existingTarget) === resolve(target)) {
          return true; // Already correct
        }
        await rm(linkPath); // Remove old symlink
      } else {
        await rm(linkPath, { recursive: true }); // Remove regular file/dir
      }
    } catch (err) {
      // Doesn't exist yet, that's fine
    }

    // Create parent directory
    await mkdir(dirname(linkPath), { recursive: true });

    // Calculate relative path from link to target
    const relativePath = relative(dirname(linkPath), target);

    // Use junction on Windows, symlink on Unix
    const symlinkType = platform() === 'win32' ? 'junction' : undefined;

    await symlink(relativePath, linkPath, symlinkType);
    return true;
  } catch (error) {
    console.warn('[GitHub] Symlink creation failed, will use copy fallback:', error);
    return false;
  }
}
```

### Priority 4: Skill Discovery (2-3 hours)

**Why:** Better performance and reliability

**Steps:**
1. Add prioritized search paths to `SkillsDetectionService`
2. Implement recursive fallback
3. Update tests
4. Benchmark performance

**Code Location:**
```typescript
// src/main/services/SkillsDetectionService.ts

private async findSkillsInDirectory(dirPath: string): Promise<string[]> {
  const skills: string[] = [];

  // Priority search paths (check common locations first)
  const prioritySearchDirs = [
    dirPath,
    join(dirPath, 'skills'),
    join(dirPath, 'skills/.curated'),
    join(dirPath, 'skills/.experimental'),
    join(dirPath, '.agent/skills'),
    join(dirPath, '.claude/skills'),
    // ... more paths
  ];

  // Search priority paths
  for (const searchDir of prioritySearchDirs) {
    if (await this.hasSkillMd(searchDir)) {
      skills.push(searchDir);
    }

    // Check subdirectories
    try {
      const entries = await readdir(searchDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = join(searchDir, entry.name);
          if (await this.hasSkillMd(skillDir)) {
            skills.push(skillDir);
          }
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  // Fallback: recursive search if nothing found
  if (skills.length === 0) {
    return this.recursiveSkillSearch(dirPath);
  }

  return skills;
}
```

---

## Code Examples

### Example 1: Canonical Installation with Symlink

```typescript
// src/main/version-control-providers/githubHandlers.ts

interface InstallLocation {
  canonical: string;
  agentPaths: string[];
}

function getInstallLocations(
  skillName: string,
  destinations: string[]
): InstallLocation {
  const homeDir = app.getPath('home');

  // Sanitize skill name first
  const sanitizedName = sanitizeSkillName(skillName);

  // Canonical location (single source of truth)
  const canonical = path.join(homeDir, '.agents', 'skills', sanitizedName);

  // Agent-specific locations (will be symlinks)
  const agentPaths = destinations.map(dest => {
    switch (dest) {
      case 'global-universal':
        return path.join(homeDir, '.agent', 'skills', sanitizedName);
      case 'global-claude':
        return path.join(homeDir, '.claude', 'skills', sanitizedName);
      case 'global-opencode':
        return path.join(homeDir, '.config', 'opencode', 'skill', sanitizedName);
      case 'global-cursor':
        return path.join(homeDir, '.cursor', 'skills', sanitizedName);
      case 'global-windsurf':
        return path.join(homeDir, '.windsurf', 'skills', sanitizedName);
      default:
        throw new Error(`Invalid destination: ${dest}`);
    }
  });

  return { canonical, agentPaths };
}

// Updated installSkill handler
async function installSkill(options: InstallSkillOptions): Promise<InstallSkillResult> {
  const { skillName, fileList, destination } = options;

  // Get installation locations
  const locations = getInstallLocations(skillName, [destination]);

  // 1. Install to canonical location
  await mkdir(locations.canonical, { recursive: true });

  for (const file of downloadedFiles) {
    const fullPath = path.join(locations.canonical, file.relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, 'utf-8');
  }

  // 2. Create metadata in canonical location
  const metadata = {
    installedFrom: githubUrl,
    skillPath: normalizedSkillPath,
    owner, repo, branch,
    installedAt: new Date().toISOString(),
    destinations: [destination],
    files: installedFiles,
  };

  await writeFile(
    path.join(locations.canonical, '.metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  // 3. Create symlinks to agent directories
  const symlinkResults = [];
  for (const agentPath of locations.agentPaths) {
    const symlinkCreated = await createSymlink(locations.canonical, agentPath);

    if (!symlinkCreated) {
      // Fallback: copy to agent directory
      console.warn(`[GitHub] Symlink failed for ${agentPath}, using copy fallback`);
      await mkdir(agentPath, { recursive: true });
      await copyDirectory(locations.canonical, agentPath);
      symlinkResults.push({ path: agentPath, method: 'copy' });
    } else {
      symlinkResults.push({ path: agentPath, method: 'symlink' });
    }
  }

  return {
    success: true,
    installedPath: locations.canonical,
    agentPaths: symlinkResults,
    filesInstalled: installedFiles,
  };
}
```

### Example 2: Agent Configuration System

```typescript
// src/main/config/agentConfiguration.ts

import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

export type AgentType = 'agent' | 'claude' | 'opencode' | 'cursor' | 'windsurf';

export interface AgentConfig {
  name: string;
  displayName: string;
  skillsDir: string;           // Relative path for project-level
  globalSkillsDir: string;     // Absolute path for global
  icon?: string;
  detectInstalled: () => Promise<boolean>;
}

const home = homedir();

export const agents: Record<AgentType, AgentConfig> = {
  agent: {
    name: 'agent',
    displayName: 'Agent (Universal)',
    skillsDir: '.agent/skills',
    globalSkillsDir: join(home, '.agent/skills'),
    icon: '🤖',
    detectInstalled: async () => existsSync(join(home, '.agent')),
  },

  claude: {
    name: 'claude',
    displayName: 'Claude',
    skillsDir: '.claude/skills',
    globalSkillsDir: join(home, '.claude/skills'),
    icon: '🎯',
    detectInstalled: async () => existsSync(join(home, '.claude')),
  },

  opencode: {
    name: 'opencode',
    displayName: 'OpenCode',
    skillsDir: '.opencode/skills',
    globalSkillsDir: join(home, '.config/opencode/skill'),
    icon: '💻',
    detectInstalled: async () => existsSync(join(home, '.config/opencode')),
  },

  cursor: {
    name: 'cursor',
    displayName: 'Cursor IDE',
    skillsDir: '.cursor/skills',
    globalSkillsDir: join(home, '.cursor/skills'),
    icon: '⌨️',
    detectInstalled: async () => existsSync(join(home, '.cursor')),
  },

  windsurf: {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: '.windsurf/skills',
    globalSkillsDir: join(home, '.windsurf/skills'),
    icon: '🌊',
    detectInstalled: async () => existsSync(join(home, '.codeium/windsurf')),
  },
};

export async function detectInstalledAgents(): Promise<AgentType[]> {
  const installed: AgentType[] = [];

  for (const [type, config] of Object.entries(agents)) {
    if (await config.detectInstalled()) {
      installed.push(type as AgentType);
    }
  }

  return installed;
}

export function getAgentConfig(type: AgentType): AgentConfig {
  return agents[type];
}

export function getAllAgentTypes(): AgentType[] {
  return Object.keys(agents) as AgentType[];
}
```

### Example 3: Migration Script for Existing Skills

```typescript
// src/main/services/SkillsMigrationService.ts

import { app } from 'electron';
import { join } from 'path';
import { readdir, stat, readFile, writeFile, mkdir, symlink, rm } from 'fs/promises';
import { agents, type AgentType } from '../config/agentConfiguration';

interface MigrationResult {
  success: boolean;
  skillsMigrated: number;
  symlinksCreated: number;
  errors: string[];
}

export class SkillsMigrationService {
  private homeDir = app.getPath('home');
  private canonicalDir = join(this.homeDir, '.agents', 'skills');

  /**
   * Migrate existing skills from agent-specific directories to canonical location
   */
  async migrateToCanonicalStorage(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      skillsMigrated: 0,
      symlinksCreated: 0,
      errors: [],
    };

    console.log('[Migration] Starting skill migration to canonical storage');

    // Create canonical directory
    await mkdir(this.canonicalDir, { recursive: true });

    // Track skills we've seen (avoid duplicates)
    const seenSkills = new Set<string>();

    // Migrate from each agent directory
    for (const [agentType, config] of Object.entries(agents)) {
      try {
        const agentSkillsDir = config.globalSkillsDir;

        console.log(`[Migration] Checking ${agentType} directory: ${agentSkillsDir}`);

        // Check if directory exists
        try {
          await stat(agentSkillsDir);
        } catch {
          console.log(`[Migration] Directory doesn't exist, skipping: ${agentSkillsDir}`);
          continue;
        }

        // List all skills in this directory
        const entries = await readdir(agentSkillsDir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const skillName = entry.name;
          const skillPath = join(agentSkillsDir, skillName);
          const canonicalSkillPath = join(this.canonicalDir, skillName);

          // Skip if we've already migrated this skill
          if (seenSkills.has(skillName)) {
            console.log(`[Migration] Skill already migrated, creating symlink: ${skillName}`);

            // Replace with symlink
            await rm(skillPath, { recursive: true });
            await symlink(canonicalSkillPath, skillPath);
            result.symlinksCreated++;

            continue;
          }

          // Verify it's a valid skill (has SKILL.md)
          const hasSkillMd = await this.hasSkillMd(skillPath);
          if (!hasSkillMd) {
            console.log(`[Migration] Skipping non-skill directory: ${skillName}`);
            continue;
          }

          console.log(`[Migration] Migrating skill: ${skillName}`);

          // Move to canonical location
          await this.moveDirectory(skillPath, canonicalSkillPath);

          // Create symlink back to agent directory
          await symlink(canonicalSkillPath, skillPath);

          seenSkills.add(skillName);
          result.skillsMigrated++;
          result.symlinksCreated++;

          console.log(`[Migration] ✓ Migrated ${skillName} to canonical location`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate ${agentType}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Migration] ${errorMsg}`);
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    console.log('[Migration] Migration complete:', result);
    return result;
  }

  private async hasSkillMd(dirPath: string): Promise<boolean> {
    try {
      const skillMdPath = join(dirPath, 'SKILL.md');
      const stats = await stat(skillMdPath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  private async moveDirectory(src: string, dest: string): Promise<void> {
    // Create destination
    await mkdir(dest, { recursive: true });

    // Copy all files
    await this.copyDirectoryRecursive(src, dest);

    // Remove source
    await rm(src, { recursive: true });
  }

  private async copyDirectoryRecursive(src: string, dest: string): Promise<void> {
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await mkdir(destPath, { recursive: true });
        await this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        const content = await readFile(srcPath);
        await writeFile(destPath, content);
      }
    }
  }
}
```

---

## What NOT to Adopt

### 1. CLI Interface
- **Why:** We have a rich GUI application
- **Keep:** Our Electron UI with IPC communication

### 2. Stateless Design
- **Why:** Our sync features require state tracking
- **Keep:** Configuration files, sync state, pending changes

### 3. Telemetry
- **Why:** We may want our own analytics or none at all
- **Don't Adopt:** add-skill's telemetry system

### 4. Prompts Library (@clack/prompts)
- **Why:** We use UI dialogs, not CLI prompts
- **Keep:** Our modal/dialog system

### 5. Simple Git Clone-Only Approach
- **Why:** We have sophisticated Git sync with OAuth
- **Keep:** Our GitHub integration and sync services

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/sanitizeSkillName.test.ts

import { sanitizeSkillName } from '../src/main/version-control-providers/githubHandlers';

describe('sanitizeSkillName', () => {
  it('should remove path separators', () => {
    expect(sanitizeSkillName('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeSkillName('skill/../../../secret')).toBe('skillsecret');
    expect(sanitizeSkillName('evil\\path\\here')).toBe('evilpathhere');
  });

  it('should remove leading dots', () => {
    expect(sanitizeSkillName('...hidden')).toBe('hidden');
    expect(sanitizeSkillName('.secret')).toBe('secret');
  });

  it('should handle empty results', () => {
    expect(sanitizeSkillName('')).toBe('unnamed-skill');
    expect(sanitizeSkillName('...')).toBe('unnamed-skill');
    expect(sanitizeSkillName('///')).toBe('unnamed-skill');
  });

  it('should limit length', () => {
    const longName = 'a'.repeat(300);
    expect(sanitizeSkillName(longName)).toHaveLength(255);
  });
});
```

### Integration Tests

```typescript
// tests/integration/canonicalInstallation.test.ts

import { installSkill } from '../src/main/version-control-providers/githubHandlers';
import { existsSync, lstatSync, readlinkSync } from 'fs';
import { join } from 'path';

describe('Canonical Installation', () => {
  it('should install to canonical location', async () => {
    const result = await installSkill({
      skillName: 'test-skill',
      destination: 'global-claude',
      // ... other options
    });

    const canonicalPath = join(homedir(), '.agents', 'skills', 'test-skill');
    expect(existsSync(canonicalPath)).toBe(true);
    expect(existsSync(join(canonicalPath, 'SKILL.md'))).toBe(true);
  });

  it('should create symlink to agent directory', async () => {
    await installSkill({
      skillName: 'test-skill',
      destination: 'global-claude',
    });

    const agentPath = join(homedir(), '.claude', 'skills', 'test-skill');
    expect(existsSync(agentPath)).toBe(true);

    const stats = lstatSync(agentPath);
    expect(stats.isSymbolicLink()).toBe(true);

    const target = readlinkSync(agentPath);
    expect(target).toContain('.agents/skills/test-skill');
  });

  it('should fallback to copy if symlink fails', async () => {
    // Mock symlink failure
    // ... test copy fallback
  });
});
```

---

## Timeline Estimate

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| Path Sanitization | Critical | 1 hour | None |
| Agent Configuration | High | 1-2 hours | None |
| Canonical Storage | Medium | 4-6 hours | Agent Configuration |
| Skill Discovery | Low | 2-3 hours | None |
| Migration Script | Medium | 3-4 hours | Canonical Storage |
| Testing | High | 2-3 hours | All phases |

**Total Estimated Time:** 13-19 hours

---

## Risks & Mitigation

### Risk 1: Symlink Support on Windows

**Risk:** Windows requires developer mode or admin rights for symlinks

**Mitigation:**
- Implement copy fallback (like add-skill does)
- Use junction points on Windows (works without admin)
- Inform users about Developer Mode for true symlinks

### Risk 2: Breaking Existing Installations

**Risk:** Users have skills installed in current locations

**Mitigation:**
- Support both old (direct copy) and new (canonical+symlink) simultaneously
- Provide migration script with dry-run option
- Add detection logic to identify migration status

### Risk 3: Performance Impact

**Risk:** Symlink traversal might be slower on some filesystems

**Mitigation:**
- Benchmark read performance on symlinks vs direct files
- Consider making canonical storage opt-in initially
- Monitor performance metrics after rollout

---

## Decision Matrix

Use this to decide which patterns to adopt:

| Pattern | Value | Effort | Risk | Recommendation |
|---------|-------|--------|------|----------------|
| **Path Sanitization** | ⭐⭐⭐⭐⭐ Critical security fix | 1h | Low | **ADOPT** |
| **Agent Configuration** | ⭐⭐⭐⭐ Better maintainability | 1-2h | Low | **ADOPT** |
| **Canonical Storage** | ⭐⭐⭐⭐ Saves space, easier updates | 4-6h | Medium | **ADOPT** |
| **Skill Discovery** | ⭐⭐⭐ Better performance | 2-3h | Low | **ADOPT** |
| **CLI Interface** | ⭐ Not applicable | High | N/A | **SKIP** |
| **Telemetry** | ⭐ Privacy concerns | Low | Low | **SKIP** |
| **Stateless Design** | ⭐ Incompatible | High | High | **SKIP** |

---

## Conclusion

**Recommendation:** Adopt a hybrid approach

1. ✅ **Adopt immediately:** Path sanitization (security fix)
2. ✅ **Adopt soon:** Agent configuration, canonical storage
3. ✅ **Consider:** Skill discovery improvements
4. ❌ **Don't adopt:** CLI interface, stateless design, telemetry

**Rationale:**
- add-skill has excellent **patterns** for skill management
- Our system has superior **features** for our use case
- The best outcome is **combining both strengths**

The add-skill library is a well-designed CLI tool that follows community standards. However, it's designed for a different use case (one-time installations via CLI) versus our integrated, GUI-based, sync-enabled skill management system.

By adopting their architectural patterns while keeping our feature set, we get:
- Better code organization
- Industry-standard conventions
- Security improvements
- Maintained feature richness

---

## References

- [add-skill GitHub Repository](https://github.com/vercel-labs/add-skill)
- [Agent Skills Specification](https://agentskills.io)
- [Our skill-installation-refactor.md](./skill-installation-refactor.md)
- Our code:
  - `src/main/version-control-providers/githubHandlers.ts:3256-3450`
  - `src/main/services/SkillsDetectionService.ts`
  - `src/shared/main-process-api-interfaces/FileSystemAPI.ts:70-236`

---

**Document Version:** 1.0
**Last Updated:** 2026-01-21
**Author:** Analysis based on code review and comparison
