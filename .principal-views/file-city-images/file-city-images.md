# File City Image Generation

## Overview

The File City Image Service generates PNG visualization images for repositories using the File City treemap layout. Images are cached to disk and served via `file://` URLs for display in project grid cards.

## Architecture

```
Renderer Request → IPC → Main Process Service → Cache Check
                                                    ↓
                              ┌─────────────────────┴───────────────────┐
                              ↓                                         ↓
                         Cache Hit                                 Cache Miss
                              ↓                                         ↓
                         Return URL                          Get FileTree from
                                                          Repository Monitoring
                                                                    ↓
                                                           Generate PNG via
                                                           file-city-builder
                                                                    ↓
                                                            Save to Cache
                                                                    ↓
                                                            Return URL
```

## Key Components

### Main Process

- **FileCityImageService** (`src/main/stores/FileCityImageService.ts`)
  - Singleton service for image generation and caching
  - Uses `@principal-ai/file-city-builder` for treemap layout
  - Uses `@principal-ai/file-city-server` for canvas rendering
  - Caches images to `userData/file-city-images/`

### IPC Bridge

- **FileCityImageAPI** (`src/shared/main-process-api-interfaces/FileCityImageAPI.ts`)
  - `file-city:get-image` - Get or generate image for repository
  - `file-city:has-image` - Check if image exists (without generating)

### Renderer

- **FileCityImageService** (`src/renderer/main-process-api/FileCityImageService.ts`)
  - Wrapper for IPC calls
- **useFileCityImages** hook in ProjectsView
  - Fetches images for all repositories in view

## Cache Strategy

- **Location**: `~/.../userData/file-city-images/{hash}.png`
- **Cache Key**: SHA256 of `repoPath:fileTreeSha` (first 16 chars)
- **Dimensions**: 400x400px PNG
- **Invalidation**: Automatic when file tree SHA changes

## Commit History Playback

The commit history playback feature allows users to animate through historical File City visualizations based on git commit history.

### Playback Modes

- **Today** - Play through all commits made today
- **This Week** - Play through all commits since Sunday
- **Full Year** - Play through the year (one commit per day with commits)

### Components

- **CommitHeatMap** (`src/renderer/components/CommitHeatMap.tsx`)
  - GitHub-style heat map showing commit activity
  - Play/Pause buttons for each mode

- **GitService** (`src/renderer/main-process-api/GitService.ts`)
  - `getCommitDatesForHeatMap()` - Get commit counts per day
  - `getCommitsInDateRange()` - Get all commits in a date range
  - `getCommitForDate()` - Get commit info for a specific date
  - `getFileTreeAtCommit()` - Get file paths at a commit using `git ls-tree`

- **FileCityImageService** (`src/main/stores/FileCityImageService.ts`)
  - `getImageForCommit()` - Generate historical visualization from file paths
  - `buildFileTreeFromPaths()` - Construct FileTree from path array

### Historical Image Generation

Unlike current images that use cached file trees from repository monitoring, historical images are generated from file paths obtained via `git ls-tree`. This avoids checking out commits while still building accurate visualizations.

```
Playback Start → Get Commits in Range → For Each Commit:
                                              ↓
                                    Get File Paths (git ls-tree)
                                              ↓
                                    Build FileTree from Paths
                                              ↓
                                    Generate PNG (not cached)
                                              ↓
                                    Display with Typewriter Effect
```

## Dependencies

- `@principal-ai/file-city-builder` - Treemap layout generation
- `@principal-ai/file-city-server` - Canvas rendering utilities
- `canvas` - Node.js canvas for server-side PNG generation
- `@principal-ai/repository-monitoring-server` - Provides cached file trees
