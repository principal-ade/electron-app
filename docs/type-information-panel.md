# Type Information Panel - Implementation Documentation

## Overview

The Type Information Panel is a new dev workspace panel that allows users to browse and search TypeScript types in their project. Users can click on types to expand and view their definitions.

**Status:** ✅ UI Complete, 🚧 Data Integration Pending

**Created:** 2026-02-01

---

## What We Built

### 1. Panel Component
**Location:** `src/renderer/panels/TypeInformationPanel/TypeInformationPanel.tsx`

**Features:**
- Search bar with 300ms debounced filtering
- List of TypeScript types (interfaces, types, classes, enums, functions)
- Click to expand/collapse type definitions
- Multiple types can be expanded simultaneously
- Color-coded type badges by kind
- Chevron animation on expand/collapse
- Empty states and loading states
- Integrates with panel framework (context, actions, events)

**Key UI Elements:**
- Header with title and refresh button
- Search input with icon and result count
- Type list with:
  - Icon indicator (by kind)
  - Type name in monospace font
  - Kind badge (color-coded)
  - File path
  - Expandable definition section with syntax highlighting

### 2. Panel Definition
**Location:** `src/renderer/panels/TypeInformationPanel/index.tsx`

```typescript
metadata: {
  id: 'principal-ade.type-information',
  name: 'Type Information',
  description: 'Browse and search TypeScript types in your project',
  version: '1.0.0',
  author: 'Principal ADE',
  icon: 'file-type',
  slices: [], // Currently no data slices - will need custom slice
}
```

### 3. Storybook Stories
**Location:** `src/renderer/panels/TypeInformationPanel/TypeInformationPanel.stories.tsx`

**Story Variants:**
- Default (20 types)
- NoRepository (empty state)
- FewTypes (5 types)
- ManyTypes (25 types for scrolling)
- LoadingState
- Interactive (with controls)

### 4. Integration Points

**DevWorkspacePanelFramework:**
- Imported panel definition
- Registered TypeInformationPanelComponent
- Added to allPanels array
- Added to useMemo dependencies

**Repository Panel Catalog:**
- Added to `repositoryPanelCatalog.ts`
- Available on surfaces: explorer, manager, principal

**Titlebar Dropdown:**
- Added to AVAILABLE_PANELS in `DevWorkspaceTitlebar.tsx`
- Users can select it from left/right panel dropdowns

---

## Current State: Mock Data

### Mock Type List

**File:** `TypeInformationPanel.tsx` (lines 64-86)

Currently uses a hardcoded array of 8 mock types:

```typescript
const mockTypes: ExtractedType[] = [
  { name: 'UserProfile', kind: 'interface', filePath: 'src/types/user.ts' },
  { name: 'ApiResponse', kind: 'type', filePath: 'src/types/api.ts' },
  { name: 'Repository', kind: 'interface', filePath: 'src/types/repository.ts' },
  { name: 'GitStatus', kind: 'type', filePath: 'src/types/git.ts' },
  { name: 'PanelContextValue', kind: 'interface', filePath: 'src/types/panel.ts' },
  { name: 'ThemeColors', kind: 'enum', filePath: 'src/types/theme.ts' },
  { name: 'ValidationError', kind: 'class', filePath: 'src/utils/errors.ts' },
  { name: 'formatDate', kind: 'function', filePath: 'src/utils/date.ts' },
];
```

**Comment in code:**
```typescript
// Mock data for now - in real implementation, would scan all .ts/.tsx files
// and call TypeSchemaService.extractTypes() for each
```

### Mock Type Definitions

**File:** `TypeInformationPanel.tsx` (lines 150-186)

The `getMockDefinition()` function generates fake TypeScript definitions based on the type kind:

