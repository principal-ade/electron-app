# Window Management Audit TODO

## Current State (Fixed White Flash)
We've created a centralized `windowDefaults.ts` module that provides:
- `getWindowDefaults()` - Returns consistent window options (backgroundColor, show: false)
- `mergeWindowOptions()` - Merges user options with defaults
- `setupWindowShowBehavior()` - Handles delayed show after content loads

Applied to:
- ✅ Main ApplicationWindow (`windowManager.ts`)
- ✅ Terminal windows (`terminal.ts`)
- ✅ Git Sync OAuth window (`git-sync-ipc.ts`)

## Future Centralization Opportunities

### 1. Special Windows (`specialWindows.ts`)
Currently has **14 different window types**, each with:
- Duplicate singleton checking logic
- Similar window creation patterns
- Different sizing and positioning

**Recommendation**: Create a `SpecialWindowConfig` interface with presets for each type.

### 2. Window Types Inventory
Need to audit if all these windows are still necessary:
- Store Viewer
- Configuration Center  
- Principal Mock Events
- Multi-File Editor (per session)
- Demo Story Generator
- GitHub Workspace
- PrincipleChat (AI Assistant)
- Architecture View
- Session Details
- Repository Maps (Code City)
- Repo Sessions
- Markdown View

### 3. Potential Improvements
- **Centralized singleton management** - Move duplicate checking to shared utility
- **Window positioning strategy** - Smart positioning based on screen size and existing windows
- **Consistent adapter initialization** - Terminal and Git Sync windows don't get adapters
- **Memory management** - Ensure all windows properly clean up listeners and resources
- **Window state persistence** - Remember size/position between sessions

### 4. Architecture Considerations
- Consider if Terminal windows need full ApplicationWindow treatment (adapters, menu, etc.)
- Evaluate if special windows should extend ApplicationWindow or remain lightweight
- Determine if Git Sync auth should be a modal dialog instead of separate window

### 5. Testing Requirements
- Test white flash fix across all window types
- Verify singleton behavior for special windows
- Check memory leaks with multiple window open/close cycles
- Test window behavior on different OS platforms (Windows, macOS, Linux)

## Next Steps
1. Run the app and verify white flash is fixed
2. Audit which special windows are actively used
3. Create unified window configuration system
4. Implement smart window positioning
5. Add window state persistence
6. Improve cleanup and memory management