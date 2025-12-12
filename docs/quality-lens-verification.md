# Quality Lens Verification Guide

This document outlines how to verify that each quality lens is working correctly, providing proper results and enabling highlight layers on the code map.

## Prerequisites

1. Ensure `@principal-ai/codebase-quality-lenses` is at version 0.1.6 or higher
2. Have a test repository with various code quality states (clean files, files with issues, etc.)
3. Open the Repository Manager for your test repository
4. Navigate to the Tools tab

## Core Verification Points

For each lens, verify:

1. **Execution Success**: Tool runs without errors
2. **Result Structure**: Lens result contains expected fields
3. **Analyzed Files**: All analyzed files are included (not just files with issues)
4. **Highlight Layers**: Code map shows appropriate highlights
5. **Metrics Accuracy**: File counts and issue counts are correct

## Lens-Specific Verification

### ESLint Lens

**Tool**: ESLint (JavaScript/TypeScript linting)
**Command**: `npm run lint -- --format json` or `eslint . --format json`

**Expected Lens Result Structure**:
```javascript
{
  success: boolean,
  issues: Array<{
    file: string,
    line: number,
    column: number,
    severity: 'error' | 'warning' | 'info',
    message: string,
    rule?: string
  }>,
  metrics: {
    filesAnalyzed: number,
    totalIssues: number,
    errors: number,
    warnings: number,
    fixableIssues?: number
  },
  analyzedFiles: Array<string> // All files that were analyzed
}
```

**Verification Steps**:
1. Run ESLint on a package with both clean and problematic files
2. Check console for: `[createHighlightLayers] Using X analyzed files for success layer`
3. Verify `analyzedFiles` array contains all scanned files (not just files with issues)
4. Confirm highlight layers:
   - Red/Orange for files with errors/warnings
   - Green for clean files that were analyzed
   - No highlight for files that weren't analyzed

**Known Good Test Case**: Run on `core-library` (96 files, all clean)

### TypeScript Lens

**Tool**: TypeScript Compiler (Type checking)
**Command**: `npm run typecheck` or `tsc --noEmit`

**Expected Lens Result Structure**:
```javascript
{
  success: boolean,
  issues: Array<{
    file: string,
    line: number,
    column: number,
    severity: 'error',
    message: string,
    code: number
  }>,
  metrics: {
    filesAnalyzed: number,
    totalIssues: number,
    errors: number
  },
  analyzedFiles?: Array<string> // Should include all .ts/.tsx files checked
}
```

**Verification Steps**:
1. Run TypeScript check on a package
2. Verify all TypeScript files in the project are included in `analyzedFiles`
3. Check that type errors show correct file locations
4. Confirm highlight layers show type errors in red

### Jest Lens

**Tool**: Jest (Test runner)
**Command**: `npm test -- --json` or `jest --json`

**Expected Lens Result Structure**:
```javascript
{
  success: boolean,
  testResults: {
    passed: number,
    failed: number,
    skipped: number,
    total: number,
    duration: number
  },
  coverage?: {
    lines: { percent: number },
    statements: { percent: number },
    functions: { percent: number },
    branches: { percent: number }
  },
  failedTests?: Array<{
    file: string,
    name: string,
    message: string
  }>,
  metrics: {
    filesAnalyzed: number, // Test files analyzed
    testSuites: number,
    tests: number
  },
  analyzedFiles?: Array<string> // Test files that were run
}
```

**Verification Steps**:
1. Run tests with and without coverage
2. Verify test files appear in `analyzedFiles`
3. Check failed tests show proper file locations
4. Confirm highlight layers:
   - Green for passing test files
   - Red for failing test files
   - Coverage overlay if coverage data exists

### Knip Lens

**Tool**: Knip (Dead code detection)
**Command**: `knip` or `npx knip`

**Expected Lens Result Structure**:
```javascript
{
  success: boolean,
  issues: Array<{
    file: string,
    type: 'unused-export' | 'unused-file' | 'missing-dependency' | 'unlisted-dependency',
    symbol?: string,
    line?: number,
    column?: number,
    severity: 'warning',
    message: string
  }>,
  metrics: {
    filesAnalyzed: number,
    unusedExports: number,
    unusedFiles: number,
    missingDependencies: number,
    unlistedDependencies: number
  },
  analyzedFiles?: Array<string> // All files that Knip analyzed
}
```

