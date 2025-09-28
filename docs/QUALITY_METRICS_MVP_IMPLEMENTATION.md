# Quality Metrics MVP Implementation Plan

## Overview
This document outlines a simplified, iterative implementation plan for the Quality Metrics feature. The approach prioritizes getting a working UI with mock data first, then implementing the real analysis without caching to ensure tools work correctly.

## Current Status
- ✅ ESLint verification completed (see QUALITY_LENS_VERIFICATION.md)
- ✅ QualityHexagonPanel implemented with mock data
- ✅ Integration in RepositoryDetailsPanel
- 🚧 Embedding quality metrics in PackageLayer data structure

## Implementation Phases

### Phase 1: UI with Mock Service (Week 1)

#### Step 1.1: Create Mock Quality Metrics Service
Create a service that returns realistic mock data for development and testing.

**File:** `src/renderer/services/MockQualityMetricsService.ts`
```typescript
import { QualityMetrics, AnalysisOptions } from '../types/quality.types';

class MockQualityMetricsService {
  private mockInProgress = new Map<string, boolean>();

  async analyzeDirectory(
    directory: string,
    options?: AnalysisOptions
  ): Promise<QualityMetrics> {
    // Simulate analysis delay
    this.mockInProgress.set(directory, true);

    await this.simulateDelay(2000);

    this.mockInProgress.set(directory, false);

    // Return mock data with some randomization
    return this.generateMockMetrics(directory);
  }

  private generateMockMetrics(directory: string): QualityMetrics {
    const randomValue = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const metrics = {
      tests: randomValue(45, 95),
      deadCode: randomValue(5, 35),  // Lower is better
      formatting: randomValue(75, 100),
      linting: randomValue(60, 95),
      types: randomValue(70, 100),
      documentation: randomValue(20, 80),
    };

    const average = Object.values(metrics).reduce((a, b) => a + b, 0) / 6;

    let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
    if (average >= 95) tier = 'platinum';
    else if (average >= 85) tier = 'gold';
    else if (average >= 75) tier = 'silver';

    return {
      directory,
      timestamp: Date.now(),
      hexagon: metrics,
      tier,
      availableTools: ['eslint', 'typescript', 'jest', 'prettier'],
      toolResults: {
        eslint: {
          success: true,
          duration: randomValue(500, 2000),
          output: `✓ No linting errors found`
        },
        typescript: {
          success: true,
          duration: randomValue(1000, 3000),
          output: `✓ No type errors`
        },
        jest: {
          success: true,
          duration: randomValue(3000, 8000),
          output: `Test Suites: 12 passed, 12 total\nTests: 156 passed, 156 total`
        },
        prettier: {
          success: true,
          duration: randomValue(200, 800),
          output: `✓ All files formatted correctly`
        }
      },
      suggestions: this.generateSuggestions(metrics)
    };
  }

  private generateSuggestions(metrics: any): QualitySuggestion[] {
    const suggestions = [];

    if (metrics.tests < 80) {
      suggestions.push({
        type: 'improvement',
        metric: 'tests',
        message: 'Consider adding more test coverage',
        priority: 'high'
      });
    }

    if (metrics.documentation < 60) {
      suggestions.push({
        type: 'improvement',
        metric: 'documentation',
        message: 'Add JSDoc comments to exported functions',
        priority: 'medium'
      });
    }

    return suggestions;
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Simulate real-time updates
  subscribeToUpdates(
    directory: string,
    callback: (metrics: QualityMetrics) => void
  ): () => void {
    // Simulate progress updates
    const interval = setInterval(() => {
      if (this.mockInProgress.get(directory)) {
        // Send progress update
        callback(this.generateMockMetrics(directory));
      }
    }, 1000);

    return () => clearInterval(interval);
  }

  isAnalyzing(directory: string): boolean {
    return this.mockInProgress.get(directory) || false;
  }
}

export const MockQualityMetricsService = new MockQualityMetricsService();
```

#### Step 1.2: Create Quality Hexagon UI Component
Wrapper component that integrates with the service.

