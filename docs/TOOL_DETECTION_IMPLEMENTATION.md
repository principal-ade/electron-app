# Tool Detection Implementation Plan

## Overview
Implementation of tool detection functionality for the Repository Monitoring Server. This feature identifies available quality tools in each package without executing them, providing insights into the project's quality infrastructure.

## Phase 2b: Tool Detection (Identification Only - No Execution)

### Core Types and Imports

#### Using Existing Types
```typescript
// From src/shared/tool-validation-types.ts (ALREADY EXISTS)
import type {
  DetectedTool,         // Tool found in a package
  ToolDetectionResult,  // Result of tool detection
  ToolInfo,            // Tool metadata
  ToolType,            // Tool categorization
  ValidationTemplate,   // Validation configuration
} from '../../shared/tool-validation-types';

// DetectedTool already includes:
// - name: string
// - version: string
// - packages: string[] (dependencies found)
// - configFiles: string[] (config files found)
// - availableScripts: Record<string, string>
// - packageManager: PackageManager
// - packagePath: string
// - hasIgnoreFile?: boolean

// ToolDetectionResult already includes:
// - packagePath: string
// - packageName: string
// - detectedTools: DetectedTool[]
// - suggestedTemplates: ValidationTemplate[]
```

#### Additional Types We're Importing
```typescript
// From @principal-ai/codebase-composition (v0.2.6)
import type {
  PackageLayer,      // Package information from discoverPackages
  QualityMetrics     // The 6 metrics we map tools to
} from '@principal-ai/codebase-composition';

// From @principal-ai/repository-abstraction (v0.2.0+)
import type {
  FileTree          // File tree structure for searching config files
} from '@principal-ai/repository-abstraction';
```

#### Mapping Tools to Quality Metrics
```typescript
// Tool categories map to QualityMetrics properties:
// ToolType 'linter' → QualityMetrics.linting
// ToolType 'test-runner' → QualityMetrics.tests
// ToolType 'compiler' (TypeScript) → QualityMetrics.types
// ToolType 'formatter' → QualityMetrics.formatting
// Documentation tools → QualityMetrics.documentation
// Dead code tools → QualityMetrics.deadCode
```

### Implementation Files

#### 1. ToolDetector.ts
```typescript
// src/repository-monitoring-server/ToolDetector.ts
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { FileTree } from '@principal-ai/repository-abstraction';
import * as path from 'path';
import * as fs from 'fs/promises';

export class ToolDetector {
  /**
   * Detect all available tools for a package
   */
  async detectTools(
    packageLayer: PackageLayer,
    fileTree: FileTree,
    repoPath: string
  ): Promise<DetectedTool[]> {
    const tools: DetectedTool[] = [];
    const packagePath = packageLayer.packageData.path || '';

    // Check each tool category
    tools.push(...await this.detectLintingTools(packageLayer, fileTree, repoPath));
    tools.push(...await this.detectTestingTools(packageLayer, fileTree, repoPath));
    tools.push(...await this.detectTypeTools(packageLayer, fileTree, repoPath));
    tools.push(...await this.detectFormattingTools(packageLayer, fileTree, repoPath));
    tools.push(...await this.detectDocumentationTools(packageLayer, fileTree, repoPath));
    tools.push(...await this.detectDeadCodeTools(packageLayer, fileTree, repoPath));

    return tools;
  }

  /**
   * Create PackageTools summary for a package
   */
  createPackageToolsSummary(
    packageLayer: PackageLayer,
    tools: DetectedTool[]
  ): PackageTools {
    return {
      packagePath: packageLayer.packageData.path || '',
      packageName: packageLayer.packageData.name,
      tools,
      summary: {
        hasLinting: tools.some(t => t.category === 'linting'),
        hasTesting: tools.some(t => t.category === 'testing'),
        hasTypeChecking: tools.some(t => t.category === 'types'),
        hasFormatting: tools.some(t => t.category === 'formatting'),
        hasDocumentation: tools.some(t => t.category === 'documentation'),
        hasDeadCodeDetection: tools.some(t => t.category === 'deadCode'),
      }
    };
  }
}
```

#### 2. Integration with RepositoryMonitoringServer
```typescript
// src/repository-monitoring-server/RepositoryMonitoringServer.ts (additions)
import { ToolDetector } from './ToolDetector';

class RepositoryMonitoringServer {
  private toolDetector: ToolDetector;
  private toolsCache: Map<string, { data: ToolDetectionResult; timestamp: number }>;

  async getAvailableTools(repoPath: string): Promise<ToolDetectionResult | null> {
    // Check cache first (5 minute TTL)
    const cached = this.toolsCache.get(repoPath);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }

    // Get packages and file tree (reuse existing methods)
    const packages = await this.getPackages(repoPath);
    const fileTree = await this.getFileTree(repoPath);

    if (!packages || !fileTree) return null;

    // Detect tools for each package
    const packageTools: PackageTools[] = [];
    for (const pkg of packages.packages) {
      const tools = await this.toolDetector.detectTools(pkg, fileTree, repoPath);
      packageTools.push(this.toolDetector.createPackageToolsSummary(pkg, tools));
    }

    // Create repository summary
    const result: ToolDetectionResult = {
      packages: packageTools,
      repositorySummary: this.createRepositorySummary(packageTools)
    };

    // Cache result
    this.toolsCache.set(repoPath, { data: result, timestamp: Date.now() });

    return result;
  }
}
```

