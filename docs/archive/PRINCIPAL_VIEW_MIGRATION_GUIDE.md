# Principal View Migration Guide

## Overview
This guide describes how to migrate existing windows or create new views within the Principal View architecture. The Principal View uses a Slack-style integrated shell with sidebar navigation and an integrated titlebar.

## Architecture

### Principal View Structure
```
src/renderer/principal-window/
├── components/
│   └── IntegratedShell/
│       ├── IntegratedShell.tsx      # Main container
│       ├── NavigationSidebar.tsx    # Left sidebar navigation
│       ├── IntegratedTitlebar.tsx   # Integrated titlebar
│       └── ThemeDropdown.tsx        # Theme selection
├── views/
│   ├── RepositoryExplorer/          # Example: migrated from LandingPage
│   │   ├── index.tsx
│   │   ├── RepositoryExplorer.tsx   # Main view component
│   │   ├── components/              # View-specific components
│   │   └── hooks/                   # View-specific hooks
│   └── [NewView]/                   # Your new view here
│       ├── index.tsx
│       ├── [NewView].tsx
│       ├── components/
│       └── hooks/
└── PrincipalApp.tsx                 # Root component
```

## Migration Steps

### Step 1: Create View Directory Structure

1. **Create the view folder:**
   ```bash
   mkdir -p src/renderer/principal-window/views/[ViewName]
   mkdir -p src/renderer/principal-window/views/[ViewName]/components
   mkdir -p src/renderer/principal-window/views/[ViewName]/hooks
   ```

2. **Create index.tsx (barrel export):**
   ```tsx
   // src/renderer/principal-window/views/[ViewName]/index.tsx
   export { [ViewName] } from './[ViewName]';
   ```

3. **Create main view component:**
   ```tsx
   // src/renderer/principal-window/views/[ViewName]/[ViewName].tsx
   import { useTheme } from '@principal-ade/industry-theme';

   export const [ViewName]: React.FC = () => {
     const { theme } = useTheme();

     return (
       <div style={{
         padding: '16px',
         height: '100%',
         overflow: 'auto'
       }}>
         {/* Your view content here */}
       </div>
     );
   };
   ```

### Step 2: Handle Import Path Changes

When migrating existing components, update import paths:

- **From views to shared components:** `../../../../` (4 levels up)
- **From view components to shared:** `../../../../../` (5 levels up)
- **From views to services:** `../../../services/`
- **From views to main-process-api:** `../../../main-process-api/`

**Example:**
```tsx
// OLD (from src/renderer/pages/SomeWindow.tsx)
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

// NEW (from src/renderer/principal-window/views/SomeView/SomeView.tsx)
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
```

### Step 3: Remove Window-Level Dependencies

1. **Remove titlebar components:**
   ```tsx
   // REMOVE these imports and usage
   import { MainWindowTitlebar } from '../../components/Titlebar/MainWindowTitlebar';
   import { BaseTitlebar } from '../../components/Titlebar/BaseTitlebar';
   ```

2. **Remove full-screen styling:**
   ```tsx
   // REMOVE styles like:
   style={{
     height: '100vh',
     width: '100vw',
     position: 'fixed'
   }}

   // REPLACE with container-friendly styling:
   style={{
     height: '100%',
     overflow: 'auto',
     padding: '16px'
   }}
   ```

3. **Remove routing dependencies (if applicable):**
   ```tsx
   // Navigation is now handled by IntegratedShell, not React Router
   ```

### Step 4: Add to Navigation Sidebar

1. **Add view type to NavigationView:**
   ```tsx
   // src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx
   export type NavigationView =
     | 'repository'
     | 'terminal'
     | 'search'    // Add your new view
     | 'store'
     | 'settings';
   ```

2. **Add navigation item:**
   ```tsx
   // In NavigationSidebar.tsx, add to navigation items:
   {
     id: 'search',
     icon: Search,
     label: 'Search',
     tooltip: 'Search across repositories'
   }
   ```

3. **Add view to IntegratedShell:**
   ```tsx
   // In IntegratedShell.tsx render section:
   {activeView === 'search' && <SearchView />}
   ```

### Step 5: Update Component Layout

Views should work within the content container:
- **Height:** Use `height: '100%'` and `overflow: 'auto'`
- **Padding:** Add consistent padding (e.g., `16px`)
- **Margins:** The container already has proper margins
- **Borders:** The container already has rounded corners and border

**Layout Example:**
```tsx
export const MyView: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      gap: '16px',
      overflow: 'hidden' // Let child components handle scrolling
    }}>
      <header style={{
        fontSize: theme.fontSizes[3],
        fontWeight: 600,
        color: theme.colors.text,
        marginBottom: '8px'
      }}>
        My View Title
      </header>

      <div style={{
        flex: 1,
        overflow: 'auto', // Scrollable content area
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        padding: '12px'
      }}>
        {/* Main content */}
      </div>
    </div>
  );
};
```

