# Skill Installation Bug Investigation

## Problem

When attempting to install a skill from a GitHub repository in browse mode, the installation fails with:

```
Error: File list is required for skill installation. The main process does not have the expertise to determine skill structure.
```

**Logs show:**
```javascript
skillFolderPath: "/Users/griever/.claude/skills/onboard otel canvas"
totalFiles: 0
files: []
```

## Components Involved

### 1. **SkillBrowserView** (`src/renderer/principal-window/views/SkillBrowserView/SkillBrowserView.tsx`)
   - Main view component that orchestrates GitHub skill browsing and installation
   - **Key functions:**
     - `handleFetchSkills()` (line 483) - Fetches GitHub repo tree
     - `convertGithubTreeToFileTree()` (line 417) - Converts GitHub tree to FileTree
     - `handleInstallSkillToDirectories()` (line 751) - Handles skill installation

### 2. **PathsFileTreeBuilder** (`@principal-ai/repository-abstraction`)
   - Builds FileTree structure from file paths
   - Called at line 446 with `rootPath: /${owner}/${repo}`
   - Creates `allFiles` array with `relativePath` property

### 3. **Skills List Panel** (`@industry-theme/agent-panels`)
   - Third-party panel that displays skills from a FileTree
   - Emits `skill:selected` event with Skill object
   - **Problem source:** Generates `skillFolderPath` property on Skill objects

### 4. **SkillInstallationModal** (`src/renderer/principal-window/views/SkillBrowserView/SkillInstallationModal.tsx`)
   - UI for selecting installation directories
   - Calls `onInstall(directoryIds)` which triggers `handleInstallSkillToDirectories()`

### 5. **GithubService / githubHandlers** (`src/main/version-control-providers/githubHandlers.ts`)
   - Main process handler for GitHub operations
   - **Validation at line 3313:** Rejects empty `fileList` arrays
   - Downloads files from GitHub and installs them locally

## Installation Flow

```
1. User loads GitHub repo
   └─> SkillBrowserView.handleFetchSkills()
       └─> GithubService.getTree() - Fetch repo tree
       └─> convertGithubTreeToFileTree() - Convert to FileTree
           └─> PathsFileTreeBuilder.build({
                 files: ['skills/onboard-otel-canvas/SKILL.md', ...],
                 rootPath: '/principal-ai/principal-view-core-library'
               })
           └─> setBrowseFileTree(fileTree)
           └─> actions.setFileTree(fileTree) - Pass to panels

2. Skills List Panel receives FileTree
   └─> Detects skills (directories with SKILL.md)
   └─> Creates Skill objects with skillFolderPath property

3. User selects skill
   └─> Skills List Panel emits 'skill:selected' event
   └─> SkillBrowserView receives event (line 315)
       └─> setSelectedSkill(payload.skill)

4. User clicks install
   └─> SkillInstallationModal opens
   └─> User selects directories
   └─> Calls handleInstallSkillToDirectories(directoryIds)

5. handleInstallSkillToDirectories() (line 751)
   └─> Gets skillFolderPath from selectedSkill
   └─> Filters browseFileTree.allFiles:
       const fileList = browseFileTree.allFiles
         .filter(file => file.relativePath.startsWith(skillFolderPath + '/'))
   └─> ❌ FILTER RETURNS EMPTY ARRAY
   └─> Calls GithubService.installSkill({ fileList: [] })
   └─> ❌ FAILS VALIDATION (line 3313 in githubHandlers.ts)
```

## The Bug

**The Path Mismatch:**

```javascript
// What skillFolderPath contains (from Skills List Panel):
skillFolderPath: "/Users/griever/.claude/skills/onboard otel canvas"
//                ^ Local absolute path

// What browseFileTree.allFiles contains (from PathsFileTreeBuilder):
[
  { relativePath: "skills/onboard-otel-canvas/SKILL.md" },
  { relativePath: "skills/onboard-otel-canvas/README.md" },
  // ...
]
//               ^ GitHub repo relative path
// OR possibly:
[
  { relativePath: "/principal-ai/principal-view-core-library/skills/onboard-otel-canvas/SKILL.md" }
]
//               ^ GitHub repo path with rootPath prepended
```

