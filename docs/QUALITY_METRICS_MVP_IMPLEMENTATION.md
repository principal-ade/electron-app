# Quality Metrics MVP Implementation Plan

## Overview
This document outlines a simplified, iterative implementation plan for the Quality Metrics feature. The approach prioritizes getting a working UI with mock data first, then implementing the real analysis without caching to ensure tools work correctly.

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

### Phase 2: Basic Utility Process (Week 2)

#### Step 2.1: Create Minimal Quality Metrics Server
**File:** `src/quality-metrics-server/QualityMetricsServer.ts`
```typescript
import { EventEmitter } from 'events';

export class QualityMetricsServer extends EventEmitter {
  constructor() {
    super();
    this.setupMessageHandlers();
    console.log('[QualityMetricsServer] Initialized - NO CACHING MODE');
  }

  private setupMessageHandlers(): void {
    process.on('message', async (message: any) => {
      console.log('[QualityMetricsServer] Received message:', message.type);

      switch (message.type) {
        case 'ANALYZE_DIRECTORY':
          await this.handleAnalyzeDirectory(message);
          break;
        case 'PING':
          this.sendMessage({ type: 'PONG', id: message.id });
          break;
      }
    });
  }

  private async handleAnalyzeDirectory(message: any): Promise<void> {
    const { id, directory, options } = message;

    console.log(`[QualityMetricsServer] Starting analysis for ${directory}`);
    console.log('[QualityMetricsServer] Options:', options);
    console.log('[QualityMetricsServer] IMPORTANT: Running without cache - all tools will execute');

    try {
      // Send start event
      this.sendMessage({
        type: 'ANALYSIS_STARTED',
        id,
        directory,
        timestamp: Date.now()
      });

      // TODO: Replace with real analysis
      // For now, just simulate processing
      await this.simulateAnalysis(directory);

      // Generate metrics (will be replaced with real tool execution)
      const metrics = await this.runQualityTools(directory);

      // Send completion
      this.sendMessage({
        type: 'ANALYSIS_COMPLETED',
        id,
        directory,
        metrics,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('[QualityMetricsServer] Analysis failed:', error);
      this.sendMessage({
        type: 'ANALYSIS_ERROR',
        id,
        directory,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  private async runQualityTools(directory: string): Promise<any> {
    console.log(`[QualityMetricsServer] Running quality tools for ${directory}`);
    console.log('[QualityMetricsServer] NO CACHE - Executing all tools fresh');

    // This will be replaced with real tool execution
    // For MVP, return mock data
    return {
      directory,
      timestamp: Date.now(),
      hexagon: {
        tests: 75,
        deadCode: 15,
        formatting: 90,
        linting: 85,
        types: 95,
        documentation: 60
      },
      tier: 'silver',
      availableTools: ['eslint', 'typescript'],
      toolResults: {},
      suggestions: []
    };
  }

  private async simulateAnalysis(directory: string): Promise<void> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private sendMessage(message: any): void {
    if (process.send) {
      process.send(message);
    }
  }
}

// Start the server
const server = new QualityMetricsServer();
console.log('[QualityMetricsServer] Process started');
```

