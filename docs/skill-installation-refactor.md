# Skill Installation Refactor

## Problem Statement

When users try to install a skill from the Skills Browser, the installation modal gets stuck showing "Applying..." indefinitely and never completes.

## Root Cause Analysis

### Current Flow

1. **Renderer**: User loads GitHub repo in Skills Browser
   - Fetches repository info (owner, repo, branch)
   - Fetches entire file tree via `GithubService.getTree()`
   - Displays skills in UI

2. **Renderer**: User clicks Install on a skill
   - Sends GitHub URL + skill path to main process via IPC
   - Shows "Applying..." modal

3. **Main Process**: `githubHandlers.ts:installSkill()`
   - Re-fetches repository info from GitHub API
   - Re-fetches entire file tree from GitHub API
   - Downloads each file one-by-one from GitHub API
   - Writes files to local disk
   - Creates `.metadata.json`

### The Issue

The main process `fetch()` calls (line 127 in `githubHandlers.ts`) have **no timeout mechanism**. If:
- GitHub API is slow
- Network is unstable
- Rate limit is hit
- Any network issue occurs

The promise hangs indefinitely, keeping the modal stuck in "Applying..." state.

### Why This is Inefficient

The renderer **already has all the information needed**:
- ✅ Repository metadata (owner, repo, branch)
- ✅ Complete file tree with all paths
- ✅ GitHub adapter configured and ready
- ✅ File contents available via `githubAdapter.readFile()`

But the main process **re-fetches everything**, duplicating:
- Network calls (wasting time)
- GitHub API quota (could hit rate limits)
- Failure points (more things that can timeout)

## Proposed Solution

### New Flow

1. **Renderer**: User loads GitHub repo in Skills Browser
   - *(Same as before - no change)*

2. **Renderer**: User clicks Install on a skill
   - **NEW**: Filter `fileTreeData.allFiles` to get all skill files
   - **NEW**: Read all file contents in parallel via `githubAdapter.readFile()`
   - **NEW**: Package files + metadata into a "skill package"
   - Send package to main process via IPC
   - Show "Applying..." modal

3. **Main Process**: New `installSkillFromPackage()` handler
   - **NEW**: Receives pre-loaded files (no network calls!)
   - Writes files to local disk
   - Creates `.metadata.json`
   - Returns success/error

### Skill Folder Structure

A complete skill can contain:

```
skill-name/
├── SKILL.md           # Main skill definition (required)
├── scripts/           # Optional: executable scripts
│   └── setup.sh
├── references/        # Optional: reference documentation
│   └── api-docs.md
├── assets/            # Optional: images, files
│   └── logo.png
└── .metadata.json     # Created during install (provenance tracking)
```

All files in the skill folder path must be copied during installation.

## Implementation Plan

### 1. Renderer Changes

#### File: `SkillBrowserView.tsx`

Update `handleInstallSkillToDirectories()`:

