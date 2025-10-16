# Package Graphs Feature - Progress Document

## Overview
Implementation of a cross-repository dependency graph analysis and visualization system within the Principal ADE application. This feature discovers and clusters connected repositories by analyzing their package dependencies, allowing users to understand the dependency relationships across their entire development ecosystem.

## Key Concept: Cluster-Based Analysis
Unlike traditional per-repository dependency viewers, this system:
1. **Analyzes ALL repositories together** - Creates a global package registry from all registered repos
2. **Detects cross-repository dependencies** - Identifies when one registered repo depends on another
3. **Clusters connected repositories** - Groups repos into dependency graphs based on their relationships
4. **Identifies top-level repositories** - Finds "root" projects that depend on others but aren't depended upon

**Example:** If `electron-app` depends on `a24z-library`, `agent-monitoring`, and `Callimachus`, they all become part of the same "Principal ADE Ecosystem" graph.

## Architecture
The system follows a three-panel layout:
- **Left Panel**: List of discovered dependency clusters (graphs)
- **Middle Panel**: Details of selected cluster showing repository relationships
- **Right Panel**: Visible graph package details (future)

## Implemented Files

### Type Definitions
**File**: `src/shared/types/userPreferences.types.ts`
- Added `'graphs'` to `InteractiveShellNavigationView` union type
- Enables the graphs view to be saved in user preferences
- Allows persistence of navigation state across sessions

### Navigation Integration
**File**: `src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx`
- Added `Network` icon import from lucide-react
- Created new navigation item for Graphs view (positioned as first option)
- Uses Network icon to represent the graphs functionality

**File**: `src/renderer/principal-window/components/IntegratedShell/IntegratedShell.tsx`
- Imported `GraphsView` component
- Added `graphs` to `viewCollapsedStates` initialization
- Wired up routing to render GraphsView when `activeView === 'graphs'`

### Main View Component
**File**: `src/renderer/principal-window/views/GraphsView/GraphsView.tsx`
- Main component for the package graphs feature
- Uses `ConfigurablePanelLayout` from `@a24z/panels` for three-panel layout
- Implements `usePanelPersistence` hook for saving panel sizes/collapsed state
- Integrates with `useAllRepositories` hook to fetch ALL repository package data at once
- Calls `buildDependencyGraphs(repositories)` to analyze cross-repo dependencies
- **Left Panel**: Displays list of discovered dependency clusters
  - Each cluster represents connected repositories
  - Shows top-level repositories for each cluster
  - Displays repository count and connection count
  - Highlights clusters containing monorepos
  - Clickable graph cards with selection state
  - Loading and empty states
- **Middle Panel**: Shows selected cluster details
  - **Overview Section**: Total repos, top-level repos, and connection counts
  - **Top-Level Repositories Section**: Repos with no incoming dependencies (cluster roots)
    - Shows package names exported by each repo
    - Displays outgoing dependency counts
  - **All Repositories Section**: Complete list of repos in cluster
    - Highlights top-level repos with badge
    - Shows package names each repo exports
    - Displays incoming and outgoing dependency counts
  - **Placeholder**: For future interactive graph visualization
- **Right Panel**: "Visible Graph Packages" with Eye icon (collapsed by default)
- Panel configuration:
  - Default sizes: left 20%, middle 80%, right 0% (collapsed)
  - Collapsible left and right panels
  - Minimum sizes enforced for usability
  - State persisted under `graphsView` preference key

**File**: `src/renderer/principal-window/views/GraphsView/graphDataBuilder.ts`
- Cross-repository dependency analysis and clustering engine
- **Algorithm Steps**:
  1. **Build Repository Index**: Extract package names from all repositories
  2. **Create Package Registry**: Map package names to repository paths
  3. **Analyze Dependencies**: Check each repo's dependencies against registry
  4. **Cluster Detection**: Use Union-Find algorithm to group connected repos
  5. **Top-Level Identification**: Find repos with no incoming dependencies
- **Data Structures**:
  - `GraphNode`: Represents a repository (not individual packages)
  - `GraphEdge`: Represents dependency relationship between repositories
  - `DependencyGraph`: Complete cluster with nodes, edges, and metadata
- **Key Functions**:
  - `buildDependencyGraphs(allRepos)`: Main entry point - returns one graph per cluster
  - `buildRepositoryNodes()`: Extracts package names from each repository
  - `buildPackageToRepoMap()`: Creates lookup table (package name → repo path)
  - `analyzeCrossRepoDependencies()`: Detects when repos depend on each other
  - `findConnectedClusters()`: Union-Find algorithm for clustering
  - `buildGraphForCluster()`: Constructs graph structure for each cluster
- **Intelligence**:
  - Detects internal monorepo dependencies
  - Identifies cross-repository dependencies
  - Groups only connected repositories
  - Names clusters based on top-level repos

**File**: `src/renderer/principal-window/views/GraphsView/index.ts`
- Barrel export for GraphsView component

