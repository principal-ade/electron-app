# Layer Components

This directory contains view components that were originally part of BasicLayersPanel. Many components have been migrated to the new architecture using RepoLayersPanel.

## Migration Status

### ✅ Migrated to Core Library
- **PackagesView** → Replaced by `PackageLayerView` in `core/layers`
- **FrameworksView** → Replaced by `FrameworkLayerView` in `core/layers`

### 🔄 Still in Use
- **FileView.tsx** - Displays file types with toggleable layers
- **CategoriesView.tsx** - Groups file types into categories
- **DependenciesView.tsx** - Shows dependencies across packages
- **LoadingState.tsx** - Loading state component
- **EmptyState.tsx** - Empty state component

### ❌ Removed
- **BasicLayersPanelNew.tsx** - Replaced by RepoLayersPanel
- **AnalysisResultsPanel.tsx** - Package analysis feature not yet migrated

## Current Components

### 1. FileView.tsx
- Displays file types with counts and icons
- Allows toggling individual file type layers
- Shows enabled/disabled state for each file type

### 2. CategoriesView.tsx
- Groups file types into categories (Code, Markup, Style, Config, etc.)
- Shows aggregated counts per category
- Allows toggling entire categories at once
- Expands to show individual file types within categories

### 3. DependenciesView.tsx
- Shows dependencies across packages
- Version conflict detection
- Import-based file detection

## Migration Notes

The new architecture (RepoLayersPanel) uses:
- Layer modules from the shared library for business logic
- Layer view components from the shared library for UI
- Typed layer objects from `layer-types.ts` as the source of truth

Features not yet migrated include:
- Package analysis (npm/yarn/pnpm outdated and audit)
- Validation layer support
- View mode toggle system
- File layer toggling for visualization

See RepoLayersPanel.tsx for detailed migration status.