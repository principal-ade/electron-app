# Repository Explorer Migration Plan

## Overview
Migrate LandingPage to principal-window as RepositoryExplorer view, integrating with the new Slack-style navigation system.

## Current Structure Analysis

### LandingPage Components
```
src/renderer/pages/LandingPage/
├── LandingPage.tsx (44KB) - Main component
├── OnboardingFlowV2.tsx (62KB) - Onboarding wizard
├── RepositoryDetailsPanel.tsx (18KB) - Repository details view
└── AgentConfigurationView/ - Agent configuration components

src/renderer/components/landing-page/
├── RepositoryListHeader.tsx - Repository list controls
├── GitStatusPanel.tsx - Git status display
├── RepositoryNotesPanel.tsx - Repository notes
├── SettingsModal.tsx (96KB) - Settings dialog
├── AddRepositoryModal.tsx - Add repository dialog
└── ... (other supporting components)
```

### Key Dependencies
- **MainWindowTitlebar** - Will be replaced by IntegratedTitlebar
- **AnimatedResizableLayout** from @a24z/panels
- **Multiple API services** (Alexandria, Git, FileSystem, etc.)

## Migration Strategy

### Phase 1: Create RepositoryExplorer View
1. **Create new structure:**
   ```
   src/renderer/principal-window/views/
   └── RepositoryExplorer/
       ├── index.tsx
       ├── RepositoryExplorer.tsx (renamed from LandingPage)
       ├── components/
       │   ├── RepositoryDetailsPanel.tsx
       │   ├── OnboardingFlow.tsx
       │   └── ... (view-specific components)
       └── hooks/
           └── useRepositories.ts
   ```

2. **Remove titlebar** - The IntegratedTitlebar handles this now

3. **Adapt layout** - Remove full-height styling, work within content area

### Phase 2: Move Shared Components
Create shared component structure:
```
src/renderer/shared/components/
├── modals/
│   ├── SettingsModal.tsx
│   ├── AddRepositoryModal.tsx
│   └── GitCloneModal.tsx
├── repository/
│   ├── RepositoryListHeader.tsx
│   ├── GitStatusPanel.tsx
│   └── RepositoryNotesPanel.tsx
└── common/
    ├── TagPill.tsx
    └── AnimatedTimelineEvent.tsx
```

### Phase 3: Update Navigation Integration
1. **Remove router dependency** - Navigation handled by IntegratedShell
2. **Update state management** - Lift repository state to shell or use context
3. **Handle view switching** - Integrate with NavigationSidebar

### Phase 4: Settings Integration
- Settings modal triggered from sidebar settings button
- Move settings state to shared context if needed
- Ensure theme updates propagate correctly

## Implementation Steps

### Step 1: Basic Migration
```tsx
// src/renderer/principal-window/views/RepositoryExplorer/index.tsx
export { RepositoryExplorer } from './RepositoryExplorer';

// src/renderer/principal-window/views/RepositoryExplorer/RepositoryExplorer.tsx
import React from 'react';
// Remove MainWindowTitlebar import
// Copy LandingPage logic but adapt for integrated shell

export const RepositoryExplorer: React.FC = () => {
  // Repository management logic
  // Remove titlebar rendering
  // Adapt layout for content area
};
```

### Step 2: Update IntegratedShell
```tsx
// src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx
import { RepositoryExplorer } from '../../views/RepositoryExplorer';

// In render:
{activeView === 'repository' && <RepositoryExplorer />}
```

### Step 3: Handle Shared State
- Repository list could be lifted to IntegratedShell or PrincipalApp
- Use React Context for cross-view state sharing
- Settings modal state managed at shell level

## Components to Migrate

### Immediate (Required for RepositoryExplorer):
- [ ] LandingPage → RepositoryExplorer
- [ ] RepositoryDetailsPanel
- [ ] RepositoryListHeader

### Soon (Shared functionality):
- [ ] SettingsModal (triggered from sidebar)
- [ ] GitCloneModal
- [ ] AddRepositoryModal
- [ ] OnboardingFlowV2

### Later (Supporting components):
- [ ] GitStatusPanel
- [ ] RepositoryNotesPanel
- [ ] AgentConfigurationView/*

## Considerations

### State Management
- Repository selection needs to persist across view changes
- Settings should be accessible from any view
- Consider Redux or Context for global state

### Layout Adaptations
- Remove 100vh/100vw styles
- Work within content-wrapper boundaries
- Respect padding-top: 56px for titlebar space

### API Services
- All services should continue to work as-is
- May need to move initialization to PrincipalApp level

### Modals
- Settings modal should overlay entire shell
- Other modals should work within view context
- Z-index management important

## Testing Points
1. Repository list loads correctly
2. Repository selection works
3. Settings modal opens from sidebar
4. Git operations function properly
5. Onboarding flow works for new users
6. Theme changes apply correctly
7. Window controls remain functional

## Success Metrics
- [ ] All repository functionality works
- [ ] No visual regressions
- [ ] Performance maintained or improved
- [ ] Clean separation of concerns
- [ ] Reduced bundle size for main entry

## Timeline Estimate
- Basic migration: 1 day
- Component reorganization: 1 day
- Testing and polish: 1 day
Total: ~3 days