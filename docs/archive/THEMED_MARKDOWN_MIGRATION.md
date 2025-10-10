# Themed Markdown Library Migration Plan

## Overview

This document tracks the migration from raw `IndustryMarkdownSlide` usage to higher-level components from the `themed-markdown` library, while maintaining support for custom markdown theming.

## Current State

### Component Hierarchy

```
themed-markdown (library)
├── IndustryMarkdownSlide (low-level, raw)
├── SlidePresentation (high-level, for presentations)
└── DocumentView (high-level, for documents)

Our Wrappers
└── ThemedMarkdownSlide
    └── Wraps IndustryMarkdownSlide
    └── Adds custom theme support from user preferences
```

### Usage Analysis

#### Raw Component Usage (via ThemedMarkdownSlide wrapper)
- **Location**: `src/renderer/repo-manager/DevelopmentWorkspace.tsx`
- **Instances**: 3
  - README content (line 1499-1504)
  - CHANGELOG content (line 1763-1768)
  - LICENSE content (line 1913-1918)
- **Purpose**: Display single markdown documents with custom theme support

#### High-Level Component Usage
- **MarkdownDocumentViewer**: Central component using SlidePresentation/DocumentView
- **MarkdownView**: Uses MarkdownDocumentViewer with fontSizeScale support
- **PlanningView**: (Removed) Previously used parseMarkdownIntoPresentation + MarkdownDocumentViewer
- **FileViewer**: Uses high-level components
- **DocumentSearchView**: Uses high-level components

## Migration Strategy

### Phase 1: Create Themed Wrappers for High-Level Components

Create new wrapper components that maintain the custom theming capability:

1. **ThemedDocumentView**
   - Wraps `DocumentView` from themed-markdown
   - Inherits custom theme logic from ThemedMarkdownSlide
   - Adds fontSizeScale support
   - Use for single document viewing

2. **ThemedSlidePresentation**
   - Wraps `SlidePresentation` from themed-markdown
   - Inherits custom theme logic from ThemedMarkdownSlide
   - Adds fontSizeScale support
   - Use for slide-based presentations

### Phase 2: Migrate Existing Usage

#### DevelopmentWorkspace Migration
Replace ThemedMarkdownSlide usage with ThemedDocumentView:

```tsx
// Before
<ThemedMarkdownSlide
  content={readmeContent}
  slideIdPrefix="readme"
  slideIndex={0}
  useCustomTheme={true}
  isVisible={true}
/>

// After
<ThemedDocumentView
  content={readmeContent}
  useCustomTheme={true}
  fontSizeScale={fontSizeScale}
  showSegmented={false}
/>
```

### Phase 3: Deprecate ThemedMarkdownSlide

Once all migrations are complete:
1. Mark ThemedMarkdownSlide as deprecated
2. Remove after verification period
3. Update documentation

## Implementation Tasks

- [ ] Create `ThemedDocumentView` component
  - [ ] Copy custom theme logic from ThemedMarkdownSlide
  - [ ] Wrap DocumentView component
  - [ ] Add fontSizeScale support
  - [ ] Test with user preferences

- [ ] Create `ThemedSlidePresentation` component
  - [ ] Copy custom theme logic from ThemedMarkdownSlide
  - [ ] Wrap SlidePresentation component
  - [ ] Add fontSizeScale support
  - [ ] Test with user preferences

- [ ] Migrate DevelopmentWorkspace
  - [ ] Replace README viewer
  - [ ] Replace CHANGELOG viewer
  - [ ] Replace LICENSE viewer
  - [ ] Test all three viewers

- [ ] Update MarkdownDocumentViewer (optional)
  - [ ] Consider using themed wrappers instead of direct components
  - [ ] Maintain backward compatibility

- [ ] Documentation
  - [ ] Update component usage guidelines
  - [ ] Document theme customization approach
  - [ ] Add migration notes for future developers

## Benefits of Migration

1. **Consistency**: All markdown rendering uses high-level components
2. **Features**: Gain access to built-in features like:
   - Font size scaling
   - Better navigation
   - Checkbox handling
   - Improved accessibility
3. **Maintainability**: Single theming approach across all markdown components
4. **Future-proof**: Easier to adopt new features from themed-markdown library

## Custom Theme Support

The key distinction of our wrapped components is the ability to use custom markdown themes from user preferences:

```typescript
interface UserPreferences {
  useCustomMarkdownTheme?: boolean;  // Enable custom theme
  customMarkdownTheme?: Record<string, unknown>;  // Theme object
  markdownFontSizeScale?: number;  // Font scaling (0.5 - 3.0)
}
```

This allows users to have:
- Different themes for markdown content vs application UI
- Persistent font size preferences
- Consistent theming across all markdown viewers

## Notes

- The migration should be backward compatible
- Existing functionality must be preserved
- Custom theme support is a core feature to maintain
- Consider creating a shared hook for theme management: `useMarkdownTheme()`