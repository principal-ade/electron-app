# Theme Customization UI

## Overview
Implementation plan for allowing users to customize existing themes through a color editor UI accessible from the theme dropdown.

## User Flow

1. User opens Settings and navigates to theme dropdown
2. User selects any predefined theme (Default, Professional, Ocean, Sunset, Minimal, High Contrast)
3. User clicks "Customize Selected Theme" button/option in dropdown
4. Theme customization panel opens and captures the current theme state as a snapshot
5. User edits colors - changes are applied and saved immediately to preferences
6. User can continue editing and see changes reflected throughout the app
7. If user clicks "Revert", theme returns to the snapshot from when modal opened
8. When modal closes, the snapshot is discarded (changes remain unless reverted)

## Implementation

### 1. Theme Dropdown Enhancement

**Location**: Theme dropdown component (likely in Settings view)

Add a "Customize" button/option that:
- Appears when a theme is selected
- Opens the theme customization UI
- Passes the currently selected theme to the editor

### 2. Theme Customization Panel

Create a new component: `ThemeCustomizationPanel`

**Features**:
- Color pickers for all theme properties:
  - Primary colors
  - Background colors
  - Text colors
  - Border colors
  - Accent colors
  - Status colors (success, warning, error, info)
- Auto-save: Changes are applied and saved immediately
- Live preview: Changes reflect throughout the entire app
- Reset to default button for each color (resets to base theme color)
- Revert button: Returns to the snapshot taken when modal opened
- Close button: Keeps current changes and discards snapshot

**Implementation Pattern**:
```typescript
function ThemeCustomizationPanel({ themeId, onClose }) {
  // Capture snapshot when modal opens
  const snapshotRef = useRef(null);

  useEffect(() => {
    const currentTheme = ThemeService.getActiveTheme(themeId);
    snapshotRef.current = deepClone(currentTheme);
  }, [themeId]);

  // Auto-save on color change
  const handleColorChange = async (colorKey: string, newValue: string) => {
    await ThemeService.updateThemeColor(themeId, colorKey, newValue);
    // Changes are immediately visible app-wide
  };

  // Reset to base theme default for one color
  const handleResetColor = async (colorKey: string) => {
    const baseTheme = ThemeService.getBaseTheme(themeId);
    await ThemeService.updateThemeColor(themeId, colorKey, baseTheme[colorKey]);
  };

  // Revert all changes to snapshot
  const handleRevertAll = async () => {
    await ThemeService.restoreThemeSnapshot(themeId, snapshotRef.current);
    onClose();
  };

  // Close without reverting
  const handleClose = () => {
    snapshotRef.current = null; // Discard snapshot
    onClose();
  };

  return (/* UI */)
}
```

**UI Layout**:
```
┌─────────────────────────────────────┐
│ Customizing: Ocean Theme            │
├─────────────────────────────────────┤
│ Primary Colors                       │
│ ├─ Primary      [#0891B2] [picker] [↺]│
│ ├─ Secondary    [#0E7490] [picker] [↺]│
│ └─ Accent       [#06B6D4] [picker] [↺]│
│                                      │
│ Background Colors                    │
│ ├─ Background   [#FFFFFF] [picker] [↺]│
│ ├─ Surface      [#F0F9FF] [picker] [↺]│
│ └─ Paper        [#FFFFFF] [picker] [↺]│
│                                      │
│ Text Colors                          │
│ ├─ Primary Text [#0F172A] [picker] [↺]│
│ ├─ Secondary    [#475569] [picker] [↺]│
│ └─ Disabled     [#94A3B8] [picker] [↺]│
│                                      │
│ Note: Changes are saved automatically │
│                                      │
│ [Revert All Changes] [Close]         │
└─────────────────────────────────────┘
```
Note: [↺] = Reset individual color to base theme default

### 3. Theme Storage

**Current Structure**:
```typescript
interface UserPreferences {
  selectedTheme?: string; // e.g., 'ocean', 'sunset'
  // Add:
  customThemeOverrides?: Record<string, Partial<Theme>>;
}
```

**Proposed Enhancement**:
```typescript
interface UserPreferences {
  selectedTheme?: string;
  customThemeOverrides?: {
    [themeId: string]: {
      baseTheme: string;      // Original theme name
      overrides: Partial<Theme>; // Color overrides
      customName?: string;     // Optional custom name
      lastModified: Date;
    }
  };
}
```

### 4. Theme Application Logic

**Location**: `src/renderer/services/ThemeService.ts`

Modify theme loading to:
1. Load the base theme (e.g., 'ocean')
2. Check if customizations exist for that theme
3. Apply overrides on top of base theme
4. Return merged theme

```typescript
function getActiveTheme(themeId: string): Theme {
  const baseTheme = predefinedThemes[themeId];
  const customizations = userPreferences.customThemeOverrides?.[themeId];

  if (customizations) {
    return deepMerge(baseTheme, customizations.overrides);
  }

  return baseTheme;
}
```

