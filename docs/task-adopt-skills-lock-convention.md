# Task: Adopt add-skill Lock File Convention for Skill Versioning

## Overview

Migrate the electron-app's skill installation system to use the versioning convention from [vercel-labs/add-skill](https://github.com/vercel-labs/add-skill). This provides a standardized, CLI-compatible approach to tracking installed skills and their versions.

## Current State

The electron-app currently:
- Creates per-skill `.metadata.json` files with provenance info
- Stores `skillTreeSha` for update detection in the UI
- Has no centralized lock file for all installed skills
- Cannot interoperate with the `npx skills check` / `npx skills update` CLI

## Target State

Adopt the add-skill lock file convention:
- Centralized `~/.agents/.skill-lock.json` file
- Standardized schema for version tracking
- Interoperability with `npx skills check` and `npx skills update`
- Backward compatibility with existing `.metadata.json` files (optional)

## Lock File Specification

### Location
```
~/.agents/.skill-lock.json
```

### Schema (v3)
```typescript
interface SkillLockEntry {
  source: string;           // Normalized source (e.g., "owner/repo")
  sourceType: string;       // "github" | "mintlify" | "huggingface" | "local"
  sourceUrl: string;        // Original URL for re-fetching
  skillPath?: string;       // Subpath within repo (e.g., "skills/react/SKILL.md")
  skillFolderHash: string;  // GitHub tree SHA for the skill folder
  installedAt: string;      // ISO timestamp
  updatedAt: string;        // ISO timestamp
}

interface SkillLockFile {
  version: 3;
  skills: Record<string, SkillLockEntry>;  // keyed by skill name
  dismissed?: Record<string, string>;       // dismissed prompts
  lastSelectedAgents?: string[];            // UI preference
}
```

### Example
```json
{
  "version": 3,
  "skills": {
    "react-best-practices": {
      "source": "anthropics/skills",
      "sourceType": "github",
      "sourceUrl": "https://github.com/anthropics/skills",
      "skillPath": "skills/react-best-practices/SKILL.md",
      "skillFolderHash": "abc123def456...",
      "installedAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-20T14:45:00.000Z"
    }
  }
}
```

## Implementation Tasks

### Phase 1: Lock File Integration

1. **Create lock file utilities** (`src/main/skills/skillLockFile.ts`)
   - `readSkillLock(): Promise<SkillLockFile>`
   - `writeSkillLock(lock: SkillLockFile): Promise<void>`
   - `addSkillToLock(name: string, entry: SkillLockEntry): Promise<void>`
   - `removeSkillFromLock(name: string): Promise<void>`
   - `getSkillFromLock(name: string): SkillLockEntry | undefined`

2. **Fetch GitHub tree SHA** (`src/main/skills/githubTreeSha.ts`)
   - Use GitHub Trees API: `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`
   - Extract tree SHA for specific skill folder path
   - Handle private repos gracefully (skip hash, still track)

3. **Update `INSTALL_SKILL` handler** (`githubHandlers.ts`)
   - After successful installation, call `addSkillToLock()`
   - Compute `skillFolderHash` from GitHub API
   - Populate all required fields

### Phase 2: Update Detection

4. **Add update check service** (`src/main/skills/skillUpdateService.ts`)
   - Compare installed `skillFolderHash` against current GitHub tree SHA
   - Return list of skills with available updates
   - Cache results to avoid excessive API calls

5. **Expose via IPC**
   - `skills:check-updates` - returns skills with updates available
   - `skills:get-installed` - returns all tracked skills from lock file

6. **UI integration**
   - Show update indicator in SkillBrowserView for outdated skills
   - Add "Check for Updates" button in toolbar
   - Display last updated timestamp

### Phase 3: Update Mechanism

7. **Add update handler**
   - `skills:update` IPC event
   - Re-downloads skill files from GitHub
   - Updates `skillFolderHash` and `updatedAt` in lock file

8. **Batch update support**
   - "Update All" functionality
   - Progress reporting for multiple updates

### Phase 4: Migration & Compatibility

9. **Migrate existing installations**
   - Scan known skill directories for existing skills
   - Read `.metadata.json` files if present
   - Populate lock file entries (without hash if not available)

10. **Maintain `.metadata.json` compatibility** (optional)
    - Continue writing `.metadata.json` for backward compatibility
    - Lock file becomes source of truth for versioning

## File Changes Summary

| File | Change |
|------|--------|
| `src/main/skills/skillLockFile.ts` | New - lock file read/write |
| `src/main/skills/githubTreeSha.ts` | New - fetch tree SHA |
| `src/main/skills/skillUpdateService.ts` | New - update checking |
| `src/main/version-control-providers/githubHandlers.ts` | Modify - add lock file writes |
| `src/shared/main-process-api-interfaces/GitHubAPI.ts` | Modify - add new IPC types |
| `src/renderer/.../SkillBrowserView.tsx` | Modify - show update status |
| `src/renderer/.../InstallSkillToolbar.tsx` | Modify - add check updates button |

## API Endpoints (Optional Enhancement)

For bulk update checking, consider using the add-skill telemetry server:
```
POST https://add-skill.vercel.sh/check-updates
{
  "skills": [
    { "name": "...", "source": "...", "path": "...", "skillFolderHash": "..." }
  ]
}
```

This avoids making individual GitHub API calls and handles rate limiting.

## Testing Checklist

- [ ] Lock file created on first skill install
- [ ] Lock file updated correctly on subsequent installs
- [ ] Tree SHA fetched correctly for public repos
- [ ] Private repos handled gracefully (no hash, still tracked)
- [ ] Update detection works for changed skills
- [ ] Update mechanism re-downloads and updates lock
- [ ] Migration correctly imports existing skills
- [ ] CLI `npx skills check` recognizes electron-app installed skills

## References

- [add-skill source](https://github.com/vercel-labs/add-skill)
- Lock file implementation: `add-skill/src/skill-lock.ts`
- Check/update commands: `add-skill/src/cli.ts` (lines 329-537)
- Tree SHA fetching: `add-skill/src/skill-lock.ts` (`fetchSkillFolderHash`)