```typescript
const handleInstallSkillToDirectories = useCallback(
  async (directoryIds: string[]) => {
    if (!selectedSkill || !githubRepoInfo || !fileTreeData || !githubAdapter) {
      throw new Error('Missing required data for installation');
    }

    // Filter all files that belong to this skill
    const skillFiles = fileTreeData.allFiles.filter(file =>
      file.relativePath.startsWith(selectedSkill.path + '/')
    );

    console.log('[SkillBrowserView] Found skill files:', {
      skillPath: selectedSkill.path,
      fileCount: skillFiles.length,
      files: skillFiles.map(f => f.relativePath),
    });

    // Read all file contents in parallel
    const filesWithContent = await Promise.all(
      skillFiles.map(async (file) => ({
        relativePath: file.relativePath.substring(selectedSkill.path.length + 1), // Make relative to skill folder
        content: await githubAdapter.readFile(file.relativePath),
        size: file.size,
      }))
    );

    // Install to each directory
    for (const directoryId of directoryIds) {
      console.log('[SkillBrowserView] Installing skill package to:', directoryId);

      const result = await FileSystemService.installSkillFromPackage({
        files: filesWithContent,
        skillName: selectedSkill.name,
        skillPath: selectedSkill.path,
        destination: directoryId as SkillDestination,
        metadata: {
          installedFrom: `https://github.com/${githubRepoInfo.owner}/${githubRepoInfo.repo}`,
          skillPath: selectedSkill.path,
          owner: githubRepoInfo.owner,
          repo: githubRepoInfo.repo,
          branch: githubRepoInfo.branch,
          installedAt: new Date().toISOString(),
          sha: fileTreeData.sha,
        },
      });

      if (!result.success) {
        throw new Error(result.error || `Installation to ${directoryId} failed`);
      }

      console.log('[SkillBrowserView] Skill installed successfully to:', directoryId);

      // Emit event to refresh global skills cache
      actions.notifyPanels({
        type: 'skill:installed',
        payload: {
          skillName: selectedSkill.name,
          destination: directoryId as SkillDestination,
          installedPath: result.installedPath,
        },
      });
    }

    // Refresh installed skills
    await loadInstalledSkills();
  },
  [selectedSkill, githubRepoInfo, fileTreeData, githubAdapter, actions, loadInstalledSkills],
);
```

### 2. Add FileSystemService Method

#### File: `src/renderer/main-process-api/FileSystemService.ts`

Add new method:

```typescript
static async installSkillFromPackage(options: InstallSkillPackageOptions): Promise<InstallSkillResult> {
  const result = await window.mainProcess.fileSystem.installSkillFromPackage(options);
  return result;
}
```

### 3. Define New Types

#### File: `src/shared/main-process-api-interfaces/FileSystemAPI.ts`

```typescript
export interface InstallSkillPackageOptions {
  files: Array<{
    relativePath: string;  // Path relative to skill folder (e.g., "SKILL.md", "scripts/setup.sh")
    content: string;
    size: number;
  }>;
  skillName: string;
  skillPath: string;        // Original GitHub path (e.g., "skills/brand-guidelines")
  destination: SkillDestination;
  metadata: {
    installedFrom: string;
    skillPath: string;
    owner: string;
    repo: string;
    branch: string;
    installedAt: string;
    sha: string;
  };
}

export interface InstallSkillResult {
  success: boolean;
  installedPath?: string;
  filesInstalled?: string[];
  error?: string;
}
```

### 4. Main Process Handler

#### File: `src/main/file-system-service.ts`

Add new IPC handler:

```typescript
export enum FileSystemEvent {
  // ... existing events ...
  INSTALL_SKILL_FROM_PACKAGE = 'fileSystem:install-skill-from-package',
}

