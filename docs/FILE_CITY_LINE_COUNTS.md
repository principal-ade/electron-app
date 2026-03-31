# FileCity3D Line Count Integration

## Overview

The FileCity3D panel uses building heights to represent file sizes. This feature provides **actual** line counts for accurate visualizations instead of estimates.

## Current Implementation (Option 2: Electron Main Process)

Line counts are fetched via IPC when the user clicks the FileCity3D button.

### Flow

```
User clicks FileCity3D button
    ↓
DevWorkspacePanelFramework emits 'file-city-3d:open'
    ↓
IPC call: window.mainProcess.fileCityImage.countLines(repoPath)
    ↓
Main process counts lines using git ls-files
    ↓
Transform paths to match building.path format
    ↓
enrichWithLineCounts(rawCityData, lineCounts)
    ↓
estimateLineCounts() for any missing files (binary, etc.)
    ↓
FileCity3DPanelContent with heightScaling="linear"
```

### Files Modified

- `src/shared/main-process-api-interfaces/FileCityImageAPI.ts` - Added `COUNT_LINES` event and `countLines` method
- `src/main/stores/FileCityImageService.ts` - Added `countLinesInRepository()` method and IPC handler
- `src/window/main-process-api-implementations/fileCityImageApi.ts` - Exposed `countLines` to renderer
- `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` - Updated to fetch and use actual line counts

### Line Counting Logic

```typescript
// Binary extensions skipped
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'svg', 'pdf',
  'zip', 'tar', 'gz', 'exe', 'dll', 'so', 'dylib',
  'mp3', 'mp4', 'wav', 'ttf', 'otf', 'woff', 'woff2',
  'lock',  // Skip lock files (huge)
]);

// Files > 1MB are skipped (likely minified/generated)
// Uses git ls-files to only count tracked files
```

### Component Props

```typescript
<FileCity3DPanelContent
  cityData={cityData}
  heightScaling="linear"
  linearScale={0.5}  // 1 line = 0.5 units height
  animation={{ startFlat: true, autoStartDelay: 300 }}
  // ...
/>
```

## Future Consideration: Option 1 (Repository Monitoring Server)

If this feature proves valuable, consider moving line counting to the repository-monitoring-server for better performance:

**Pros:**
- Centralized, cached, reused across panels
- Incremental updates on file changes
- No delay when opening FileCity3D

**Cons:**
- Requires server-side changes
- More complex architecture

### Migration Path

1. Add line counting to `repository-monitoring-server` when building FileTree
2. Include `lineCount` in FileTree's file metadata
3. Update `buildCityDataFromFileTree` to use metadata line counts
4. Remove IPC-based counting from electron-app