**The filter never matches** because:
- Comparing `/Users/griever/.claude/skills/onboard otel canvas/...`
- Against `skills/onboard-otel-canvas/...` (or `/principal-ai/principal-view-core-library/skills/...`)

## What We Know

1. ✅ GitHub tree is fetched successfully
2. ✅ FileTree is created successfully with files
3. ✅ Skills List Panel detects skills and displays them
4. ✅ Skill selection works
5. ❌ **Skill object has wrong `skillFolderPath`** (local path instead of repo path)
6. ❌ File filtering returns empty array

## What We Don't Know

1. **What format are paths in `browseFileTree.allFiles`?**
   - Are they `skills/name/file.md`?
   - Or `/owner/repo/skills/name/file.md`?

2. **Why does Skills List Panel generate local paths?**
   - Is it designed only for local installed skills?
   - Does it need to be configured for GitHub mode?
   - Is there a FileTree metadata property it should read?

## Next Steps to Debug

### Immediate: Add Debug Logging

In `SkillBrowserView.tsx` at line 762, add:

```typescript
const skillFolderPath = selectedSkill.skillFolderPath;

// DEBUG LOGGING
console.log('[DEBUG] ========== FILE LIST DEBUG ==========');
console.log('[DEBUG] skillFolderPath:', skillFolderPath);
console.log('[DEBUG] browseFileTree.allFiles sample (first 10):',
  browseFileTree.allFiles.slice(0, 10).map(f => ({
    relativePath: f.relativePath,
    absolutePath: f.absolutePath,
  }))
);
console.log('[DEBUG] browseFileTree.metadata:', browseFileTree.metadata);
console.log('[DEBUG] selectedSkill object:', selectedSkill);
console.log('[DEBUG] ========================================');

const fileList = browseFileTree.allFiles
  .filter(file => file.relativePath.startsWith(skillFolderPath + '/'))
  .map(file => file.relativePath);
```

Then attempt installation and capture console output.

### Investigation Paths

**Option A: Skills List Panel is wrong**
- The panel is generating local paths when it should use repo paths
- May need to update `@industry-theme/agent-panels` to handle GitHub repos
- Look for where panel creates Skill objects and fix path generation

**Option B: We need to transform the path**
- Add path transformation in `handleInstallSkillToDirectories()`
- Detect if `skillFolderPath` is local and map to GitHub repo path
- Use heuristics like skill name to find matching path in FileTree

**Option C: PathsFileTreeBuilder is adding rootPath incorrectly**
- Maybe we shouldn't pass `rootPath` parameter
- Or we need to strip it from `relativePath` after building

## Files to Examine

1. `@industry-theme/agent-panels` source (if available)
   - Find where Skill objects are created
   - See if there's a GitHub mode vs local mode

2. `@principal-ai/repository-abstraction`
   - `PathsFileTreeBuilder.ts` - What does `relativePath` actually contain?

3. Skills List Panel logs:
   - How does it detect skills from FileTree?
   - What properties does it read from FileTree?

## Potential Quick Fix

If we can't modify the Skills List Panel, add path normalization:

```typescript
const skillFolderPath = selectedSkill.skillFolderPath;

// Normalize path if it's a local absolute path
let normalizedPath = skillFolderPath;
if (skillFolderPath.startsWith('/Users/') || skillFolderPath.startsWith('/home/')) {
  // Extract skill name from local path
  const skillName = skillFolderPath.split('/').pop();
  // Find matching path in fileTree
  const matchingFile = browseFileTree.allFiles.find(f =>
    f.relativePath.includes(skillName)
  );
  if (matchingFile) {
    // Extract folder path
    normalizedPath = matchingFile.relativePath.split('/').slice(0, -1).join('/');
  }
}

const fileList = browseFileTree.allFiles
  .filter(file => file.relativePath.startsWith(normalizedPath + '/'))
  .map(file => file.relativePath);
```

---

**Status:** Investigation paused pending debug log output to confirm exact path formats.
