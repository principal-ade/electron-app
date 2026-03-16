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

## Dependencies

- `@principal-ai/file-city-builder` - Treemap layout generation
- `@principal-ai/file-city-server` - Canvas rendering utilities
- `canvas` - Node.js canvas for server-side PNG generation
- `@principal-ai/repository-monitoring-server` - Provides cached file trees