## Component Files to Create/Modify

### New Files
- `src/renderer/components/themes/ThemeCustomizationPanel.tsx`
- `src/renderer/components/themes/ColorPickerInput.tsx`
- `src/renderer/components/themes/ThemePreview.tsx`

### Files to Modify
- `src/renderer/services/ThemeService.ts` - Add override logic
- `src/renderer/principal-window/views/Settings/components/GeneralSettings.tsx` - Add customize button
- `src/renderer/providers/CustomThemeProvider.tsx` - Handle merged themes
- `src/shared/types/userPreferences.types.ts` - Add customThemeOverrides

## Color Picker Component

Use a robust color picker library:
- **Option 1**: `react-colorful` - Lightweight, modern
- **Option 2**: `@uiw/react-color` - More features
- **Option 3**: Built-in `<input type="color">` - Simple but limited

Recommended: `react-colorful` for balance of features and size

```tsx
import { HexColorPicker } from 'react-colorful';

function ColorPickerInput({ label, value, onChange }) {
  return (
    <div className="color-picker-input">
      <label>{label}</label>
      <div className="color-preview" style={{ backgroundColor: value }} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      <HexColorPicker color={value} onChange={onChange} />
    </div>
  );
}
```

## Live Preview

The preview panel should show:
- Sample buttons with different states
- Text in various hierarchies
- Background/surface examples
- Status indicators (success, warning, error)
- Code syntax highlighting preview

This gives users immediate feedback on their color choices.

## Validation

Before saving, validate:
- All colors are valid hex/rgb values
- Sufficient contrast ratios (WCAG AA guidelines)
- No duplicate color definitions
- Theme structure is complete

Show warnings (not errors) for:
- Low contrast combinations
- Colors too similar to each other
- Unusual color choices

## Modal State Management

The customization panel uses a snapshot-based workflow:

1. **On Modal Open**:
   - Capture current theme state (base + any existing overrides) as a snapshot
   - Store snapshot in modal component state (not persisted)
   - Display current colors in pickers

2. **During Editing**:
   - Each color change is immediately saved to UserPreferences
   - ThemeService applies changes instantly throughout the app
   - User sees real-time feedback across all UI

3. **On Modal Close**:
   - If "Close" button clicked: Keep all changes, discard snapshot
   - If "Revert All Changes" clicked: Restore snapshot to UserPreferences, then close
   - Snapshot is discarded in both cases

## Reset Options

1. **Reset Single Color** (↺ button):
   - Reverts one color to the base theme's default value
   - Saves change immediately to UserPreferences
   - Does not affect the snapshot

2. **Revert All Changes**:
   - Restores the entire theme to the snapshot taken when modal opened
   - Undoes all edits made during this session
   - Closes the modal after reverting

3. **Close**:
   - Keeps all current changes
   - Discards the snapshot
   - No further undo possible after closing

## Integration Points

### Theme Dropdown
- Show indicator if theme is customized (e.g., small dot or asterisk)
- Add "Customize" option in dropdown menu
- Add "Reset Customizations" option for customized themes

### Settings UI
- Place customization button near theme selector
- Could be icon button next to dropdown
- Or menu item within dropdown

### Theme Provider
- Load customizations on app start
- Apply merged theme to all components
- Hot-reload when customizations change

## Accessibility Considerations

- Ensure color pickers are keyboard accessible
- Provide contrast ratio feedback in real-time
- Show WCAG compliance indicators
- Warn about insufficient contrast
- Support high contrast mode customizations

## Performance

- Debounce color picker changes for preview
- Cache merged themes to avoid repeated computation
- Use React.memo for preview components
- Only re-render affected areas during editing

## Future Enhancements

- Export/import custom themes as JSON files
- Share custom themes with other users
- Theme presets/templates for common use cases
- Semantic color naming (e.g., "Brand Color" instead of "Primary")
- Dark mode variant generation from light theme
- Gradient and shadow customization
- Font family and size customization

## Implementation Phases

### Phase 1: Basic Color Customization
- Add customize button to dropdown
- Create color picker panel
- Implement override storage
- Apply overrides in ThemeService

### Phase 2: Preview and Validation
- Add live preview panel
- Implement contrast checking
- Add validation warnings
- Add reset functionality

### Phase 3: Polish
- Improve color picker UX
- Add tooltips and help text
- Implement keyboard shortcuts
- Add undo/redo for edits

### Phase 4: Advanced Features
- Save as new theme variant
- Export/import themes
- Theme marketplace integration

## Success Criteria

- Users can customize any predefined theme
- Changes persist across app restarts
- Live preview updates smoothly
- No performance degradation
- Customizations don't break existing UI
- Easy to reset to defaults