## Code Quality & Linting

### TypeScript Configuration

The principal-window folder is included in the main `tsconfig.main.json`. Ensure your code:

1. **Uses proper TypeScript types:**
   ```tsx
   interface MyComponentProps {
     data: string[];
     onSelect: (item: string) => void;
   }
   ```

2. **Imports types correctly:**
   ```tsx
   import type { SomeType } from '../../../shared/types';
   ```

3. **Handles async operations properly:**
   ```tsx
   const [loading, setLoading] = useState(false);

   useEffect(() => {
     const loadData = async () => {
       try {
         setLoading(true);
         const result = await someApiCall();
         // handle result
       } catch (error) {
         console.error('Error loading data:', error);
       } finally {
         setLoading(false);
       }
     };
     loadData();
   }, []);
   ```

### ESLint Configuration

The ESLint configuration includes the principal-window folder. Follow these guidelines:

1. **No unused variables:**
   ```tsx
   // BAD
   const [data, setData] = useState(); // setData not used

   // GOOD - use underscore prefix for intentionally unused
   const [data, _setData] = useState();
   ```

2. **No `any` types:**
   ```tsx
   // BAD
   const handleClick = (event: any) => {};

   // GOOD
   const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {};
   ```

3. **Proper dependency arrays:**
   ```tsx
   // ESLint will enforce exhaustive dependencies
   useEffect(() => {
     someFunction(dep1, dep2);
   }, [dep1, dep2]); // Include all dependencies
   ```

4. **No console statements in production:**
   ```tsx
   // Remove console.log statements before committing
   // Use proper error handling instead
   ```

### Running Quality Checks

Before committing code in the principal-window:

1. **Run TypeScript checking:**
   ```bash
   npm run typecheck
   ```

2. **Run linting:**
   ```bash
   npm run lint:principal-window
   ```

3. **Fix linting issues:**
   ```bash
   npm run lint:principal-window -- --fix
   ```

### Common Issues & Solutions

1. **Import path errors:**
   ```bash
   # Use relative imports correctly
   # From views: ../../../ to reach renderer root
   # From components: ../../../../ to reach renderer root
   ```

2. **Unused imports:**
   ```tsx
   // Remove unused imports automatically
   // Most editors can do this on save
   ```

3. **React hooks exhaustive-deps:**
   ```tsx
   // Include all dependencies or use ESLint disable comment
   useEffect(() => {
     // ...
   }, [dep1, dep2]); // eslint-disable-line react-hooks/exhaustive-deps
   ```

4. **Constant conditions:**
   ```tsx
   // Remove dead code blocks
   // BAD: {false && <SomeComponent />}
   // GOOD: Remove the entire block
   ```

## Testing Your Migration

1. **Visual Testing:**
   - Ensure your view renders correctly within the content container
   - Check responsive behavior
   - Test theme switching
   - Verify navigation works

2. **Functional Testing:**
   - All existing functionality works
   - APIs and services function correctly
   - State management works as expected
   - No console errors

3. **Code Quality:**
   - No TypeScript errors: `npm run typecheck`
   - No linting errors: `npm run lint:principal-window`
   - Clean git status after fixing issues

## Example: Markdown Search Migration

Here's a complete example of migrating the AllRepositoryMarkdownSearch:

1. **Create structure:**
   ```bash
   mkdir -p src/renderer/principal-window/views/MarkdownSearch/components
   ```

2. **Copy and adapt main component:**
   ```tsx
   // src/renderer/principal-window/views/MarkdownSearch/MarkdownSearch.tsx
   import React from 'react';
  import { useTheme } from '@principal-ade/industry-theme';
   // Update import paths (3 levels up)
   import { DocumentSearchService } from '../../../services/DocumentSearchService';

   export const MarkdownSearch: React.FC = () => {
     // Remove any titlebar-related code
     // Adapt layout for container
     // Keep all existing functionality
   };
   ```

3. **Copy components with updated paths:**
   ```bash
   cp src/renderer/pages/AllRepositoryMarkdownSearch/*.tsx \
      src/renderer/principal-window/views/MarkdownSearch/components/
   ```

4. **Update all import paths in components:**
   ```bash
   # Use sed or manual editing to update import paths
   # From ../../../ to ../../../../ (additional level)
   ```

5. **Add to navigation and test**

## Best Practices

1. **Keep views focused** - Each view should have a single responsibility
2. **Use consistent styling** - Follow the theme system
3. **Handle loading states** - Show loading indicators for async operations
4. **Error boundaries** - Handle errors gracefully
5. **Accessibility** - Use proper ARIA labels and keyboard navigation
6. **Performance** - Lazy load heavy components if needed

## Migration Checklist

