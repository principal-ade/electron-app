# Titlebar Refactoring Plan

## Overview
Currently, titlebars are rendered in the main App.tsx component and positioned above the page content. This causes layout issues where the page content doesn't properly account for the titlebar height. The solution is to move titlebars into their respective page components so each page can manage its own layout.

## Current Problem
- App.tsx conditionally renders different titlebars based on the current view
- Page components (like LandingPage) use `height: 100%` which doesn't account for the titlebar
- This causes content to be cut off or improperly sized

## Proposed Solution
Move titlebar rendering into each page component, giving each page full control over its layout.

## Implementation Tasks

### 1. Move MainWindowTitlebar into LandingPage
- [x] Import MainWindowTitlebar in LandingPage component
- [x] Add props to LandingPage: `onSettingsClick`, `hasUpdateAvailable`, `onUpdateAvailable`
- [x] Wrap LandingPage content in a flex container with titlebar at top
- [x] Update LandingPage to use `height: 100vh` and proper flex layout

### 2. Move RepositoryTitlebar into RepositoryManager
- [x] Import RepositoryTitlebar in RepositoryManager component
- [x] Add props to RepositoryManager: `onSettingsClick`, `hasUpdateAvailable`
- [x] Repository data is already available in the component
- [x] Wrap content in flex container with titlebar

### 3. Move MarkdownViewerTitlebar into MarkdownView
- [x] Import MarkdownViewerTitlebar in MarkdownView component
- [x] Add props for font size controls: `fontSizeScale`, `onFontSizeIncrease`, `onFontSizeDecrease`
- [x] File path and project name already available
- [x] Wrap content in flex container with titlebar

### 4. Move SearchWindowTitlebar into SearchWindow
- [x] Import SearchWindowTitlebar in SearchWindow component
- [x] No additional props needed
- [x] Wrap content in flex container with titlebar

### 5. Clean up App.tsx
- [x] Remove all titlebar imports
- [x] Remove titlebar conditional rendering logic
- [x] Pass necessary props through AppContent to child components
- [x] Keep SettingsModal at App level (shared across all views)

### 6. Update AppContent function
- [x] Pass `onSettingsClick`, `hasUpdateAvailable`, `onUpdateAvailable` props to components
- [x] Update each component instantiation with required props

## Layout Pattern
Each component should follow this pattern:

```tsx
<div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
  <ComponentTitlebar {...titlebarProps} />
  <div style={{ flex: 1, overflow: 'auto' }}>
    {/* Page content */}
  </div>
</div>
```

## Benefits
1. Each page controls its own layout
2. No complex flex container management in App.tsx
3. Easier to customize titlebar per page
4. Proper height calculations without overlapping content
5. More maintainable and modular code

## Testing Checklist
- [x] LandingPage displays correctly with integrated titlebar
- [x] RepositoryManager displays correctly with integrated titlebar
- [x] MarkdownView displays correctly with integrated titlebar
- [x] SearchWindow displays correctly with integrated titlebar
- [x] Settings modal still opens from all views
- [x] Update notifications work in all views
- [x] No content is cut off or hidden behind titlebars
- [x] Window resizing works properly in all views

## Implementation Status
✅ **COMPLETED** - All titlebars have been successfully moved into their respective components. Each page now controls its own layout with proper flex containers to ensure content displays correctly below the titlebar.