#### Step 2.2: Create Manager in Main Process
**File:** `src/main/quality-metrics/QualityMetricsManager.ts`
```typescript
import { EventEmitter } from 'events';
import { utilityProcess, UtilityProcess } from 'electron';
import * as path from 'path';

export class QualityMetricsManager extends EventEmitter {
  private worker: UtilityProcess | null = null;
  private pendingRequests = new Map<string, any>();

  async start(): Promise<void> {
    if (this.worker) {
      console.log('[QualityMetricsManager] Already started');
      return;
    }

    console.log('[QualityMetricsManager] Starting quality metrics server...');
    console.log('[QualityMetricsManager] RUNNING WITHOUT CACHE - All analyses will be fresh');

    // For now, use a simple worker file
    const workerPath = path.join(__dirname, 'quality-worker.js');

    this.worker = utilityProcess.fork(workerPath, [], {
      serviceName: 'quality-metrics-server',
      stdio: 'pipe'
    });

    this.worker.on('message', (message: any) => {
      console.log('[QualityMetricsManager] Received message:', message.type);
      this.handleMessage(message);
    });

    this.worker.on('spawn', () => {
      console.log('[QualityMetricsManager] Worker spawned successfully');
    });

    this.worker.on('exit', (code) => {
      console.log(`[QualityMetricsManager] Worker exited with code ${code}`);
      this.worker = null;
    });
  }

  async analyzeDirectory(directory: string, options?: any): Promise<any> {
    console.log(`[QualityMetricsManager] Analyze request for ${directory}`);
    console.log('[QualityMetricsManager] NO CACHING - Will run all tools');

    if (!this.worker) {
      await this.start();
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this.worker!.postMessage({
        type: 'ANALYZE_DIRECTORY',
        id: requestId,
        directory,
        options,
        timestamp: Date.now()
      });
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'ANALYSIS_COMPLETED':
        const request = this.pendingRequests.get(message.id);
        if (request) {
          request.resolve(message.metrics);
          this.pendingRequests.delete(message.id);
        }
        break;

      case 'ANALYSIS_ERROR':
        const errorRequest = this.pendingRequests.get(message.id);
        if (errorRequest) {
          errorRequest.reject(new Error(message.error));
          this.pendingRequests.delete(message.id);
        }
        break;
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const qualityMetricsManager = new QualityMetricsManager();
```

### Phase 3: Real Tool Execution (Week 3)

#### Step 3.1: Integrate Real Tools (No Caching)
**File:** `src/quality-metrics-server/ToolExecutor.ts`
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ToolExecutor {
  async executeESLint(directory: string): Promise<ToolResult> {
    console.log(`[ToolExecutor] Running ESLint for ${directory}`);
    console.log('[ToolExecutor] NO CACHE - Executing fresh');

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(
        'npx eslint . --format json',
        { cwd: directory }
      );

      const duration = Date.now() - startTime;
      console.log(`[ToolExecutor] ESLint completed in ${duration}ms`);

      // Parse results
      const results = JSON.parse(stdout);
      const errorCount = results.reduce((acc, file) => acc + file.errorCount, 0);
      const warningCount = results.reduce((acc, file) => acc + file.warningCount, 0);

      return {
        tool: 'eslint',
        success: true,
        duration,
        output: stdout,
        metrics: {
          errors: errorCount,
          warnings: warningCount,
          score: errorCount === 0 ? 100 : Math.max(0, 100 - (errorCount * 5))
        }
      };
    } catch (error) {
      console.error('[ToolExecutor] ESLint failed:', error);
      return {
        tool: 'eslint',
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        metrics: { score: 0 }
      };
    }
  }

  async executeTypeScript(directory: string): Promise<ToolResult> {
    console.log(`[ToolExecutor] Running TypeScript for ${directory}`);
    console.log('[ToolExecutor] NO CACHE - Executing fresh');

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(
        'npx tsc --noEmit',
        { cwd: directory }
      );

      const duration = Date.now() - startTime;
      console.log(`[ToolExecutor] TypeScript completed in ${duration}ms`);

      // If no errors, tsc exits with 0
      return {
        tool: 'typescript',
        success: true,
        duration,
        output: 'No type errors found',
        metrics: { score: 100 }
      };
    } catch (error) {
      // tsc exits with non-zero if there are type errors
      const duration = Date.now() - startTime;
      const errorCount = (error.stdout?.match(/error TS/g) || []).length;

      return {
        tool: 'typescript',
        success: false,
        duration,
        output: error.stdout || error.stderr,
        metrics: {
          errors: errorCount,
          score: Math.max(0, 100 - (errorCount * 3))
        }
      };
    }
  }

  async executeJest(directory: string): Promise<ToolResult> {
    console.log(`[ToolExecutor] Running Jest for ${directory}`);
    console.log('[ToolExecutor] NO CACHE - Executing fresh');

    const startTime = Date.now();

    try {
      const { stdout } = await execAsync(
        'npx jest --coverage --json',
        { cwd: directory }
      );

      const duration = Date.now() - startTime;
      console.log(`[ToolExecutor] Jest completed in ${duration}ms`);

      const results = JSON.parse(stdout);
      const coverage = results.coverageMap?.total?.lines?.pct || 0;

      return {
        tool: 'jest',
        success: results.success,
        duration,
        output: stdout,
        metrics: {
          coverage,
          score: coverage
        }
      };
    } catch (error) {
      console.error('[ToolExecutor] Jest failed:', error);
      return {
        tool: 'jest',
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        metrics: { score: 0 }
      };
    }
  }
}
```

### Phase 4: Connect UI to Real Service (Week 4)

#### Step 4.1: Create Real Service Interface
**File:** `src/renderer/services/QualityMetricsService.ts`
```typescript
class QualityMetricsServiceImpl {
  private useMock = process.env.USE_MOCK_QUALITY === 'true';

