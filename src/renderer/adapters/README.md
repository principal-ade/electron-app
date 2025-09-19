# Adapters Architecture

This folder provides environment-specific adapters that implement the shared `PlatformAdapters` interface. A "platform" is a runtime where the UI runs (Electron local, or a remote GitHub view) and each platform must provide:

- `fileSystem`: Access to files and directories
- `git`: Repository detection and change watching (if available)
- `shell`: Ability to open external URLs
- `config`: Fetch remote or repo-based config files

## Overview

- `ElectronPlatformAdapters` (local development)
  - `ElectronFileSystemAdapter`
  - `ElectronGitAdapter`
  - `ElectronShellAdapter`
  - `ElectronConfigAdapter`

- `GitHubWebAdapters` (remote GitHub repositories via API)
  - `github/GitHubFileSystemAdapter` — reads repo tree and files via the main process GitHub API
  - `github/GitHubGitAdapter` — minimal (no watchers); only reports repo info
  - `github/GitHubShellAdapter` — `openExternal` using Electron shell with web fallback

## Usage

```ts
import { ElectronPlatformAdapters, GitHubWebAdapters } from './adapters';

// Local filesystem
const electronAdapters = new ElectronPlatformAdapters();

// Remote GitHub repo
const githubAdapters = new GitHubWebAdapters('owner', 'repo', 'main');
```

Both aggregate classes conform to `PlatformAdapters`, so they can be passed directly into shared workspace services.

## Notes

- The GitHub adapters are read-only (no file writes, moves, or deletes).
- The GitHub Git adapter doesn’t support live watching; it only reports static repo info.
- Prefer importing from the barrel: `import { GitHubWebAdapters } from './adapters'`.