- [ ] Created view directory structure
- [ ] Updated all import paths
- [ ] Removed titlebar dependencies
- [ ] Removed full-screen styling
- [ ] Added to NavigationSidebar
- [ ] Added to IntegratedShell
- [ ] Adapted layout for content container
- [ ] Fixed all TypeScript errors
- [ ] Fixed all linting errors
- [ ] Tested functionality
- [ ] Tested theme switching
- [ ] Verified navigation works

## Post-Migration Cleanup

After successfully migrating a view to the principal window, follow these cleanup steps:

### 1. Identify Duplicated Components

When migrating, components are typically **copied** rather than moved to ensure the old system continues working. This creates duplicates that need cleanup:

```bash
# Find duplicated components
find src/renderer/components/ -name "ComponentName.tsx"
find src/renderer/principal-window/ -name "ComponentName.tsx"
```

### 2. Assess Original Window/Page Usage

Before removing old files, check what still uses them:

```bash
# Check for imports/references to old components
grep -r "pages/OldPage" src/renderer/
grep -r "components/old-folder" src/renderer/

# Check App.tsx for routing references
grep -n "OldPage\|old-route" src/renderer/App.tsx
```

### 3. Migration Strategy for Shared Components

For components used across multiple windows:

**Option A: Keep in shared location**
- Move commonly used components to `src/renderer/shared/components/`
- Update import paths in both old and new locations
- Gradually migrate other users to shared location

**Option B: Leave until full migration**
- Keep duplicated components until all windows are migrated
- Mark with TODO comments for later cleanup
- Document which components are duplicated

### 4. Titlebar Functionality Assessment

**Important**: Do not remove old titlebars immediately as they often contain functionality still needed elsewhere:

```tsx
// Example: MainWindowTitlebar may have:
// - Settings modal triggers
// - Update notifications
// - User authentication status
// - Custom window controls
// - App-wide actions
```

**Assessment checklist:**
- [ ] What buttons/actions are in the old titlebar?
- [ ] Are any used by windows not yet migrated?
- [ ] Do any provide app-wide functionality?
- [ ] Can this functionality be moved to NavigationSidebar or other locations?

### 5. Gradual Cleanup Process

**Phase 1: Immediate (Safe)**
- [ ] Remove view-specific components that are truly duplicated
- [ ] Update documentation to reflect new architecture
- [ ] Add TODO comments for remaining cleanup

**Phase 2: After More Migrations**
- [ ] Move shared components to `src/renderer/shared/`
- [ ] Remove old routing from App.tsx
- [ ] Clean up old page directories

**Phase 3: Final Cleanup**
- [ ] Remove old titlebar components
- [ ] Remove old window creation code
- [ ] Clean up webpack configurations
- [ ] Remove unused dependencies

### 6. Safe Cleanup Commands

Only run these after confirming no other code references the files:

```bash
# Remove duplicated view-specific components (CAREFUL)
rm src/renderer/components/old-folder/ComponentName.tsx

# Remove old page directory (ONLY after all references removed)
rm -rf src/renderer/pages/OldPage/

# Check for broken imports after removal
npm run typecheck
npm run lint
```

### 7. Cleanup Documentation

Create a cleanup tracking document:

```markdown
# Cleanup Status for [ViewName] Migration

## Duplicated Components
- [x] ComponentA - Moved to shared/
- [ ] ComponentB - Still used by OtherWindow
- [ ] ComponentC - Has titlebar functionality to migrate

## Old Files
- [ ] pages/OldPage/ - Still referenced in App.tsx
- [ ] Remove routing after terminal window migration

## Shared Functionality
- [ ] Settings modal - Move trigger to NavigationSidebar
- [ ] Update checker - Move to app-level component
```

### 8. Example: RepositoryExplorer Cleanup Status

Current state after RepositoryExplorer migration:

**✅ Safe to Remove:**
- View-specific components that were copied and have no other users
- Repository-specific modals and panels

**❌ DO NOT Remove Yet:**
- `LandingPage` - Still used in App.tsx routing
- `MainWindowTitlebar` - May have functionality needed by other windows
- `components/landing-page/SettingsModal` - Used app-wide
- `components/landing-page/ThemeToggle` - May be used elsewhere

**🔍 Needs Investigation:**
- Which titlebar features need to be preserved?
- What other windows still use LandingPage components?
- Can SettingsModal be triggered from NavigationSidebar instead?

## Support

If you encounter issues during migration:
1. Check existing views (like RepositoryExplorer) for patterns
2. Review the ESLint and TypeScript output for specific errors
3. Use the quality check commands to identify issues early
4. Test frequently during development
5. **Always verify no other code references files before deleting them**

Remember: The goal is to maintain all existing functionality while integrating with the new Principal View architecture and keeping code quality high. Cleanup should be done gradually and safely.