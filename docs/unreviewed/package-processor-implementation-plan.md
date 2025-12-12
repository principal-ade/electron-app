# PackageProcessor Implementation Plan

## Goal
Implement package extraction using `@principal-ai/codebase-composition` ONLY. Quality metrics will come later after validation.

## Existing Implementation to Copy
Found in `src/renderer/services/FileTreeSourceService.ts`:
- Uses `PackageLayerModule` from `@principal-ai/codebase-composition`
- Method `detectPackages()` that calls `packageModule.discoverPackages(fileTree, fileReader)`
- FileReader adapter pattern for reading package.json files
- Already handles caching of PackageLayer results

**Key code to replicate:**
1. Create `PackageLayerModule` instance
2. Create fileReader adapter that reads package.json files from disk
3. Call `discoverPackages(fileTree, fileReader)` to get PackageLayer[]
4. Generate PackageSummary from the PackageLayer array

## Implementation Order

### 1. Core Implementation
1. **Create PackageProcessor.ts**
   - Use `PackageLayer` type from `@principal-ai/codebase-composition`
   - Extract packages from FileTree
   - Generate PackageSummary
   - NO quality metrics at this stage

2. **Update RepositoryMonitoringServer.ts**
   - Add `getPackages()` method
   - Add handler for 'getPackages' message type
   - Cache package results

3. **Update worker-entry.ts**
   - Handle 'getPackages' message case
   - Return package data to main process

### 2. Quality Assurance
1. **Run linting**: `npm run lint`
2. **Run typecheck**: `npm run typecheck`
3. **Fix any issues found**

### 3. Testing
1. **Create PackageProcessor.test.ts**
   - Test package extraction from monorepo
   - Test package extraction from single package
   - Test PackageSummary generation
   - Mock FileTree data for tests

2. **Run tests**: `npm test`

### 4. UI Integration (InteractiveShell)
1. **Find InteractiveShell component**
2. **Add Repository Monitor section**
   - Add "Get Packages" button
   - Display package results
   - Show PackageSummary info

### 5. Validation
1. **Test with real repository**
   - Click "Get Packages" button
   - Verify packages are extracted correctly
   - Check monorepo detection works
   - Verify all package.json files found

### 6. RepoManager Migration
1. **Analyze current package usage in RepoManager**
2. **Replace with RepositoryMonitoringService calls**
3. **Test RepoManager still works**

## Key Points
- **NO QUALITY METRICS YET** - just package extraction
- Use existing `PackageLayer` type from codebase-composition
- Focus on getting package data flowing through the system
- Validate it works before adding complexity

## Success Criteria
- [ ] PackageProcessor extracts all packages from repository
- [ ] No linting errors
- [ ] No typecheck errors
- [ ] Tests pass
- [ ] UI button shows package data
- [ ] RepoManager uses new system