```typescript
const getMockDefinition = (type: ExtractedType): string => {
  switch (type.kind) {
    case 'interface':
      return `interface ${type.name} {\n  id: string;\n  name: string;\n  ...`;
    case 'type':
      return `type ${type.name} = {\n  success: boolean;\n  data?: any;\n  ...`;
    // etc.
  }
};
```

**Comment in code:**
```typescript
// Mock definition for now - in real implementation, use TypeSchemaService
```

---

## Available Services (Ready to Use)

### TypeSchemaService
**Location:** `src/main/services/type-schema/TypeSchemaService.ts`

This service is **already implemented** and provides:

#### Methods:

1. **`extractTypes(filePath, tsConfigPath?)`**
   - Extracts all exported types from a TypeScript file
   - Returns: `Promise<string[]>` - Array of type names
   - Uses regex fallback + TypeScript compiler API

2. **`generateSchemas(options)`**
   - Generates JSON schemas from TypeScript types
   - Options: `{ files: string[], tsConfigPath?: string }`
   - Returns: `Promise<Record<string, JSONSchema>>`

3. **`validateTypeExists(filePath, typeName, tsConfigPath?)`**
   - Checks if a specific type exists in a file
   - Returns: `Promise<boolean>`

4. **`generateDeclarations(filePath, tsConfigPath?)`**
   - Generates TypeScript declaration (.d.ts) content
   - Returns: `Promise<string>`
   - **This is what we need for type definitions!**

### TypeSchemaService API (IPC)
**Location:** `src/renderer/main-process-api/TypeSchemaService.ts`

Renderer-side wrapper that calls the main process service via IPC:

```typescript
class TypeSchemaService {
  static async generateSchemas(options: GenerateSchemasOptions): Promise<...>
  static async extractTypes(filePath: string, tsConfigPath?: string): Promise<string[]>
  static async validateTypeExists(filePath, typeName, tsConfigPath?): Promise<boolean>
  static async generateDeclarations(filePath, tsConfigPath?): Promise<string>
}
```

**Already wired up and ready to use!**

---

## What Needs to Be Done: Real Data Integration

### Step 1: Scan Repository for TypeScript Files

**Approach A: Use FileTree Slice (Recommended)**
```typescript
const fileTreeSlice = context.getSlice<FileTree>('fileTree');
const allFiles = fileTreeSlice?.data;

// Filter for .ts and .tsx files (excluding .d.ts, node_modules, dist)
const tsFiles = filterTypeScriptFiles(allFiles);
```

**Approach B: File System Scan**
```typescript
// Use glob or file system APIs to find all .ts/.tsx files
const tsFiles = await glob('**/*.{ts,tsx}', {
  cwd: repository.path,
  ignore: ['**/*.d.ts', '**/node_modules/**', '**/dist/**']
});
```

### Step 2: Extract Types from Each File

Replace the mock types in `loadTypes()`:

```typescript
const loadTypes = async () => {
  if (!repository?.path) return;

  setIsLoading(true);
  try {
    // 1. Get all TypeScript files
    const fileTreeSlice = context.getSlice<FileTree>('fileTree');
    const tsFiles = extractTypeScriptFiles(fileTreeSlice?.data);

    // 2. Extract types from each file
    const allTypes: ExtractedType[] = [];

    for (const file of tsFiles) {
      const filePath = path.join(repository.path, file.path);

      try {
        // Call TypeSchemaService to get type names
        const typeNames = await TypeSchemaService.extractTypes(
          filePath,
          path.join(repository.path, 'tsconfig.json')
        );

        // Create ExtractedType objects
        for (const typeName of typeNames) {
          // Determine kind by analyzing the file or using compiler API
          const kind = await determineTypeKind(filePath, typeName);

          allTypes.push({
            name: typeName,
            kind: kind,
            filePath: file.path, // Relative path
          });
        }
      } catch (error) {
        console.warn(`Failed to extract types from ${file.path}:`, error);
      }
    }

    setTypes(allTypes);
    setFilteredTypes(allTypes);
  } catch (error) {
    console.error('Failed to load types:', error);
  } finally {
    setIsLoading(false);
  }
};
```

### Step 3: Fetch Real Type Definitions

Replace `getMockDefinition()` with real type extraction:

```typescript
const handleTypeSelect = async (type: ExtractedType) => {
  const typeKey = `${type.filePath}:${type.name}`;

  // Toggle expansion (same as before)
  const newExpandedTypes = new Set(expandedTypes);
  if (newExpandedTypes.has(typeKey)) {
    newExpandedTypes.delete(typeKey);
    setExpandedTypes(newExpandedTypes);
    return;
  }

  newExpandedTypes.add(typeKey);
  setExpandedTypes(newExpandedTypes);
  setSelectedType(type);

  // If we already have the definition, don't fetch again
  if (typeDefinitions.has(typeKey)) {
    return;
  }

  // Fetch REAL type definition
  setLoadingDefinition(typeKey);
  try {
    const absolutePath = path.join(repository!.path, type.filePath);
    const tsConfigPath = path.join(repository!.path, 'tsconfig.json');

    // Get the full declaration file content
    const declarations = await TypeSchemaService.generateDeclarations(
      absolutePath,
      tsConfigPath
    );

    // Extract just the specific type's definition from the declarations
    const typeDefinition = extractTypeDefinition(declarations, type.name);

    setTypeDefinitions((prev) => new Map(prev).set(typeKey, typeDefinition));
  } catch (error) {
    console.error('Failed to fetch type definition:', error);
    setTypeDefinitions((prev) => new Map(prev).set(
      typeKey,
      `// Error: Could not load definition for ${type.name}`
    ));
  } finally {
    setLoadingDefinition(null);
  }
};
```

### Step 4: Helper Functions Needed

#### `extractTypeScriptFiles(fileTree: FileTree): Array<{ path: string }>`
```typescript
function extractTypeScriptFiles(fileTree: FileTree | null): Array<{ path: string }> {
  if (!fileTree) return [];

  const tsFiles: Array<{ path: string }> = [];

  const traverse = (node: FileTreeNode, currentPath: string) => {
    if (node.type === 'file') {
      if ((node.path.endsWith('.ts') || node.path.endsWith('.tsx'))
          && !node.path.endsWith('.d.ts')) {
        tsFiles.push({ path: currentPath });
      }
    } else if (node.type === 'directory' && node.children) {
      // Skip common ignore directories
      if (['node_modules', 'dist', 'build', '.git'].includes(node.name)) {
        return;
      }

      for (const child of node.children) {
        traverse(child, path.join(currentPath, child.name));
      }
    }
  };

  traverse(fileTree.root, '');
  return tsFiles;
}
```

#### `determineTypeKind(filePath: string, typeName: string): Promise<TypeKind>`
```typescript
async function determineTypeKind(
  filePath: string,
  typeName: string
): Promise<'interface' | 'type' | 'class' | 'enum' | 'function'> {
  // Option 1: Parse file content with regex
  const content = await fs.readFile(filePath, 'utf-8');

  if (content.includes(`interface ${typeName}`)) return 'interface';
  if (content.includes(`type ${typeName}`)) return 'type';
  if (content.includes(`class ${typeName}`)) return 'class';
  if (content.includes(`enum ${typeName}`)) return 'enum';
  if (content.includes(`function ${typeName}`) ||
      content.includes(`const ${typeName} = (`)) return 'function';

  return 'type'; // default fallback

  // Option 2: Use TypeScript compiler API (more accurate but slower)
  // Would require extending TypeSchemaService with a new method
}
```

#### `extractTypeDefinition(declarations: string, typeName: string): string`
```typescript
function extractTypeDefinition(declarations: string, typeName: string): string {
  // Parse the declarations file to find the specific type
  const lines = declarations.split('\n');
  const result: string[] = [];
  let capturing = false;
  let braceDepth = 0;

  for (const line of lines) {
    // Start capturing when we find the type declaration
    if (line.includes(`interface ${typeName}`) ||
        line.includes(`type ${typeName}`) ||
        line.includes(`class ${typeName}`) ||
        line.includes(`enum ${typeName}`) ||
        line.includes(`function ${typeName}`)) {
      capturing = true;
    }

    if (capturing) {
      result.push(line);

      // Track braces to know when definition ends
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;

      // End capturing when braces are balanced or line ends with semicolon
      if (braceDepth === 0 && (line.includes('}') || line.includes(';'))) {
        break;
      }
    }
  }

  return result.join('\n') || `// Definition not found for ${typeName}`;
}
```

### Step 5: Performance Optimization (Future)

For large codebases, consider:

1. **Lazy Loading:** Only scan files when the panel is opened
2. **Caching:** Cache extracted types in a data slice or local storage
3. **Incremental Updates:** Watch for file changes and update only affected types
4. **Batch Processing:** Process files in chunks to avoid blocking UI
5. **Web Workers:** Move type extraction to a background worker

---

## Data Slice Considerations

### Option 1: No Custom Slice (Current)
- Panel manages its own state
- Fetches data on demand
- Simple but doesn't share data with other panels

### Option 2: Create Custom "types" Slice (Recommended Future)
```typescript
// In RepositoryPanelContext.tsx
const [typesData, setTypesData] = useState<ExtractedType[] | null>(null);