**Verification Steps**:
1. Run Knip on a package with some unused exports
2. Verify `analyzedFiles` includes all source files
3. Check that unused code is properly identified
4. Confirm highlight layers:
   - Yellow/Orange for files with unused code
   - Green for files with all exports used

### Git Lens

**Tool**: Git (Version control operations)
**Commands**: Various git commands

**Expected Lens Result Structure**:
```javascript
{
  success: boolean,
  command: string, // The git command that was run
  output?: string, // Command output
  data?: {
    // Varies by command:
    status?: { /* git status data */ },
    diff?: { /* git diff data */ },
    log?: Array<{ /* commit data */ }>,
    blame?: Array<{ /* blame data */ }>
  },
  metrics?: {
    filesChanged?: number,
    insertions?: number,
    deletions?: number
  }
}
```

**Verification Steps**:
1. Run various git commands (status, diff, log)
2. Verify output is properly parsed into `data` field
3. Check that file paths in results are relative to repo root
4. Git lens typically doesn't create highlight layers (informational only)

## Testing Workflow

### 1. Individual Lens Test
```javascript
// In Tools tab, for each tool:
1. Click "Run" button next to the tool
2. Open browser DevTools Console
3. Look for:
   - [QualityLensService] logs showing execution
   - [createHighlightLayers] logs showing file processing
   - Tool execution results in the UI
4. Switch to code map view
5. Verify highlight layers are visible and accurate
```

### 2. Success Case Verification
- Use a clean package/repository
- Run each lens
- Verify green success layers appear for analyzed files
- Ensure `analyzedFiles` is populated even with no issues

### 3. Failure Case Verification
- Introduce deliberate issues (lint errors, type errors, failing tests)
- Run each lens
- Verify error highlight layers appear
- Check that issue locations are accurate

### 4. Edge Cases to Test
- Empty packages (no files to analyze)
- Packages with only ignored files
- Monorepo with multiple packages
- Very large packages (performance check)
- Packages with non-standard configurations

## Debugging Tips

### Check Lens Configuration
```javascript
console.log(`[QualityLensService] Using ${lens.name} lens for tool: ${toolName}`);
```

### Verify Analyzed Files
```javascript
console.log(`[createHighlightLayers] Checking for analyzedFiles:`, {
  hasAnalyzedFiles: !!analyzedFiles,
  analyzedFilesLength: analyzedFiles?.length,
  sampleAnalyzedFile: analyzedFiles?.[0]
});
```

### Monitor Highlight Layer Creation
```javascript
console.log(`[createHighlightLayers] Creating layers:`, {
  tool: result.toolName,
  issueCount: result.lensResult?.issues?.length,
  filesAnalyzed: result.lensResult?.metrics?.filesAnalyzed,
  highlightCount: highlights.length
});
```

## Common Issues and Solutions

### Issue: No analyzed files in result
**Solution**: Check lens version is 0.1.6+, verify tool is outputting expected format

### Issue: Highlight layers not appearing
**Solution**: Ensure file paths are relative to repo root, check map refresh

### Issue: Tool execution fails
**Solution**: Verify tool is installed, check NODE_OPTIONS conflicts, ensure proper working directory

### Issue: Incorrect file counts
**Solution**: Check if tool is respecting ignore files, verify include/exclude patterns

## Future Improvements

1. **Automated Testing**: Create test suite that runs all lenses programmatically
2. **Result Caching**: Cache lens results to avoid redundant executions
3. **Progressive Updates**: Update highlights as tools run rather than waiting for completion
4. **Cross-Lens Integration**: Combine results from multiple lenses for comprehensive view
5. **Custom Lens Support**: Allow users to add their own quality lenses

## Feedback for Lens Library Team

When issues are found with the lens library, document them with:
1. Tool name and version
2. Command executed
3. Expected result structure
4. Actual result received
5. Specific field that's missing or incorrect
6. Impact on user experience

Example format for reporting issues:
```markdown
### ESLint Lens - Missing Analyzed Files
- **Version**: 0.1.5
- **Command**: `npm run lint -- --format json`
- **Issue**: `analyzedFiles` array not included when all files are clean
- **Impact**: Cannot show success highlights on code map
- **Expected**: Array of all analyzed file paths
- **Actual**: Field is missing
```