## Current State
✅ Navigation integration complete
✅ Basic UI scaffolding complete
✅ Panel layout configured with persistence
✅ **Cross-repository analysis implemented** - Analyzes all repos together
✅ **Package registry built** - Maps package names to repositories
✅ **Cluster detection working** - Union-Find algorithm groups connected repos
✅ **Top-level identification working** - Identifies root repositories in each cluster
✅ **Left panel showing clusters** - Displays discovered dependency groups
✅ **Graph selection implemented** - Click to select and view cluster details
✅ **Repository relationship display** - Shows all repos with incoming/outgoing dependencies
✅ **Verified working** - electron-app correctly connects to a24z-library, codebase-quality-lenses, etc.
✅ Type checking passes (no new errors introduced)

## Next Steps

### Phase 1: Cross-Repository Analysis ✅ COMPLETED
1. **Build Package Registry** ✅
   - ✅ Extracts all package names from registered repositories
   - ✅ Creates lookup map: package name → repository path
   - ✅ Handles monorepos with multiple packages
   - ✅ Uses existing `useAllRepositories` hook for data

2. **Analyze Cross-Repository Dependencies** ✅
   - ✅ Checks each repo's dependencies against package registry
   - ✅ Detects when one registered repo depends on another
   - ✅ Tracks all dependency types (prod, dev, peer)
   - ✅ Builds dependency graph: repo → set of dependent repos

3. **Cluster Detection** ✅
   - ✅ Implements Union-Find algorithm with path compression
   - ✅ Groups repositories into connected components
   - ✅ Creates one graph per cluster of connected repos
   - ✅ Handles isolated repositories (single-repo clusters)

4. **Top-Level Repository Identification** ✅
   - ✅ Analyzes incoming edges for each repo in cluster
   - ✅ Identifies repos with no dependencies from other cluster repos
   - ✅ Names clusters based on top-level repositories
   - ✅ Highlights top-level repos in UI

5. **UI Implementation** ✅
   - ✅ Left panel shows discovered clusters
   - ✅ Middle panel displays repository relationships
   - ✅ Shows incoming/outgoing dependency counts
   - ✅ Visual distinction for top-level repos
   - ⏳ Search/filter functionality (can be added later if needed)

### Phase 2: Visualization Layer
3. **Implement Graph Visualization Panel**
   - Choose visualization library (e.g., D3.js, vis.js, cytoscape.js, or react-flow)
   - Render dependency graph in middle panel
   - Implement interactive features:
     - Pan and zoom
     - Node selection
     - Highlight dependency paths
     - Expand/collapse clusters
   - Add layout options (hierarchical, force-directed, circular)
   - Performance optimization for large graphs

### Phase 3: Package Details Panel
4. **Implement Visible Packages Panel**
   - Show details of selected/visible packages
   - Display package metadata (version, description, license)
   - Show dependency relationships
   - Add filtering and sorting options
   - Implement package search within the graph

### Phase 4: Polish & Features
5. **Additional Features**
   - Export graph as image or DOT file
   - Generate dependency reports
   - Detect circular dependencies
   - Identify outdated packages
   - Compare dependency graphs across repositories
   - Integration with package manager commands

## Technical Decisions

### Core Architecture
- **Analysis Scope**: Cross-repository analysis (not per-repository isolation)
- **Clustering Algorithm**: Union-Find with path compression for efficient grouping
- **Graph Granularity**: Repository-level (not package-level) for clarity
- **Dependency Detection**: Bidirectional for clustering, directed for visualization
- **Top-Level Logic**: Repos with zero incoming edges from cluster members

### Data Model
- **Node Types**: `repository` (registered repos) and `external` (npm packages)
- **Edge Structure**: Contains list of specific package-to-package dependencies
- **Graph Metadata**: Tracks top-level repos, total repos, connections, and monorepo status
- **Naming Strategy**: Graphs named after their top-level repositories

### Implementation
- **Panel System**: Using existing `@a24z/panels` ConfigurablePanelLayout for consistency
- **State Management**: Using usePanelPersistence hook for layout state
- **Data Source**: Leveraging existing `useAllRepositories` hook and `RepositoryDataCache`
- **Package Registry**: In-memory Map for fast lookups during analysis
- **Performance**: Single-pass algorithm, O(α(n)) amortized time for Union-Find
- **Styling**: Following existing pattern from RepositoryExplorer
- **Icons**: Using lucide-react icon library (Network, Package, Eye, GitBranch icons)
- **Persistence**: Saving under `graphsView` key in user preferences

### Design Rationale
**Why repository-level instead of package-level?**
- Clearer understanding of project structure
- Easier to identify "root" projects vs libraries
- Matches developer mental model of codebases
- Reduces visual complexity for large ecosystems

**Why cluster detection?**
- Automatically discovers related projects
- No manual configuration required
- Adapts to changing dependencies
- Separates unrelated project groups

## Dependencies to Consider
- Graph visualization library (TBD in Phase 2) - candidates: react-flow, D3.js, cytoscape.js
- No additional dependencies needed for current implementation (uses built-in algorithms)

## Related Files
- Design: `.alexandria/drawings/Package Graph View.excalidraw`
- Repository Data: `src/renderer/hooks/useRepositoryData.ts`
- Alexandria Service: `src/renderer/main-process-api/AlexandriaService.ts`
