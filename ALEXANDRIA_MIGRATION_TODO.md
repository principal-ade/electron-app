# Alexandria Migration - Features TODO

## Current Status
We have successfully migrated from custom repository storage to using AlexandriaRepositoryRegistry from the `a24z-memory` package. The basic UI components have been created and integrated, but many features from the old repository cards need to be added or verified.

## ~~Critical Issue~~ ✅ FIXED
**✅ Repository Manager now working**: The issue where clicking on a repository card failed to open the Repository Maps view has been resolved.

**Solution implemented:**
- Created a new `openRepositoryDashboard` function that accepts AlexandriaRepository type directly
- Backend handler now intelligently extracts the owner field from multiple sources (github.owner, githubUrl parsing, or name parsing)
- Removed the old `openRepositoryMaps` function to avoid confusion
- Alexandria components now pass the repository object directly without worrying about field mapping

## Features That Need to Be Added

### Landing Page Integration
- [x] Wire "Add Project" button in landing page header to handle adding repositories
  - [x] Update LandingPage component to handle add project actions directly
  - [x] Add local folder selection using FileSystemService  
  - [x] Implement proper IPC event subscription for repository changes
  - [x] AlexandriaRepositoryManager now listens for backend repository change events

### Git Integration (HIGH PRIORITY)
- [ ] Real-time git status monitoring per repository/clone
- [ ] Current branch display on cards
- [ ] Dirty state indicator (uncommitted changes)
- [ ] Ahead/behind commit counts
- [ ] Multiple clone support with independent status tracking
- [ ] Git status educational modal (explains what badges mean)

### Repository Management
- [ ] Delete local clone functionality with safety warnings
  - [ ] Warning dialog for uncommitted changes
  - [ ] Warning dialog for unpushed commits
  - [ ] Force delete option
- [ ] Delete repository from tracking
- [ ] Support for multiple local clones per repository

### Navigation & Actions
- [x] ~~Fix Repository Maps navigation~~ ✅ FIXED - openRepositoryDashboard now handles Alexandria repos
- [ ] Add "Open Settings" button on cards
- [ ] Fork parent navigation (click badge to view parent repository)
- [ ] "Open in GitHub" button
- [ ] "Add to Repositories" button for search results

### Visual Indicators
- [ ] License badges with color coding
- [ ] Fork badge for forked repositories
- [ ] Visual distinction between repos with/without local clones
  - [ ] Solid border for repos with clones
  - [ ] Dashed border for repos without clones
- [ ] Language indicator with color dot
- [ ] Star count display (currently shows but needs verification)
- [ ] Fork count display
- [ ] Repository description display (currently shows but needs 2-line limit)

### Interactive States
- [ ] Hover effects (elevation, border color change)
- [ ] Loading states for async operations
- [ ] Disabled states for buttons during operations

## Features Already Implemented
- ✅ Basic Alexandria integration with `a24z-memory` package
- ✅ Repository listing from AlexandriaRegistryService
- ✅ Add repository via directory selection
- ✅ Basic repository card display
- ✅ GitHub metadata display (partial - stars, topics)
- ✅ View count display
- ✅ Last updated date

## Technical Notes

### Key Files
- `/src/renderer/components/alexandria/AlexandriaRepositoryCard.tsx` - Card component
- `/src/renderer/components/alexandria/AlexandriaRepositoryList.tsx` - List component
- `/src/renderer/pages/alexandria/AlexandriaRepositoryManager.tsx` - Main manager page
- `/src/main/stores/AlexandriaRegistryService.ts` - Backend service
- `/src/main/stores/AlexandriaApiEventHandler.ts` - IPC handlers

### Old Components for Reference
- `/src/renderer/components/landing-page/RepositoryCard.tsx` - Has all the git integration features
- `/src/renderer/components/landing-page/EphemeralRepositoryCard.tsx` - Fork parent card design

### Architecture Patterns to Follow
- Use `window.mainProcess` for IPC calls, not `window.electron`
- Use enums for IPC event names (see `AlexandriaAPIEvent`)
- No window access outside `renderer/main-process-api` folder
- Follow existing handler registration patterns in `/src/main/initialization.ts`
- Use `themed-markdown` for theming (`useTheme` hook)

### Data Structure Mismatch
The Alexandria repository type from `a24z-memory` has different fields than our old Repository type:
- Alexandria uses `githubUrl` instead of `remoteUrl`
- Alexandria doesn't have an `owner` field (it's likely embedded in the name or GitHub data)
- Need to map Alexandria data to expected formats for existing views

## Recommended Approach
1. First fix the Repository Maps navigation issue by properly mapping Alexandria data
2. Add Git integration features (most important for daily use)
3. Add repository management features (delete, settings)
4. Polish visual indicators and interactive states
5. Consider removing old repository components once feature parity is achieved