**File:** `src/renderer/components/quality/QualityHexagonPanel.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { QualityHexagon } from '@a24z/alexandria-ui';
import { MockQualityMetricsService } from '../../services/MockQualityMetricsService';
import { QualityMetrics } from '../../types/quality.types';
import './QualityHexagonPanel.css';

interface QualityHexagonPanelProps {
  directory: string;
  autoAnalyze?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const QualityHexagonPanel: React.FC<QualityHexagonPanelProps> = ({
  directory,
  autoAnalyze = false,
  size = 'md'
}) => {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoAnalyze && directory) {
      analyzeQuality();
    }
  }, [directory, autoAnalyze]);

  const analyzeQuality = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[QualityHexagon] Starting analysis for ${directory}`);
      const result = await MockQualityMetricsService.analyzeDirectory(directory);
      console.log('[QualityHexagon] Analysis complete:', result);
      setMetrics(result);
    } catch (err) {
      console.error('[QualityHexagon] Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="quality-hexagon-loading">
          <div className="spinner" />
          <p>Analyzing code quality...</p>
          <div className="analysis-steps">
            <div className="step active">🔍 Discovering tools...</div>
            <div className="step">📊 Running analysis...</div>
            <div className="step">📈 Calculating metrics...</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="quality-hexagon-error">
          <p>❌ {error}</p>
          <button onClick={analyzeQuality}>Retry</button>
        </div>
      );
    }

    if (!metrics) {
      return (
        <div className="quality-hexagon-empty">
          <p>No quality metrics available</p>
          <button
            className="analyze-button"
            onClick={analyzeQuality}
          >
            Analyze Quality
          </button>
        </div>
      );
    }

    return (
      <>
        <QualityHexagon
          metrics={metrics.hexagon}
          tier={metrics.tier}
          size={size}
        />
        <div className="quality-details">
          <div className="quality-tools">
            <h4>Available Tools:</h4>
            <div className="tool-badges">
              {metrics.availableTools.map(tool => (
                <span key={tool} className="tool-badge">
                  {tool}
                </span>
              ))}
            </div>
          </div>
          {metrics.suggestions.length > 0 && (
            <div className="quality-suggestions">
              <h4>Suggestions:</h4>
              <ul>
                {metrics.suggestions.map((suggestion, i) => (
                  <li key={i} className={`suggestion ${suggestion.priority}`}>
                    {suggestion.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button
          className="refresh-button"
          onClick={analyzeQuality}
          disabled={loading}
        >
          🔄 Refresh Analysis
        </button>
      </>
    );
  };

  return (
    <div className="quality-hexagon-panel">
      <div className="panel-header">
        <h3>Code Quality</h3>
        <span className="directory-path">{directory}</span>
      </div>
      <div className="panel-content">
        {renderContent()}
      </div>
    </div>
  );
};
```

#### Step 1.3: Add CSS Styling
**File:** `src/renderer/components/quality/QualityHexagonPanel.css`
```css
.quality-hexagon-panel {
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.directory-path {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

.quality-hexagon-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.analysis-steps {
  margin-top: 16px;
  text-align: left;
}

.step {
  padding: 8px;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.step.active {
  opacity: 1;
  font-weight: bold;
}

.quality-hexagon-error {
  text-align: center;
  padding: 32px;
  color: var(--error-color);
}

.quality-hexagon-empty {
  text-align: center;
  padding: 32px;
}

.analyze-button {
  margin-top: 16px;
  padding: 8px 24px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.analyze-button:hover {
  background: var(--primary-hover);
}

.quality-details {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.tool-badges {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.tool-badge {
  padding: 4px 12px;
  background: var(--badge-bg);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.quality-suggestions {
  margin-top: 16px;
}

.suggestion {
  padding: 8px;
  margin: 4px 0;
  border-left: 3px solid var(--border-color);
}

.suggestion.high {
  border-left-color: var(--error-color);
}

.suggestion.medium {
  border-left-color: var(--warning-color);
}

.refresh-button {
  margin-top: 16px;
  padding: 6px 16px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.refresh-button:hover:not(:disabled) {
  background: var(--hover-bg);
}

.refresh-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### Step 1.4: Add to Landing Page
**File:** `src/renderer/pages/LandingPage/LandingPage.tsx` (Add to existing file)
```typescript
import { QualityHexagonPanel } from '../../components/quality/QualityHexagonPanel';

// In your LandingPage component, add:
const LandingPage: React.FC = () => {
  const { currentRepository } = useRepository();

  return (
    <div className="landing-page">
      {/* Existing components */}

      {/* Add Quality Panel */}
      {currentRepository && (
        <div className="quality-section">
          <QualityHexagonPanel
            directory={currentRepository.path}
            autoAnalyze={false}
            size="md"
          />
        </div>
      )}
    </div>
  );
};
```

### Phase 2: Embed Quality Metrics in PackageLayer

#### Architecture Overview
Quality metrics are embedded directly in the PackageLayer data structure, following the pattern from `LENS_TO_HEXAGON_MAPPING.md`:
1. **Single Data Structure**: Quality metrics are part of package information
2. **Calculated During Package Processing**: Metrics computed when packages are analyzed
3. **Cached with Package Data**: No separate quality analysis calls needed
4. **Monorepo Support**: Each package gets its own quality hexagon

#### Integration Points

##### 2.1: Extend PackageLayer Type Definition

**File:** `src/repository-monitoring-server/types.ts`
Extend PackageLayer with quality metrics:
```typescript
interface QualityMetrics {
  tests: number;        // Test quality/coverage (0-100)
  deadCode: number;     // Dead/unused code percentage (0-100, lower is better)
  linting: number;      // Linting quality (0-100)
  formatting: number;   // Format consistency (0-100)
  types: number;        // Type safety coverage (0-100)
  documentation: number; // Documentation coverage (0-100)
}

interface PackageQualityMetrics {
  // Raw lens data
  lenses?: Map<string, LensConfig>;

  // Hexagon metrics (computed from lenses)
  hexagon: QualityMetrics;

  // Quality tier based on overall score
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';

  // Confidence level of metrics
  confidence: 'high' | 'medium' | 'low';

  // Which metrics have data
  coverage: {
    linting: boolean;
    types: boolean;
    tests: boolean;
    formatting: boolean;
    deadCode: boolean;
    documentation: boolean;
  };

  // Available tools detected in package.json
  availableTools: string[];

  // Timestamp of last analysis
  timestamp: number;
}

// Extend existing PackageWithMetrics type
export interface PackageWithMetrics {
  packageLayer: PackageLayer;
  qualityMetrics?: PackageQualityMetrics; // Add quality metrics here
}
```

##### 2.2: Update PackageProcessor to Calculate Quality Metrics

**File:** `src/repository-monitoring-server/PackageProcessor.ts`
Add quality metrics calculation during package processing:
```typescript
import { QualityLensService } from '../main/quality-lenses/QualityLensService';
import type { LensResult } from '@principal-ai/codebase-quality-lenses';

class PackageProcessor {
  private qualityLensService: QualityLensService;

  constructor() {
    this.qualityLensService = QualityLensService.getInstance();
  }

  /**
   * Process a package and extract all information including quality metrics
   */
  async processPackage(packagePath: string, packageData: any): Promise<PackageWithMetrics> {
    // Existing package processing...
    const packageLayer = await this.extractPackageLayer(packagePath, packageData);

    // Add quality metrics calculation
    const qualityMetrics = await this.calculateQualityMetrics(packagePath, packageData);

    return {
      packageLayer,
      qualityMetrics
    };
  }

  /**
   * Calculate quality metrics for a package
   */
  private async calculateQualityMetrics(
    packagePath: string,
    packageData: any
  ): Promise<PackageQualityMetrics> {
    const scripts = packageData.scripts || {};
    const availableTools = this.detectAvailableTools(scripts);
    const results = new Map<string, LensResult>();

    // Map lens commands to hexagon metrics
    const lensMapping = {
      'lens:eslint:check': 'linting',
      'lens:typescript:check': 'types',
      'lens:test:coverage': 'tests',
      'lens:prettier:check': 'formatting',
      'lens:knip:check': 'deadCode',
      'lens:typedoc:coverage': 'documentation'
    };

    // Execute available lens commands
    for (const [scriptName, metricName] of Object.entries(lensMapping)) {
      if (scripts[scriptName]) {
        try {
          const result = await this.qualityLensService.executeTool({
            repoPath: packagePath,
            toolName: metricName,
            command: scripts[scriptName]
          });

          if (result.lensResult) {
            results.set(metricName, result.lensResult);
          }
        } catch (error) {
          console.error(`[PackageProcessor] Failed to run ${scriptName}:`, error);
        }
      }
    }

    // Fallback to common script names if no lens: commands
    if (results.size === 0) {
      await this.detectAndRunFallbackTools(packagePath, scripts, results);
    }

    // Calculate hexagon metrics from results
    const hexagon = this.calculateHexagonMetrics(results);
    const tier = this.calculateTier(hexagon);

    return {
      hexagon,
      tier,
      confidence: results.size > 0 ? 'high' : 'low',
      coverage: {
        linting: results.has('linting'),
        types: results.has('types'),
        tests: results.has('tests'),
        formatting: results.has('formatting'),
        deadCode: results.has('deadCode'),
        documentation: results.has('documentation')
      },
      availableTools,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate hexagon scores from lens results
   */
  private calculateHexagonMetrics(results: Map<string, LensResult>): QualityMetrics {
    return {
      tests: this.calculateTestScore(results.get('tests')),
      deadCode: this.calculateDeadCodeScore(results.get('deadCode')),
      linting: this.calculateLintingScore(results.get('linting')),
      formatting: this.calculateFormattingScore(results.get('formatting')),
      types: this.calculateTypeScore(results.get('types')),
      documentation: this.calculateDocumentationScore(results.get('documentation'))
    };
  }

  private calculateLintingScore(lensResult?: LensResult): number {
    if (!lensResult) return 0;

    const issues = lensResult.issues || [];
    const filesAnalyzed = lensResult.metrics?.filesAnalyzed || 1;
    const issuesPerFile = issues.length / filesAnalyzed;

    // Scoring bands from LENS_TO_HEXAGON_MAPPING
    if (issuesPerFile === 0) return 100;
    if (issuesPerFile < 0.5) return 90;
    if (issuesPerFile < 1) return 75;
    if (issuesPerFile < 3) return 50;
    if (issuesPerFile < 5) return 25;
    return 0;
  }

  private calculateTier(hexagon: QualityMetrics): 'bronze' | 'silver' | 'gold' | 'platinum' {
    const average = Object.values(hexagon).reduce((a, b) => a + b, 0) / 6;

    if (average >= 95) return 'platinum';
    if (average >= 85) return 'gold';
    if (average >= 75) return 'silver';
    return 'bronze';
  }
}
```

##### 2.3: Update QualityHexagonPanel to Use Package Data

**File:** `src/renderer/principal-window/views/RepositoryExplorer/components/quality/QualityHexagonPanel.tsx`
Update to fetch quality metrics from package data:
```typescript
import { RepositoryMonitoringService } from '../../../../main-process-api/RepositoryMonitoringService';

interface QualityHexagonPanelProps {
  directory: string;
  autoAnalyze?: boolean;
  compact?: boolean;
}

export const QualityHexagonPanel: React.FC<QualityHexagonPanelProps> = ({
  directory,
  autoAnalyze = false,
  compact = false,
}) => {
  const [metrics, setMetrics] = useState<ExtendedQualityMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQualityMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch packages with embedded quality metrics
      const packagesData = await RepositoryMonitoringService.getPackages(directory);

      if (packagesData && packagesData.packages.length > 0) {
        // For single package repos, use the root package
        // For monorepos, could aggregate or show multiple hexagons
        const rootPackage = packagesData.packages.find(p => p.packageLayer.isRoot);
        const targetPackage = rootPackage || packagesData.packages[0];

        if (targetPackage?.qualityMetrics) {
          setMetrics({
            hexagon: targetPackage.qualityMetrics.hexagon,
            tier: targetPackage.qualityMetrics.tier,
            availableTools: targetPackage.qualityMetrics.availableTools,
            suggestions: [] // Could calculate suggestions from coverage
          });
        } else {
          // Fallback to mock if no quality metrics in package
          const mockResult = await MockQualityMetricsService.analyzeDirectory(directory);
          setMetrics(mockResult);
        }
      } else {
        setError('No packages found in repository');
      }
    } catch (err) {
      console.error('[QualityHexagon] Failed to fetch quality metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quality metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoAnalyze && directory) {
      fetchQualityMetrics();
    }
  }, [directory, autoAnalyze]);

  // Rest of component remains the same...
}
```

### Phase 2.5: Progressive Implementation Strategy

With quality metrics embedded in PackageLayer, implementation becomes simpler:

1. **Stage 1 - Mock Data (COMPLETED)**: UI displays mock data from MockQualityMetricsService
2. **Stage 2 - Package Integration**: PackageProcessor detects lens: commands in package.json
3. **Stage 3 - Single Tool**: Execute ESLint lens and calculate linting score
4. **Stage 4 - Multiple Tools**: Add remaining lenses progressively
5. **Stage 5 - Caching**: Package-level caching of quality metrics

#### Key Benefits of PackageLayer Integration

1. **Single Source of Truth**: Quality metrics are part of package data
2. **Automatic Caching**: Metrics cached with package information
3. **Monorepo Support**: Each package gets its own quality metrics
4. **Simpler UI**: No separate quality analysis calls needed
5. **Progressive Enhancement**: Can add metrics incrementally

### Phase 3: Implementation Details

#### Detecting Lens Commands
The PackageProcessor should look for lens commands in this priority:
1. Explicit `lens:*` commands (highest confidence)
2. Common tool commands (`lint`, `test`, `typecheck`)
3. Tool-specific commands (`eslint`, `jest`, `tsc`)

#### Score Calculation
Follow the formulas from LENS_TO_HEXAGON_MAPPING.md:
- **Linting**: Based on issues per file
- **Types**: Percentage of files with type coverage
- **Tests**: Weighted average of pass rate and coverage
- **Formatting**: Percentage of properly formatted files
- **Dead Code**: Percentage of unused exports/dependencies
- **Documentation**: Percentage of documented exports

### Phase 4: Benefits Over Separate Quality Analysis

The PackageLayer integration approach is superior to a separate quality analysis service:

| Aspect | Separate Service | PackageLayer Integration |
|--------|------------------|-------------------------|
| API Calls | 2 (packages + quality) | 1 (packages with quality) |
| Caching | Complex dual caching | Simple package cache |
| Monorepo | Manual package detection | Automatic per-package metrics |
| Data Consistency | Can get out of sync | Always synchronized |
| Implementation | New service + IPC | Extends existing PackageProcessor |

## Testing Plan

### Phase 1 Testing (UI with Mock Data)
```typescript
// Test that mock service returns data
describe('MockQualityMetricsService', () => {
  it('should return mock metrics', async () => {
    const metrics = await MockQualityMetricsService.analyzeDirectory('/test');
    expect(metrics).toHaveProperty('hexagon');
    expect(metrics.hexagon).toHaveProperty('tests');
  });

  it('should simulate delay', async () => {
    const start = Date.now();
    await MockQualityMetricsService.analyzeDirectory('/test');
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThan(1000);
  });
});
```

### Phase 2 Testing (Basic Process)
```typescript
// Test utility process communication
describe('QualityMetricsManager', () => {
  it('should start utility process', async () => {
    await qualityMetricsManager.start();
    // Verify process is running
  });

  it('should handle analysis requests', async () => {
    const metrics = await qualityMetricsManager.analyzeDirectory('/test');
    expect(metrics).toBeDefined();
  });
});
```

### Phase 3 Testing (Real Tools)
```typescript
// Test actual tool execution
describe('ToolExecutor', () => {
  it('should run ESLint without cache', async () => {
    const executor = new ToolExecutor();
    const result = await executor.executeESLint('./test-project');
    expect(result.tool).toBe('eslint');
    expect(result.duration).toBeGreaterThan(0);
  });
});
```

## Debugging & Troubleshooting

### Enable Debug Logging
```typescript
// Set environment variable
process.env.QUALITY_DEBUG = 'true';

// In your code
if (process.env.QUALITY_DEBUG) {
  console.log('[QualityMetrics] Detailed debug info...');
}
```

### Tool Execution Logs
```typescript
// Log every tool execution
class ToolExecutor {
  private logToolExecution(tool: string, directory: string, result: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      tool,
      directory,
      success: result.success,
      duration: result.duration,
      error: result.error
    };

    // Write to debug file
    fs.appendFileSync(
      path.join(app.getPath('logs'), 'quality-tools.log'),
      JSON.stringify(logEntry) + '\n'
    );
  }
}
```

### Common Issues

#### Issue: Tools not found
```typescript
// Add tool discovery
async discoverTools(directory: string): Promise<string[]> {
  const tools = [];

  // Check for tool configs
  if (fs.existsSync(path.join(directory, '.eslintrc'))) {
    tools.push('eslint');
  }
  if (fs.existsSync(path.join(directory, 'tsconfig.json'))) {
    tools.push('typescript');
  }
  if (fs.existsSync(path.join(directory, 'jest.config.js'))) {
    tools.push('jest');
  }

  console.log(`[ToolDiscovery] Found tools: ${tools.join(', ')}`);
  return tools;
}
```

#### Issue: Tool timeout
```typescript
// Add configurable timeouts
const TOOL_TIMEOUTS = {
  eslint: 60000,      // 1 minute
  typescript: 120000,  // 2 minutes
  jest: 300000,       // 5 minutes
};

async executeWithTimeout(command: string, timeout: number): Promise<any> {
  return Promise.race([
    execAsync(command),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tool timeout')), timeout)
    )
  ]);
}
```

## Environment Variables

```bash
# Development
USE_MOCK_QUALITY=true     # Use mock service
QUALITY_DEBUG=true        # Enable debug logging
QUALITY_NO_CACHE=true     # Disable all caching (default for MVP)

# Tool paths (if not in PATH)
ESLINT_PATH=/usr/local/bin/eslint
TSC_PATH=/usr/local/bin/tsc
JEST_PATH=/usr/local/bin/jest
```

## MVP Deliverables Checklist

### Phase 1: UI Foundation ✅
- [x] Mock service with realistic data
- [x] Quality Hexagon UI component
- [x] Integration in RepositoryDetailsPanel
- [x] Basic styling
- [x] Loading states

### Phase 2: PackageLayer Integration
- [ ] Extend PackageLayer types with quality metrics
- [ ] Update PackageProcessor to detect lens commands
- [ ] Calculate hexagon metrics from lens results
- [ ] Cache metrics with package data
- [ ] Update QualityHexagonPanel to use package data

### Phase 3: Tool Execution
- [ ] Wire QualityLensService to PackageProcessor
- [ ] Implement ESLint score calculation
- [ ] Implement TypeScript score calculation
- [ ] Implement Jest score calculation
- [ ] Add fallback detection for common commands

### Phase 4: Polish & Testing
- [ ] Handle monorepo with multiple packages
- [ ] Add progress indicators during analysis
- [ ] Implement error recovery
- [ ] Add debug logging
- [ ] Documentation updates

## Success Criteria

1. **UI Works with Package Data** - Hexagon displays metrics from PackageLayer
2. **Lens Detection** - Correctly identifies lens: commands in package.json
3. **Real Tools Execute** - ESLint, TypeScript, Jest run through QualityLensService
4. **Monorepo Support** - Each package shows its own quality hexagon
5. **Error Recovery** - Continues even if individual tools fail
6. **Progressive Loading** - Shows cached data while refreshing

## Next Steps After MVP

1. **Smart Caching** - Invalidate only when package.json or code changes
2. **Add More Lenses** - Prettier, Knip, Documentation tools
3. **Aggregated View** - Combined quality metrics for monorepos
4. **Historical Tracking** - Store metrics over time in Alexandria
5. **CI Integration** - Export metrics for build pipelines