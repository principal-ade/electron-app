# Validation System Migration Guide

## Overview
This guide explains how to migrate existing validation tabs (TypeScript, Knip, Coverage) to use the unified ValidationTab system.

## Architecture Overview

### Current Unified System Components

1. **ValidationsTab.tsx** - Main unified UI component
   - Package selector dropdown
   - Validation type switcher
   - Results display
   - Manual refresh trigger

2. **ViolationMonitoringServiceIPC.ts** - Renderer-side service
   - Communicates with main process via IPC
   - Converts violation data to UI format
   - Handles caching and state

3. **ViolationCollectionService.ts** - Main process service
   - Runs actual validation tools
   - Collects results from TypeScript/ESLint
   - Returns structured violation data

4. **validation.ts** - Type definitions
   - Shared interfaces and types
   - Const objects (not enums) for better webpack compatibility

## Migration Steps for New Validation Types

### Step 1: Extend the Validation Types

Add your validation type to the `ValidationType` union in `ValidationsTab.tsx`:

```typescript
type ValidationType = 'knip' | 'eslint' | 'typescript' | 'coverage' | 'your-new-type';
```

### Step 2: Add Validation Type to UI

Add a new entry to the `validationTypes` array in `ValidationsTab.tsx`:

```typescript
const validationTypes = [
  // ... existing types
  {
    id: 'your-new-type',
    name: 'Your Validation Name',
    icon: <YourIcon size={18} />,
    color: '#hexcolor',
    description: 'Description of what this validation does'
  }
];
```

### Step 3: Implement Data Collection (Main Process)

#### Option A: Extend ViolationCollectionService (Recommended for code analysis tools)

If your validation produces file-level issues similar to ESLint/TypeScript:

1. Add detection logic in `ViolationCollectionService.ts`:

```typescript
private async collectYourValidation(
  rootPath: string,
  packagePath: string
): Promise<FileViolations[]> {
  const results: FileViolations[] = [];
  
  // Run your validation tool
  // Parse results
  // Convert to FileViolations format
  
  return results;
}
```

2. Call your collector in the main `collectViolations` method:

```typescript
if (options.includeYourType && pkg.hasYourType) {
  const yourResults = await this.collectYourValidation(rootPath, fullPackagePath);
  yourResults.forEach(file => {
    fileViolations.set(file.relativePath, file);
  });
}
```

#### Option B: Create a Separate Service (Recommended for different data structures)

For validations with different data structures (like coverage):

1. Create a new service file:

```typescript
// src/main/services/YourValidationService.ts
export class YourValidationService {
  async collect(
    rootPath: string,
    packages: PackageInfo[],
    options: YourOptions
  ): Promise<YourValidationResult> {
    // Implementation
  }
}
```

2. Add IPC handler:

```typescript
// src/main/handlers/YourValidationHandlers.ts
ipcMain.handle('your-validation:collect', async (
  event,
  rootPath,
  packages,
  options
) => {
  return yourValidationService.collect(rootPath, packages, options);
});
```

3. Create renderer-side service:

```typescript
// src/renderer/services/YourValidationServiceIPC.ts
class YourValidationServiceIPC {
  async collect(source, packages, options) {
    return await window.electron.ipcRenderer.invoke(
      'your-validation:collect',
      source.location,
      packages,
      options
    );
  }
}
```

### Step 4: Convert Data to ValidationResult Format

In `ValidationsTab.tsx`, extend the `convertToValidationResult` function:

```typescript
const convertToValidationResult = useCallback((
  violationData: ViolationMonitoringResult | YourDataType,
  validationType: ValidationType,
  currentSelectedPackage: PackageLayer | null
): ValidationResult | null => {
  
  if (validationType === 'your-new-type') {
    // Convert your data format to ValidationResult
    return {
      id: `${validationType}-${Date.now()}`,
      tool: ValidationTool.YourTool, // Add to ValidationTool const
      category: ValidationCategory.YourCategory, // Add to ValidationCategory const
      status: yourData.hasErrors ? ValidationStatus.Error : ValidationStatus.Success,
      scope: {
        packagePath: currentSelectedPackage.packageData.path,
        packageName: currentSelectedPackage.packageData.name,
        filesAnalyzed: {
          total: yourData.filesAnalyzed,
          included: yourData.files,
        }
      },
      summary: {
        totalIssues: yourData.totalIssues,
        bySeverity: {
          errors: yourData.errors,
          warnings: yourData.warnings,
          info: yourData.info,
          suggestions: 0
        },
        filesWithIssues: yourData.filesWithIssues,
        totalFilesAnalyzed: yourData.filesAnalyzed,
        duration: yourData.duration,
        timestamp: new Date()
      },
      issues: yourData.issues.map(issue => ({
        file: issue.file,
        line: issue.line,
        column: issue.column,
        severity: mapYourSeverity(issue.severity),
        message: issue.message,
        rule: issue.rule
      }))
    };
  }
  
  // ... existing conversion logic
}, []);
```

