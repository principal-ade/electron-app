# Window Switcher Cards

## Overview

The Window Switcher provides a visual overlay for quickly switching between open application windows, triggered by keyboard shortcuts (Command+' for toggle, Command+; for cycle mode). This integration enhances the switcher by using `LocalProjectCard` from the `@industry-theme/repository-composition-panels` package to display rich project information including isometric sprites, GitHub metadata, and visual styling.

## Problem Statement

The current Window Switcher displays basic window titles in simple card tiles. Users managing multiple repository windows would benefit from:

- Visual differentiation between projects (isometric building sprites)
- GitHub metadata at a glance (stars, language, license)
- Owner avatars for quick identification
- Consistent styling with the rest of the application's card system

## Design Approach

### Store AlexandriaEntry at Window Creation

When a dev workspace window is opened (via Quick Open or other means), the `AlexandriaEntry` is stored in the window's metadata alongside existing fields like `displayName`, `remoteUrl`, and `localPath`.

**Why this approach:**
- Avoids async lookups when showing the switcher (performance)
- Data is already available at window creation time
- Consistent with how Quick Open passes data to window handlers

### Data Flow

1. **Window Creation**: `openDevWorkspaceWindow()` receives `AlexandriaEntry` and stores it in `WindowMetadata`
2. **Window Switcher Show**: `updateWindowList()` iterates `applicationWindows`, extracts `alexandriaEntry` from metadata
3. **IPC Transfer**: Window list with entries sent to renderer via `window-switcher:update-list`
4. **Rendering**: `WindowSwitcherApp` renders `LocalProjectCard` for each window with an entry

### Fallback Handling

Windows without `AlexandriaEntry` (e.g., main window, extension windows) will render with a simpler card showing just the title, maintaining backwards compatibility.

## Key Files

| File | Purpose |
|------|---------|
| `src/main/window/types.ts` | Add `alexandriaEntry` to `WindowMetadata` |
| `src/main/window/devWorkspaceWindowHandlers.ts` | Store entry when creating window |
| `src/main/window/windowSwitcher.ts` | Include entry in window list sent to renderer |
| `src/renderer/window-switcher/WindowSwitcherApp.tsx` | Render `LocalProjectCard` for windows with entries |

## Dependencies

**New Package Dependency:**
```
@industry-theme/repository-composition-panels
```

**Peer Dependencies (already satisfied):**
- `@principal-ade/industry-theme` - Theme system
- `@principal-ai/alexandria-core-library` - AlexandriaEntry type

## Card Features

The `LocalProjectCard` component provides:

- **Isometric Sprite**: Cached PNG rendering of building-style project visualization
- **Owner Avatar**: GitHub avatar in top-left corner
- **Star Count**: Badge with gold/silver/bronze coloring
- **Name Plate**: Beveled banner with project name
- **Language Badge**: Bottom-left indicator
- **License Badge**: Bottom-right SPDX badge with color coding
- **Hover Effects**: Lift animation and shadow on hover
- **Selection Border**: Primary color border when selected

## Workflow Patterns

### Toggle Mode (Command+')
1. User presses Command+'
2. Switcher appears with all windows as cards
3. User clicks card or uses arrow keys + Enter
4. Selected window is focused, switcher closes

### Cycle Mode (Command+;)
1. User holds Command, presses ;
2. Switcher appears with second window selected
3. User continues pressing ; to cycle through windows
4. Releasing Command focuses the selected window