// In registerFileSystemHandlers():
ipcMain.handle(
  FileSystemEvent.INSTALL_SKILL_FROM_PACKAGE,
  async (event, options: InstallSkillPackageOptions): Promise<InstallSkillResult> => {
    try {
      const { files, skillName, destination, metadata } = options;

      console.log('[FileSystem] installSkillFromPackage called:', {
        skillName,
        destination,
        fileCount: files.length,
      });

      // Determine installation destination
      const homeDir = app.getPath('home');
      let destPath: string;

      switch (destination) {
        case 'global-universal':
          destPath = path.join(homeDir, '.agent', 'skills', skillName);
          break;
        case 'global-claude':
          destPath = path.join(homeDir, '.claude', 'skills', skillName);
          break;
        case 'global-opencode':
          destPath = path.join(homeDir, '.config', 'opencode', 'skill', skillName);
          break;
        case 'global-cursor':
          destPath = path.join(homeDir, '.cursor', 'skills', skillName);
          break;
        case 'global-windsurf':
          destPath = path.join(homeDir, '.windsurf', 'skills', skillName);
          break;
        case 'project-universal':
          // Would need repositoryPath - TBD
          return {
            success: false,
            error: 'Project installation not yet supported in new flow',
          };
        case 'project-claude':
          // Would need repositoryPath - TBD
          return {
            success: false,
            error: 'Project installation not yet supported in new flow',
          };
        default:
          return {
            success: false,
            error: `Invalid destination: ${destination}`,
          };
      }

      // Create destination directory
      await fsPromises.mkdir(destPath, { recursive: true });

      // Write all files
      const installedFiles: string[] = [];
      for (const file of files) {
        const fullPath = path.join(destPath, file.relativePath);

        // Create parent directories
        await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });

        // Write file
        await fsPromises.writeFile(fullPath, file.content, 'utf-8');
        installedFiles.push(file.relativePath);

        console.log(`[FileSystem] Installed skill file: ${file.relativePath}`);
      }

      // Create metadata file
      const metadataPath = path.join(destPath, '.metadata.json');
      await fsPromises.writeFile(
        metadataPath,
        JSON.stringify({ ...metadata, files: installedFiles }, null, 2),
        'utf-8'
      );
      console.log(`[FileSystem] Created metadata file: ${metadataPath}`);

      console.log(`[FileSystem] Skill installed successfully to: ${destPath}`);

      return {
        success: true,
        installedPath: destPath,
        filesInstalled: installedFiles,
      };
    } catch (error) {
      console.error('[FileSystem] Failed to install skill package:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);
```

### 5. Wire Up IPC

#### File: `src/window/main-process-api-implementations/fileSystemApi.ts`

```typescript
installSkillFromPackage: async (options: InstallSkillPackageOptions) => {
  return ipcRenderer.invoke(FileSystemEvent.INSTALL_SKILL_FROM_PACKAGE, options);
},
```

## Benefits

### Performance
- **Faster**: No redundant network calls in main process
- **Parallel**: File downloads happen concurrently in renderer
- **Cached**: Could add content caching in `GitHubFileSystemAdapter` later

### Reliability
- **No timeouts**: Main process only does fast disk I/O
- **Better errors**: File read errors surface immediately in renderer
- **Progress**: Could add download progress UI (e.g., "Downloading 5/12 files...")

### Efficiency
- **Less API usage**: Don't refetch tree/repo info we already have
- **Less rate limiting**: Fewer GitHub API calls
- **Better UX**: User sees immediate feedback on file downloads

### Maintainability
- **Separation of concerns**: Renderer handles network, main handles filesystem
- **Testable**: Can mock file packages without GitHub API
- **Extensible**: Easy to add progress callbacks, retries, etc.

## Migration Path

### Phase 1: New Flow (Recommended)
1. Implement `installSkillFromPackage()` in main process
2. Update renderer to package files before sending
3. Test with various skill structures
4. Deploy and monitor

### Phase 2: Deprecation (Optional)
1. Keep old `installSkill()` for backward compatibility
2. Add deprecation warning
3. Remove after 1-2 releases

## Testing Plan

### Unit Tests
- [ ] Test file filtering logic (all files in skill path)
- [ ] Test relative path calculation
- [ ] Test file writing with nested directories
- [ ] Test metadata generation

### Integration Tests
- [ ] Install skill with only SKILL.md
- [ ] Install skill with scripts/ folder
- [ ] Install skill with references/ and assets/
- [ ] Install to different destinations
- [ ] Handle network errors during file read
- [ ] Handle disk errors during file write

### Manual Tests
- [ ] Install brand-guidelines skill
- [ ] Install algorithmic-art skill
- [ ] Verify all files copied correctly
- [ ] Verify .metadata.json created
- [ ] Verify skill appears in installed list
- [ ] Uninstall and verify cleanup

## Open Questions

1. **Project-level installation**: How to pass `repositoryPath` for project-universal/project-claude?
   - Option A: Pass in `InstallSkillPackageOptions`
   - Option B: Get from workspace/panel context

2. **Progress UI**: Should we show download progress?
   - Could update modal with "Downloading 5/12 files..."
   - Would need to track promise progress

3. **Retry logic**: Should renderer retry failed file reads?
   - GitHub API can be flaky
   - Could add exponential backoff

4. **Caching**: Should `GitHubFileSystemAdapter` cache file contents?
   - Would make repeated reads instant
   - Need cache invalidation strategy

5. **Old handler**: Keep or remove `githubHandlers.ts:installSkill()`?
   - Recommended: Keep for now, deprecate later
   - Or remove if no other code uses it

## Success Metrics

- ✅ Installation completes without hanging
- ✅ All skill files copied correctly
- ✅ Installation time < 5 seconds for typical skills
- ✅ No GitHub API timeouts reported
- ✅ User can install skills offline (after initial load)
