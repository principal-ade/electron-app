# Custom Industry Themes Support Plan

## Overview
This document outlines the implementation plan for supporting custom industry themes in PrincipleMD, similar to the VSCode extension's capability.

## Current Implementation
- ✅ Theme selection dropdown in Settings modal
- ✅ Predefined themes (Default, Professional, Ocean, Sunset, Minimal, High Contrast)
- ✅ Theme persistence in UserPreferences
- ✅ CustomThemeProvider that loads selected theme on app start
- ✅ Theme interface following Theme UI spec

## Phase 1: Custom Theme Creation (Next Steps)

### 1.1 Theme Editor Component
Create a visual theme editor within the Settings modal:
- Color picker for all theme colors
- Font size and family selectors
- Live preview panel
- Import/Export functionality (JSON format)
- Reset to defaults option

### 1.2 Custom Theme Storage
- Store custom themes in `UserPreferences.customThemes` as JSON
- Each custom theme includes:
  - Name and description
  - Full theme configuration
  - Creation/modification timestamps
  - Author metadata

### 1.3 Theme Validation
- Validate theme structure before saving
- Ensure all required colors are defined
- Check contrast ratios for accessibility
- Provide warnings for potential issues

## Phase 2: Industry-Specific Templates

### 2.1 Pre-built Industry Themes
Create specialized themes for different industries:
- **Finance**: Conservative blues and greens, high contrast
- **Healthcare**: Calming blues and whites, accessible colors
- **Education**: Friendly, warm colors with good readability
- **Technology**: Modern, vibrant colors with dark mode focus
- **Legal**: Professional grays and blacks, traditional styling
- **Creative**: Bold, artistic color schemes

### 2.2 Theme Marketplace Integration
- Browse community-created themes
- One-click installation
- Rate and review themes
- Share custom themes with the community

## Phase 3: Advanced Features

### 3.1 Live Theme Switching
- Implement hot-reload for theme changes without app restart
- Use React context to propagate theme changes instantly
- Cache theme data for performance

### 3.2 Theme Sync
- Sync custom themes across devices via cloud storage
- Export/import theme packages (.pmdtheme files)
- Theme versioning and update notifications

### 3.3 Contextual Themes
- Different themes for different repositories/projects
- Time-based theme switching (day/night)
- Activity-based themes (coding vs. documentation)

## Implementation Details

### Theme Structure
```typescript
interface CustomTheme {
  id: string;
  name: string;
  description: string;
  author?: {
    name: string;
    email?: string;
  };
  version: string;
  theme: Theme; // Full theme object
  tags?: string[]; // e.g., ['dark', 'high-contrast', 'finance']
  createdAt: Date;
  updatedAt: Date;
}
```

### Theme Manager Service
```typescript
class ThemeManagerService {
  // Create custom theme
  async createTheme(theme: CustomTheme): Promise<void>
  
  // Update existing theme
  async updateTheme(id: string, updates: Partial<CustomTheme>): Promise<void>
  
  // Delete custom theme
  async deleteTheme(id: string): Promise<void>
  
  // Export theme to file
  async exportTheme(id: string): Promise<string>
  
  // Import theme from file
  async importTheme(themeData: string): Promise<CustomTheme>
  
  // Get all themes (predefined + custom)
  async getAllThemes(): Promise<(PredefinedTheme | CustomTheme)[]>
  
  // Apply theme without restart
  async applyTheme(themeId: string): Promise<void>
}
```

### UI Components Needed
1. **ThemeEditor**: Visual editor for creating/modifying themes
2. **ThemePreview**: Live preview of theme changes
3. **ThemeGallery**: Browse and select from available themes
4. **ThemeImportExport**: Handle theme file operations
5. **ColorPicker**: Advanced color selection with palette generation

## Migration Path
1. Current users will continue using predefined themes
2. Custom theme creation will be opt-in via "Advanced" section
3. Existing theme preferences will be preserved
4. Gradual rollout of marketplace features

## Testing Strategy
- Unit tests for theme validation logic
- Integration tests for theme persistence
- Visual regression tests for theme application
- Accessibility tests for color contrast
- Performance tests for theme switching

## Timeline Estimate
- Phase 1: 2-3 weeks
- Phase 2: 3-4 weeks  
- Phase 3: 4-6 weeks

## Dependencies
- Color manipulation library (e.g., chroma-js)
- File system access for import/export
- Cloud storage API for sync features
- Theme validation schema library

## Success Metrics
- Number of custom themes created
- Theme switching performance (<100ms)
- User satisfaction with theme options
- Accessibility compliance score
- Community theme submissions

## Next Immediate Steps
1. Implement theme hot-reload capability
2. Add "Create Custom Theme" button to Settings
3. Build basic color picker component
4. Create theme preview panel
5. Implement theme import/export functionality