  async analyzeDirectory(
    directory: string,
    options?: AnalysisOptions
  ): Promise<QualityMetrics> {
    console.log(`[QualityMetricsService] Analyzing ${directory}`);
    console.log(`[QualityMetricsService] Mode: ${this.useMock ? 'MOCK' : 'REAL'}`);
    console.log('[QualityMetricsService] NO CACHING - Fresh analysis every time');

    if (this.useMock) {
      return MockQualityMetricsService.analyzeDirectory(directory, options);
    }

    // Call real IPC
    return window.mainProcess.quality.analyze(directory, options);
  }

  subscribeToUpdates(
    directory: string,
    callback: (metrics: QualityMetrics) => void
  ): () => void {
    if (this.useMock) {
      return MockQualityMetricsService.subscribeToUpdates(directory, callback);
    }

    // Real IPC subscription
    const listener = (event: any, data: any) => {
      if (data.directory === directory) {
        callback(data.metrics);
      }
    };

    window.mainProcess.on('quality:update', listener);
    window.mainProcess.quality.subscribe(directory);

    return () => {
      window.mainProcess.off('quality:update', listener);
      window.mainProcess.quality.unsubscribe(directory);
    };
  }
}

export const QualityMetricsService = new QualityMetricsServiceImpl();
```

#### Step 4.2: Update Component to Use Real Service
**File:** `src/renderer/components/quality/QualityHexagonPanel.tsx` (Update imports)
```typescript
// Change from:
import { MockQualityMetricsService } from '../../services/MockQualityMetricsService';

// To:
import { QualityMetricsService } from '../../services/QualityMetricsService';

// Update all MockQualityMetricsService references to QualityMetricsService
```

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

### Week 1 ✅
- [ ] Mock service with realistic data
- [ ] Quality Hexagon UI component
- [ ] Integration in Landing Page
- [ ] Basic styling
- [ ] Loading states

### Week 2
- [ ] Basic utility process setup
- [ ] Message protocol
- [ ] Main process manager
- [ ] IPC handlers
- [ ] Process lifecycle management

### Week 3
- [ ] Real ESLint execution
- [ ] Real TypeScript execution
- [ ] Real Jest execution
- [ ] Tool discovery
- [ ] Error handling

### Week 4
- [ ] Connect UI to real service
- [ ] Switch between mock/real
- [ ] Debug logging
- [ ] Performance monitoring
- [ ] Documentation

## Success Criteria

1. **UI Works with Mock Data** - Can display hexagon with mock metrics
2. **No Caching** - Every analysis runs fresh (for debugging)
3. **Real Tools Execute** - ESLint, TypeScript, Jest run successfully
4. **Clear Logging** - Can see what tools run and their output
5. **Error Recovery** - Gracefully handles tool failures
6. **User Feedback** - Shows progress during analysis

## Next Steps After MVP

1. **Add Caching** - Once tools are stable
2. **Add More Tools** - Prettier, Knip, Documentation
3. **Incremental Updates** - Only re-run changed tools
4. **Historical Tracking** - Store metrics over time
5. **Comparison View** - Compare branches/commits