### Step 5: Handle Refresh Logic

Update the refresh button handler to trigger your validation:

```typescript
const refreshValidation = useCallback(() => {
  if (selectedValidationType === 'your-new-type') {
    // Trigger your validation collection
    yourValidationService.collect(/* params */);
  } else {
    // Existing refresh logic
    onRefresh?.();
  }
}, [selectedValidationType, onRefresh]);
```

## Example: Migrating Coverage Tab

Here's how to migrate the existing Coverage tab:

### 1. Data Structure

Coverage data typically includes:
- File paths with coverage percentages
- Line-by-line coverage information
- Branch coverage data
- Summary statistics

### 2. Conversion Function

```typescript
const convertCoverageToValidationResult = (
  coverageData: CoverageData,
  packageInfo: PackageLayer
): ValidationResult => {
  const uncoveredFiles = coverageData.files.filter(f => f.coverage < 80);
  
  return {
    id: `coverage-${Date.now()}`,
    tool: ValidationTool.Jest,
    category: ValidationCategory.Testing,
    status: coverageData.totalCoverage >= 80 
      ? ValidationStatus.Success 
      : ValidationStatus.Warning,
    scope: {
      packagePath: packageInfo.packageData.path,
      packageName: packageInfo.packageData.name,
      filesAnalyzed: {
        total: coverageData.files.length,
        included: coverageData.files.map(f => f.path)
      }
    },
    summary: {
      totalIssues: uncoveredFiles.length,
      bySeverity: {
        errors: 0,
        warnings: uncoveredFiles.length,
        info: 0,
        suggestions: 0
      },
      filesWithIssues: uncoveredFiles.length,
      totalFilesAnalyzed: coverageData.files.length,
      duration: 0,
      timestamp: new Date()
    },
    issues: uncoveredFiles.map(file => ({
      file: file.path,
      line: 0,
      column: 0,
      severity: ValidationSeverity.Warning,
      message: `File has ${file.coverage}% coverage (threshold: 80%)`,
      category: 'coverage'
    }))
  };
};
```

## Best Practices

### 1. Type Safety
- Always use const objects instead of enums for better webpack compatibility
- Define clear interfaces for your data structures
- Use type guards when handling different validation types

### 2. Performance
- Implement caching in your service layer
- Use abort controllers for cancellable operations
- Limit file processing with reasonable defaults

### 3. Error Handling
- Gracefully handle missing configurations
- Provide clear error messages
- Fall back to empty results rather than crashing

### 4. User Experience
- Show loading states during validation
- Provide progress indicators for long-running validations
- Allow users to cancel ongoing validations
- Cache results appropriately

## Testing Your Migration

1. **Unit Tests**
   - Test data conversion functions
   - Test service methods
   - Test IPC communication

2. **Integration Tests**
   - Test full flow from UI trigger to result display
   - Test package switching
   - Test error scenarios

3. **Manual Testing Checklist**
   - [ ] Package selector shows all packages
   - [ ] Validation type switch works
   - [ ] Refresh button triggers validation
   - [ ] Results display correctly
   - [ ] Error states handled gracefully
   - [ ] Loading states shown appropriately

## Common Issues and Solutions

### Issue: Validation data not updating
**Solution**: Ensure you're calling the refresh callback and properly managing state

### Issue: Package mismatch errors
**Solution**: Use absolute paths for matching, store both relative and absolute paths

### Issue: TypeScript enums not working at runtime
**Solution**: Use const objects with `as const` assertion instead of enums

### Issue: IPC communication failures
**Solution**: Ensure handlers are registered in main process before renderer tries to invoke

## Next Steps

After migrating a validation type:

1. Remove the old tab component
2. Update the tab navigation to remove old entry
3. Clean up unused imports and services
4. Update documentation
5. Test thoroughly with different package configurations

## Questions or Issues?

If you encounter issues during migration:
1. Check the existing ESLint/TypeScript implementation for reference
2. Review the console logs for detailed error messages
3. Ensure all TypeScript types are properly defined
4. Verify IPC handlers are registered correctly