const slices = new Map([
  // ... existing slices
  ['types', {
    scope: 'repository',
    name: 'types',
    data: typesData,
    loading: typesLoading,
    error: typesError,
    refresh: refreshTypes,
  }],
]);
```

Benefits:
- Other panels can access type information
- Centralized caching
- Consistent with other repository data

---

## Testing Strategy

### Unit Tests
1. Test `extractTypeScriptFiles()` filter logic
2. Test `extractTypeDefinition()` parsing
3. Test `determineTypeKind()` detection

### Integration Tests
1. Test TypeSchemaService.extractTypes() with real files
2. Test TypeSchemaService.generateDeclarations() output
3. Test panel with actual TypeScript project

### Manual Testing
1. Open panel in a TypeScript project
2. Verify all types are listed
3. Test search filtering
4. Test expand/collapse
5. Verify definition accuracy
6. Test with edge cases (generic types, complex types, etc.)

---

## Known Limitations & Edge Cases

### Current Implementation
- Mock data only
- No syntax highlighting in definitions
- No type cross-references (clicking on referenced types)
- No export location indicators

### Future Considerations
1. **Generic Types:** `Array<T>`, `Promise<User>` - May need special parsing
2. **Conditional Types:** Complex type expressions may not display well
3. **Namespace Types:** Types inside namespaces need qualified names
4. **Re-exported Types:** `export { Foo } from './other'` may be missed
5. **Type Aliases:** Chains of type aliases may need resolution
6. **JSDoc Comments:** Could be extracted and displayed
7. **Large Files:** Files with 100+ types may need pagination

---

## Future Enhancements

### Short Term
1. Wire up real data using TypeSchemaService
2. Add syntax highlighting to definitions (use Monaco editor or Prism.js)
3. Show loading progress for large codebases
4. Add type count by kind in header

### Medium Term
1. Click on type references to jump to definition
2. Filter by type kind (interface, type, class, etc.)
3. Show file location with line numbers
4. Add "Copy Type" button
5. Show type dependencies/usage

### Long Term
1. Type graph visualization (dependencies between types)
2. Type coverage metrics
3. Integration with code editor (jump to file)
4. Type diff view for git changes
5. Export types as documentation
6. AI-powered type explanations

---

## Dependencies

### npm Packages (Already Installed)
- `typescript` - For TypeScript compiler API
- `ts-json-schema-generator` (v2.4.0) - Used by TypeSchemaService
- `@principal-ade/panel-framework-core` - Panel interfaces
- `@principal-ade/industry-theme` - Theming
- `lucide-react` - Icons

### Internal Services
- `TypeSchemaService` - Type extraction (already implemented)
- `RepositoryPanelContext` - Panel framework context
- `FileTree` - File structure data

---

## File Locations Reference

### Panel Files
- Component: `src/renderer/panels/TypeInformationPanel/TypeInformationPanel.tsx`
- Definition: `src/renderer/panels/TypeInformationPanel/index.tsx`
- Stories: `src/renderer/panels/TypeInformationPanel/TypeInformationPanel.stories.tsx`

### Integration Files
- Panel Framework: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`
- Panel Catalog: `src/shared/panels/repositoryPanelCatalog.ts`
- Titlebar: `src/renderer/dev-workspace/DevWorkspaceTitlebar.tsx`

