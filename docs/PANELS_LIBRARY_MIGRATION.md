# @a24z/panels Library Migration Guide

## Library Update
- Updated from previous version to **v1.0.4**
- All files are currently importing both the component and style.css

## Files Using @a24z/panels

All files are using the `AnimatedResizableLayout` component and importing the default styles:

### Principal Window Views (3 files)
1. **src/renderer/principal-window/views/RepositoryExplorer/RepositoryExplorer.tsx**
   - Lines: 3-4
   - Import: `AnimatedResizableLayout` and `@a24z/panels/style.css`

2. **src/renderer/principal-window/views/WorkspacesManager/WorkspacesManager.tsx**
   - Lines: 4-5
   - Import: `AnimatedResizableLayout` and `@a24z/panels/style.css`

3. **src/renderer/principal-window/views/TerminalManager/TerminalManager.tsx**
   - Lines: 4-5
   - Import: `AnimatedResizableLayout` and `@a24z/panels/style.css`

### Pages (2 files)
4. **src/renderer/pages/StoreViewer.tsx**
   - Lines: 18-19
   - Import: `AnimatedResizableLayout` and `@a24z/panels/style.css`

5. **src/renderer/pages/LandingPage/AgentConfigurationView/DetailedConfigurationView.tsx**
   - Lines: 11-12
   - Import: `AnimatedResizableLayout` and `@a24z/panels/style.css`

### Repo Manager (1 file)
6. **src/renderer/repo-manager/RepositoryExplorationView.tsx**
   - Lines: 24-25
   - Import: `ThreePanelLayout` and `@a24z/panels/panels.css`

### Components (2 files)
7. **src/renderer/components/agent-overview/ActiveSegmentTimeline.tsx**
   - Lines: 3-4
   - Import: `AnimatedResizableLayout` and `@a24z/panels/style.css`

8. **src/renderer/components/DiagramWorkspace.tsx**
   - Lines: 2-3
   - Import: `AnimatedResizableLayout` and `@a24z/panels/style.css`

## Migration Steps for Theme Integration

To integrate with your custom theme, you'll need to:

1. **Remove the default style imports** - Remove `import '@a24z/panels/style.css'` from all 8 files

2. **Create a custom theme provider** - The AnimatedResizableLayout component likely accepts theme props or can be wrapped with a theme provider

3. **Update each component** - Pass your custom theme configuration to the AnimatedResizableLayout component

4. **Test each view** - Ensure the resizable panels work correctly with the new theme in:
   - Principal window views
   - Store viewer
   - Agent configuration views
   - Repository manager
   - Diagram workspace

## Next Steps

1. Check the @a24z/panels documentation for v1.0.4 theme customization options
2. Create a centralized theme configuration for panels
3. Update each file to use the themed version
4. Remove the default CSS imports