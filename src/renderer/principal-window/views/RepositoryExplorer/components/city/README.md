# Repository City Visualization Components

This directory contains encapsulated city visualization components that can be easily integrated into the RepositoryDetailsPanel and other parts of the Repository Explorer.

## Overview

The city visualization functionality has been extracted from the deprecated RepoManager and encapsulated into reusable components that provide 3D repository structure visualization using the `@principal-ai/code-city-react` package.

## Components

### SimpleCityVisualization

The recommended component for most use cases. It accepts pre-built city data and provides a clean, simple interface.

```typescript
import { SimpleCityVisualization } from './city';

<SimpleCityVisualization
  repository={selectedRepository}
  cityData={cityData}
  isBuilding={isBuildingCity}
  treeStats={treeStats}
  height="400px"
  onFileClick={handleFileClick}
  onRequestCityData={buildCityData}
/>
```

**Props:**
- `repository`: The repository to visualize
- `cityData`: Pre-built CityData object (optional)
- `isBuilding`: Whether city data is currently being built
- `treeStats`: File and directory counts
- `height`: Container height
- `onFileClick`: Callback for file clicks
- `onRequestCityData`: Callback to request city data building

### RepositoryCityVisualization

A more comprehensive component that handles city data building internally. Has more dependencies but provides a fully self-contained solution.

```typescript
import { RepositoryCityVisualization } from './city';

<RepositoryCityVisualization
  repository={selectedRepository}
  height="400px"
  showGitChanges={false}
  onFileClick={handleFileClick}
/>
```

**Props:**
- `repository`: The repository to visualize
- `highlightLayers`: Optional highlight layers
- `showGitChanges`: Whether to show git HEAD vs working tree
- `height`: Container height
- `onFileClick`: Callback for file clicks

### RepositoryCityService

Service class for building city data from repository information.

```typescript
import { RepositoryCityService } from './city';

const cityService = RepositoryCityService.getInstance();
const result = await cityService.buildCityData(repository);
```

**Methods:**
- `buildCityData(repository, options)`: Build city data for a repository
- `canVisualize(repository)`: Check if repository can be visualized
- `getRepositoryStats(repository)`: Get quick file/directory stats

## Integration Example

Here's how to integrate the city visualization into your component:

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import { SimpleCityVisualization, RepositoryCityService } from './city';

export const MyRepositoryPanel = ({ repository }) => {
  const [cityData, setCityData] = useState(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [treeStats, setTreeStats] = useState(null);
  
  const cityService = useMemo(() => RepositoryCityService.getInstance(), []);

  const buildCityData = useCallback(async () => {
    if (!repository) return;
    
    setIsBuilding(true);
    try {
      const result = await cityService.buildCityData(repository);
      setCityData(result.cityData);
      setTreeStats(result.treeStats);
    } catch (error) {
      console.error('Failed to build city:', error);
    } finally {
      setIsBuilding(false);
    }
  }, [repository, cityService]);

  const handleFileClick = useCallback((filePath) => {
    // Handle file click - open in editor, etc.
    console.log('File clicked:', filePath);
  }, []);

  return (
    <SimpleCityVisualization
      repository={repository}
      cityData={cityData}
      isBuilding={isBuilding}
      treeStats={treeStats}
      height="400px"
      onFileClick={handleFileClick}
      onRequestCityData={buildCityData}
    />
  );
};
```

## Architecture

The components are designed with the following principles:

1. **Separation of Concerns**: Components handle rendering, services handle data
2. **Minimal Dependencies**: SimpleCityVisualization has minimal external dependencies
3. **Reusability**: Can be used in any part of the application
4. **Performance**: City data building is cached and optimized
5. **Error Handling**: Graceful degradation when city building fails

## Dependencies

- `@principal-ai/code-city-react`: Core city visualization components
- `@principal-ai/repository-abstraction`: FileTree types and builders
- `themed-markdown`: Theme integration
- Local services: `FileTreeSourceService`, `MonitoredFileTreeService`

## Migration from RepoManager

If you're migrating from the deprecated RepoManager components:

1. Replace `CityMapManager` usage with `SimpleCityVisualization`
2. Replace `RightPaneContainer` city view with `SimpleCityVisualization`
3. Use `RepositoryCityService` for city data building instead of inline logic
4. Update import paths to use the new component location

## File Structure

```
components/city/
├── index.ts                          # Public exports
├── README.md                         # This documentation
└── ../
    ├── SimpleCityVisualization.tsx       # Recommended component
    ├── RepositoryCityVisualization.tsx   # Self-contained component
    └── RepositoryDetailsPanelWithCity.tsx # Example integration
services/
└── RepositoryCityService.ts          # City data building service
```

## Future Enhancements

- [ ] Git HEAD vs working tree comparison
- [ ] Custom highlight layers for different analyses
- [ ] Performance optimizations for large repositories
- [ ] Real-time updates when files change
- [ ] Integration with repository monitoring events