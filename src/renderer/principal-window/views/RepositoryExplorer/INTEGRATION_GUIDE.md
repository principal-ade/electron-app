# Repository City Visualization Integration Guide

## Overview

This guide explains how to integrate the new encapsulated city visualization functionality into the RepositoryDetailsPanel and other components in the RepositoryExplorer views.

**Key Architectural Change**: Unlike the deprecated RepoManager, these components use the **modern Repository Monitoring Server** for FileTree data, ensuring consistency with the rest of the application and providing better performance through centralized caching.

## What Was Created

### 1. Core Components

**SimpleCityVisualization** (`components/SimpleCityVisualization.tsx`)

- Lightweight component that accepts pre-built city data
- Minimal dependencies for easy integration
- Clean props interface for city data, loading states, and file interaction

**RepositoryCityVisualization** (`components/RepositoryCityVisualization.tsx`)

- Self-contained component that handles city building internally
- More dependencies but provides complete functionality out-of-the-box
- Suitable for scenarios where you want minimal integration effort

### 2. Service Layer

**RepositoryCityService** (`services/RepositoryCityService.ts`)

- Handles city data building from repository information using RepositoryMonitoringService
- Singleton pattern for shared state management
- Provides methods for building city data, checking visualization capability, and getting repository stats
- Automatically registers repositories with the monitoring service for consistent data

### 3. Integration Example

**RepositoryDetailsPanelWithCity** (`components/RepositoryDetailsPanelWithCity.tsx`)

- Complete example showing how to integrate city visualization into the existing RepositoryDetailsPanel
- Demonstrates state management, service integration, and user interaction handling

## Integration Steps

### Step 1: Choose Your Integration Approach

**Option A: SimpleCityVisualization (Recommended)**

```typescript
import { SimpleCityVisualization, RepositoryCityService } from './components/city';

// Manage city data in your component state
const [cityData, setCityData] = useState(null);
const [isBuilding, setIsBuilding] = useState(false);
const cityService = RepositoryCityService.getInstance();

// Build city data when needed
const buildCity = async () => {
  setIsBuilding(true);
  const result = await cityService.buildCityData(repository);
  setCityData(result.cityData);
  setIsBuilding(false);
};

// Render the visualization
<SimpleCityVisualization
  repository={repository}
  cityData={cityData}
  isBuilding={isBuilding}
  onFileClick={handleFileClick}
  onRequestCityData={buildCity}
/>
```

**Option B: RepositoryCityVisualization (Self-contained)**

```typescript
import { RepositoryCityVisualization } from './components/city';

// Just render with minimal setup
<RepositoryCityVisualization
  repository={repository}
  onFileClick={handleFileClick}
/>
```

### Step 2: Add to Existing RepositoryDetailsPanel

You can either:

1. **Replace the existing panel**: Use `RepositoryDetailsPanelWithCity.tsx` as the new implementation
2. **Add as a section**: Integrate city visualization into the existing panel structure

To add as a section to the existing panel:

```typescript
// Add state for city visualization
const [showCityVisualization, setShowCityVisualization] = useState(false);
const [cityData, setCityData] = useState(null);
const [isBuilding, setIsBuilding] = useState(false);

// Add toggle button in your JSX
<button onClick={() => setShowCityVisualization(!showCityVisualization)}>
  {showCityVisualization ? 'Hide' : 'Show'} Repository Structure
</button>

{showCityVisualization && (
  <SimpleCityVisualization
    repository={selectedRepository}
    cityData={cityData}
    isBuilding={isBuilding}
    height="400px"
    onFileClick={handleFileClick}
    onRequestCityData={buildCityData}
  />
)}
```

### Step 3: Handle File Clicks

Implement file click handling to integrate with your existing file opening logic:

```typescript
const handleFileClick = useCallback(
  async (filePath: string) => {
    if (!selectedRepository) return;

    try {
      const absolutePath = `${selectedRepository.path}/${filePath}`;
      const files = [
        {
          path: absolutePath,
          relativePath: filePath,
          lastModified: Date.now(),
        },
      ];

      await WindowService.openLocalFiles({
        windowId: `view-${repository.name}-${Date.now()}`,
        windowTitle: `View ${filePath}`,
        files,
      });
    } catch (error) {
      console.error('Error opening file:', error);
    }
  },
  [selectedRepository],
);
```

## File Structure

The new components are organized as follows:

```
src/renderer/principal-window/views/RepositoryExplorer/
├── components/
│   ├── city/
│   │   ├── index.ts                          # Public exports
│   │   └── README.md                         # Component documentation
│   ├── SimpleCityVisualization.tsx           # Recommended component
│   ├── RepositoryCityVisualization.tsx       # Self-contained component
│   └── RepositoryDetailsPanelWithCity.tsx    # Integration example
├── services/
│   └── RepositoryCityService.ts              # City data building service
└── INTEGRATION_GUIDE.md                     # This file
```

## Migration from RepoManager

If migrating from the deprecated RepoManager:

1. **Replace CityMapManager**: Use `SimpleCityVisualization` + `RepositoryCityService`
2. **Replace RightPaneContainer city view**: Use `SimpleCityVisualization`
3. **Update imports**: Change import paths to the new component locations
4. **Adapt repository data**: The new components work with `EnhancedAlexandriaEntry` types

## Key Benefits

1. **Modern Architecture**: Uses Repository Monitoring Server for consistent FileTree data
2. **Encapsulation**: All city functionality is contained in reusable components
3. **Clean Dependencies**: Components have minimal external dependencies
4. **Type Safety**: Full TypeScript support with proper type definitions
5. **Performance**: City data leverages centralized caching from the monitoring server
6. **Consistency**: Same FileTree data source as the rest of the application
7. **Flexibility**: Multiple integration approaches to suit different needs

## Error Handling

The components include comprehensive error handling:

- **Loading states**: Visual indicators while city data is being built
- **Empty states**: Graceful handling when no data is available
- **Error states**: Clear error messages when city building fails
- **Fallbacks**: Default file click behavior when custom handlers aren't provided

## Dependencies

The components depend on:

- `@principal-ai/code-city-react`: Core visualization components
- `@principal-ai/repository-abstraction`: FileTree types
- `themed-markdown`: Theme integration
- `RepositoryMonitoringService`: Modern FileTree data source
- **No dependency on deprecated FileTreeSourceService/MonitoredFileTreeService**

## Testing

To test the integration:

1. Ensure a repository is selected in RepositoryDetailsPanel
2. Toggle the city visualization on
3. Verify the city builds successfully
4. Test file click interactions
5. Check hover information display

## Future Enhancements

Planned improvements include:

- Git HEAD vs working tree comparison
- Real-time updates when files change
- Custom highlight layers for different analyses
- Performance optimizations for large repositories
- Integration with repository monitoring events

## Support

For questions or issues with the city visualization integration:

1. Check the component README files for detailed documentation
2. Review the integration example in `RepositoryDetailsPanelWithCity.tsx`
3. Examine the service documentation in `RepositoryCityService.ts`