#### 3. API Integration
```typescript
// src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts (additions)
import type { DetectedTool, PackageTools, ToolDetectionResult } from '../../repository-monitoring-server/types';

export enum RepositoryMonitoringAPIEvent {
  // ... existing events
  GET_AVAILABLE_TOOLS = 'repository-monitoring:get-available-tools',
}

export interface RepositoryMonitoringAPI {
  // ... existing methods
  getAvailableTools(repoPath: string): Promise<ToolDetectionResult | null>;
}
```

### Tool Detection Patterns

| Tool Category | Tools to Detect | Detection Method |
|--------------|-----------------|------------------|
| **Linting** | ESLint, TSLint, StandardJS, XO | Check deps + config files + scripts |
| **Testing** | Jest, Mocha, Vitest, Jasmine, Ava | Check deps + config + test scripts |
| **Type Checking** | TypeScript, Flow | Check deps + tsconfig.json |
| **Formatting** | Prettier, StandardJS | Check deps + config + format scripts |
| **Documentation** | JSDoc, TypeDoc, TSDoc | Check deps + config + doc scripts |
| **Dead Code** | Knip, ts-prune, ts-unused-exports | Check deps + scripts |

### Detection Logic Examples

#### ESLint Detection
```typescript
private async detectESLint(packageLayer: PackageLayer): Promise<DetectedTool | null> {
  const deps = {
    ...packageLayer.packageData.dependencies,
    ...packageLayer.packageData.devDependencies
  };

  // Check if ESLint is installed
  const hasESLint = !!deps['eslint'];
  if (!hasESLint) return null;

  // Find config files
  const configPatterns = [
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.json',
    '.eslintrc.yml',
    'eslint.config.js'
  ];

  // Find related scripts
  const scripts = packageLayer.packageData.scripts || {};
  const eslintScripts = Object.keys(scripts).filter(
    name => name.includes('lint') || scripts[name].includes('eslint')
  );

  return {
    name: 'eslint',
    category: 'linting',
    available: true,
    version: deps['eslint'],
    configFiles: foundConfigs,
    scripts: eslintScripts,
    packagePath: packageLayer.packageData.path || ''
  };
}
```

### UI Component Structure

```typescript
// src/renderer/pages/RepoManager/RepositoryMaintenanceView.tsx
// Add new "Tools" tab alongside existing tabs

// New component: src/renderer/pages/RepoManager/shared/ToolsTab.tsx
export function ToolsTab({ directory }: { directory: string }) {
  const [tools, setTools] = useState<ToolDetectionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    RepositoryMonitoringService.getAvailableTools(directory)
      .then(setTools)
      .finally(() => setLoading(false));
  }, [directory]);

  // Display tools grouped by package
  // Show tool categories with checkmarks/badges
  // List config files and scripts
}
```

## Implementation Steps

1. **Create ToolDetector.ts** ✅
   - Implement detection methods for each tool category
   - Parse package.json dependencies and scripts
   - Search for config files in FileTree

2. **Update RepositoryMonitoringServer** ✅
   - Add getAvailableTools method
   - Integrate with existing caching
   - Reuse packages and FileTree data

3. **Add IPC/API Methods** ✅
   - Update RepositoryMonitoringAPI interface
   - Add IPC handlers in main and worker
   - Update RepositoryMonitoringService in renderer

4. **Create Tools Tab UI** ✅
   - Add tab to RepositoryMaintenanceView
   - Create ToolsTab component
   - Display tools by package with categories

5. **Test with Different Packages** ✅
   - Monorepos (multiple packages)
   - Single package projects
   - Projects with various tool combinations

## Benefits

1. **No Execution Required** - Fast, safe identification only
2. **Package-Aware** - Works correctly with monorepos
3. **Comprehensive Detection** - Multiple detection methods per tool
4. **Quality Metrics Mapping** - Clear connection to the 6 metrics
5. **Future Extensibility** - Can add tool execution later

## Next Steps

After tool detection is complete:
1. Add tool execution capabilities (Phase 2c)
2. Calculate quality metrics from tool outputs
3. Display metrics in QualityHexagon component
4. Replace Validation tab with Tools tab