### Services
- Type Schema Service (Main): `src/main/services/type-schema/TypeSchemaService.ts`
- Type Schema API (Renderer): `src/renderer/main-process-api/TypeSchemaService.ts`
- Type Schema IPC: `src/main/services/ipc/type-schema/typeSchemaHandlers.ts`

---

## Quick Start Guide for Future Developer

To wire up real data:

1. **Read this document** to understand the architecture
2. **Find the TODO comments** in `TypeInformationPanel.tsx`:
   - Line 64: "Mock data for now - in real implementation..."
   - Line 150: "Mock definition for now - in real implementation..."
3. **Implement Step 1-4** from "What Needs to Be Done" section above
4. **Test with a real TypeScript project**
5. **Consider performance optimizations** if needed
6. **Update this documentation** with any changes

---

## Questions or Issues?

Common issues and solutions:

**Q: TypeSchemaService not found?**
A: Make sure the import path is correct: `../../main-process-api/TypeSchemaService`

**Q: No types showing up?**
A: Check that the repository has TypeScript files and tsconfig.json

**Q: Type definitions look wrong?**
A: The TypeScript compiler API may need tsconfig.json path parameter

**Q: Performance issues?**
A: Implement caching and lazy loading as described in Step 5

---

## Changelog

- **2026-02-01:** Initial implementation with mock data, full UI, Storybook stories, and integration complete
